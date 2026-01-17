const express = require('express');
const Anthropic = require('@anthropic-ai/sdk');
const { authenticate } = require('../middleware/auth');
const Project = require('../models/Project');
const Customer = require('../models/Customer');
const RFI = require('../models/RFI');
const Submittal = require('../models/Submittal');
const ChangeOrder = require('../models/ChangeOrder');
const DailyReport = require('../models/DailyReport');
const ScheduleItem = require('../models/ScheduleItem');
const Company = require('../models/Company');
const Contact = require('../models/Contact');

const router = express.Router();

// Apply auth middleware
router.use(authenticate);

// Initialize Anthropic client
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

/**
 * Gather database context for the chatbot
 */
async function gatherDatabaseContext(userId) {
  try {
    const context = {};

    // Get projects summary
    const projects = await Project.findAll();
    context.projects = {
      total: projects.length,
      active: projects.filter(p => p.status === 'active').length,
      completed: projects.filter(p => p.status === 'completed').length,
      onHold: projects.filter(p => p.status === 'on_hold').length,
      recentProjects: projects.slice(0, 10).map(p => ({
        id: p.id,
        name: p.name,
        number: p.number,
        client: p.client,
        status: p.status,
        manager: p.manager_name
      }))
    };

    // Get customer stats
    const customerStats = await Customer.getStats();
    const customers = await Customer.findAll();
    context.customers = {
      stats: customerStats,
      recentCustomers: customers.slice(0, 10).map(c => ({
        facility: c.customer_facility,
        owner: c.customer_owner,
        accountManager: c.account_manager,
        score: c.customer_score,
        active: c.active_customer
      }))
    };

    // Get RFIs summary
    const allRFIs = [];
    for (const project of projects.slice(0, 5)) {
      const rfis = await RFI.findByProject(project.id);
      allRFIs.push(...rfis);
    }
    context.rfis = {
      total: allRFIs.length,
      open: allRFIs.filter(r => r.status === 'open').length,
      answered: allRFIs.filter(r => r.status === 'answered').length,
      overdue: allRFIs.filter(r => r.due_date && new Date(r.due_date) < new Date() && r.status !== 'closed').length
    };

    // Get companies and contacts count
    const companies = await Company.findAll();
    const db = require('../config/database');
    const contactsResult = await db.query('SELECT COUNT(*) FROM contacts');
    const contactsCount = parseInt(contactsResult.rows[0].count);

    context.companies = {
      total: companies.length,
      byRole: {
        general_contractor: companies.filter(c => c.role === 'general_contractor').length,
        architect: companies.filter(c => c.role === 'architect').length,
        engineer: companies.filter(c => c.role === 'engineer').length,
        subcontractor: companies.filter(c => c.role === 'subcontractor').length,
        supplier: companies.filter(c => c.role === 'supplier').length
      }
    };
    context.contacts = { total: contactsCount };

    return context;
  } catch (error) {
    console.error('Error gathering database context:', error);
    return {};
  }
}

/**
 * Perform intelligent search based on user's question
 */
async function performIntelligentSearch(message) {
  const searchResults = {};
  const db = require('../config/database');

  // Extract potential search terms (remove common words)
  const commonWords = ['the', 'a', 'an', 'what', 'who', 'is', 'are', 'tell', 'me', 'about', 'find', 'show', 'get', 'account', 'manager', 'for', 'customer', 'project'];
  const words = message.toLowerCase().split(/\s+/).filter(w => !commonWords.includes(w) && w.length > 2);

  if (words.length > 0) {
    // Search customers
    const searchTerm = words.join(' ');
    const customerResults = await Customer.search(searchTerm);
    if (customerResults && customerResults.length > 0) {
      searchResults.customers = customerResults.slice(0, 10).map(c => ({
        facility: c.customer_facility,
        owner: c.customer_owner,
        accountManager: c.account_manager,
        fieldLeads: c.field_leads,
        city: c.city,
        state: c.state,
        score: c.customer_score,
        active: c.active_customer,
        department: c.department
      }));
    }

    // Search projects by client name
    const projectResults = await db.query(
      `SELECT p.*, u.first_name || ' ' || u.last_name as manager_name
       FROM projects p
       LEFT JOIN users u ON p.manager_id = u.id
       WHERE p.name ILIKE $1 OR p.client ILIKE $1 OR p.number ILIKE $1
       ORDER BY p.created_at DESC
       LIMIT 10`,
      [`%${searchTerm}%`]
    );
    if (projectResults.rows.length > 0) {
      searchResults.projects = projectResults.rows.map(p => ({
        name: p.name,
        number: p.number,
        client: p.client,
        status: p.status,
        manager: p.manager_name,
        startDate: p.start_date,
        endDate: p.end_date
      }));
    }
  }

  return searchResults;
}

