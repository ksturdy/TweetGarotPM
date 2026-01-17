const express = require('express');
const Anthropic = require('@anthropic-ai/sdk');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

// Apply auth middleware
router.use(authenticate);

// Initialize Anthropic client
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// Chat endpoint
router.post('/message', async (req, res, next) => {
  try {
    const { message, conversationHistory = [] } = req.body;

    if (!message || typeof message !== 'string') {
      return res.status(400).json({ error: 'Message is required' });
    }

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

    // Create system prompt with context about the business
    const systemPrompt = `You are Titan, an AI assistant for Tweet Garot Mechanical, a commercial HVAC and plumbing contractor.

Your role is to assist ${req.user.firstName} ${req.user.lastName} (${req.user.role}) with their daily work.

You can help with:
- Answering questions about projects, RFIs, submittals, change orders, and schedules
- Providing insights on customer accounts and relationships
- Discussing estimating, budgeting, and financial matters
- Brainstorming marketing strategies and business development ideas
- Analyzing operations and suggesting improvements
- General business questions and strategic advice

Be conversational, helpful, and professional. Answer questions directly and naturally. If you don't have specific data, acknowledge it but still provide helpful guidance based on general industry knowledge and best practices.

Don't give overly generic responses - engage with the user's actual question and provide specific, actionable advice where possible.`;

    // Call Claude API
    const response = await anthropic.messages.create({
      model: 'claude-3-5-sonnet-20240620',
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