// Chat endpoint
router.post('/message', async (req, res, next) => {
  try {
    const { message, conversationHistory = [] } = req.body;

    if (!message || typeof message !== 'string') {
      return res.status(400).json({ error: 'Message is required' });
    }

    // Gather real-time database context
    const dbContext = await gatherDatabaseContext(req.user.id);

    // Perform intelligent search based on the question
    const searchResults = await performIntelligentSearch(message);

    // Build conversation messages for Claude
    const messages = [
      ...conversationHistory.map(msg => ({
        role: msg.sender === 'user' ? 'user' : 'assistant',
        content: msg.text
      })),
      {
        role: 'user',
        content: message
      }
    ];

    // Create enhanced system prompt with real database context
    const systemPrompt = `You are Titan, an AI assistant for Tweet Garot Mechanical, a commercial HVAC and plumbing contractor.

Your role is to assist ${req.user.firstName} ${req.user.lastName} (${req.user.role}) with their daily work.

## CURRENT BUSINESS DATA (Real-time from database):

### Projects:
- Total Projects: ${dbContext.projects?.total || 0}
- Active: ${dbContext.projects?.active || 0}
- Completed: ${dbContext.projects?.completed || 0}
- On Hold: ${dbContext.projects?.onHold || 0}

Recent Projects:
${dbContext.projects?.recentProjects?.map(p =>
  `- ${p.name} (${p.number}) - ${p.client} - Status: ${p.status} - PM: ${p.manager || 'Unassigned'}`
).join('\n') || 'None'}

### Customers:
- Total Customers: ${dbContext.customers?.stats?.total_customers || 0}
- Active Customers: ${dbContext.customers?.stats?.active_customers || 0}
- Unique Owners: ${dbContext.customers?.stats?.unique_owners || 0}
- Account Managers: ${dbContext.customers?.stats?.account_managers || 0}
- States Covered: ${dbContext.customers?.stats?.states_covered || 0}

### RFIs (Requests for Information):
- Total RFIs: ${dbContext.rfis?.total || 0}
- Open: ${dbContext.rfis?.open || 0}
- Answered: ${dbContext.rfis?.answered || 0}
- Overdue: ${dbContext.rfis?.overdue || 0}

### Companies & Contacts:
- Total Companies: ${dbContext.companies?.total || 0}
  - General Contractors: ${dbContext.companies?.byRole?.general_contractor || 0}
  - Architects: ${dbContext.companies?.byRole?.architect || 0}
  - Engineers: ${dbContext.companies?.byRole?.engineer || 0}
  - Subcontractors: ${dbContext.companies?.byRole?.subcontractor || 0}
  - Suppliers: ${dbContext.companies?.byRole?.supplier || 0}
- Total Contacts: ${dbContext.contacts?.total || 0}

${searchResults.customers || searchResults.projects ? '## SEARCH RESULTS FOR YOUR QUERY:\n\n' : ''}${searchResults.customers ? `### Matching Customers Found:\n${searchResults.customers.map(c =>
  `- ${c.facility} (Owner: ${c.owner || 'N/A'})
    Account Manager: ${c.accountManager || 'Unassigned'}
    Field Leads: ${c.fieldLeads || 'None'}
    Location: ${c.city || 'N/A'}, ${c.state || 'N/A'}
    Score: ${c.score || 'N/A'}
    Department: ${c.department || 'N/A'}
    Status: ${c.active ? 'Active' : 'Inactive'}`
).join('\n\n')}\n\n` : ''}${searchResults.projects ? `### Matching Projects Found:\n${searchResults.projects.map(p =>
  `- ${p.name} (${p.number})
    Client: ${p.client}
    Status: ${p.status}
    Project Manager: ${p.manager || 'Unassigned'}
    Start Date: ${p.startDate || 'N/A'}
    End Date: ${p.endDate || 'N/A'}`
).join('\n\n')}\n\n` : ''}
## YOUR CAPABILITIES:

You can help with:
- Answering questions about specific projects, RFIs, submittals, change orders, and schedules
- Providing insights on customer accounts and relationships
- Analyzing project data and identifying trends
- Discussing estimating, budgeting, and financial matters
- Brainstorming marketing strategies and business development ideas
- Analyzing operations and suggesting improvements
- General business questions and strategic advice

## IMPORTANT INSTRUCTIONS:

1. **PRIORITIZE SEARCH RESULTS**: If search results are shown above, answer the question using those specific results first!
2. Use the real-time data above to provide specific, accurate answers
3. When asked about counts or statistics, reference the actual numbers from the database
4. When discussing specific customers or projects, use the search results if available
5. Be conversational, helpful, and professional
6. Answer questions directly and naturally - state the information clearly
7. Don't give overly generic responses - use the actual data to provide specific insights
8. If you see concerning trends (like many overdue RFIs), proactively mention them
9. When listing customers or projects, include ALL the important details (Account Manager, location, etc.)

Remember: You have access to REAL data from the system, including intelligent search results for the user's specific question. Use it to provide valuable, specific insights!`;

    // Call Claude API
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2048,
      system: systemPrompt,
      messages: messages
    });

    // Extract the response text
    const responseText = response.content[0].text;

    res.json({
      response: responseText,
      usage: {
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens
      }
    });

  } catch (error) {
    console.error('Chat error:', error);

    if (error.status === 401) {
      return res.status(500).json({
        error: 'AI service authentication failed. Please check API key configuration.'
      });
    }

    next(error);
  }
});

module.exports = router;
