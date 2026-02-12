/**
 * Template Variable Processor
 * Processes template content with variable substitution
 */

/**
 * Process template content with variable substitution
 * @param {string} content - Template content with {{variable}} placeholders
 * @param {Object} variables - Key-value pairs for substitution
 * @returns {string} Processed content with variables replaced
 */
function processTemplate(content, variables) {
  if (!content) return content;

  let processed = content;

  // Replace all {{variable}} placeholders with values
  Object.keys(variables).forEach(key => {
    const value = variables[key] || '';
    const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
    processed = processed.replace(regex, value);
  });

  return processed;
}

/**
 * Build variable map from proposal and related data
 * @param {Object} data - Object containing proposal, customer, tenant, etc.
 * @returns {Object} Variable map for template substitution
 */
function buildProposalVariables(data) {
  const {
    proposal = {},
    customer = {},
    tenant = {},
    user = {}
  } = data;

  const currentDate = new Date();
  const formatDate = (date) => {
    return date ? new Date(date).toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric'
    }) : '';
  };

  const formatCurrency = (amount) => {
    return amount ? `$${parseFloat(amount).toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    })}` : '$0.00';
  };

  return {
    // Customer variables
    'customer_name': customer.customer_facility || customer.name || '',
    'customer_owner': customer.customer_owner || '',
    'customer_address': customer.address || '',
    'customer_city': customer.city || '',
    'customer_state': customer.state || '',
    'customer_zip': customer.zip || '',
    'customer_phone': customer.phone || '',
    'customer_email': customer.email || '',

    // Proposal variables
    'proposal_number': proposal.proposal_number || '',
    'proposal_title': proposal.title || '',
    'project_name': proposal.project_name || '',
    'project_location': proposal.project_location || '',
    'total_amount': formatCurrency(proposal.total_amount),
    'valid_until': formatDate(proposal.valid_until),
    'payment_terms': proposal.payment_terms || '',

    // Company/Tenant variables
    'company_name': tenant.company_name || '',
    'company_address': tenant.address || '',
    'company_city': tenant.city || '',
    'company_state': tenant.state || '',
    'company_zip': tenant.zip || '',
    'company_phone': tenant.phone || '',
    'company_email': tenant.email || '',
    'company_website': tenant.website || '',

    // Date variables
    'current_date': formatDate(currentDate),
    'current_year': currentDate.getFullYear().toString(),
    'current_month': currentDate.toLocaleDateString('en-US', { month: 'long' }),

    // User variables
    'created_by_name': user.name || user.username || '',
    'created_by_email': user.email || '',
    'created_by_title': user.title || ''
  };
}

/**
 * Get list of available template variables
 * @returns {Array} Array of variable objects with name and description
 */
function getAvailableVariables() {
  return [
    { name: 'customer_name', description: 'Customer facility or company name' },
    { name: 'customer_owner', description: 'Customer owner/contact name' },
    { name: 'customer_address', description: 'Customer full address' },
    { name: 'customer_city', description: 'Customer city' },
    { name: 'customer_state', description: 'Customer state' },
    { name: 'customer_zip', description: 'Customer ZIP code' },
    { name: 'customer_phone', description: 'Customer phone number' },
    { name: 'customer_email', description: 'Customer email address' },

    { name: 'proposal_number', description: 'Auto-generated proposal number' },
    { name: 'proposal_title', description: 'Proposal title' },
    { name: 'project_name', description: 'Project name' },
    { name: 'project_location', description: 'Project location' },
    { name: 'total_amount', description: 'Total proposal amount (formatted currency)' },
    { name: 'valid_until', description: 'Proposal expiration date (formatted)' },
    { name: 'payment_terms', description: 'Payment terms' },

    { name: 'company_name', description: 'Your company name' },
    { name: 'company_address', description: 'Your company address' },
    { name: 'company_city', description: 'Your company city' },
    { name: 'company_state', description: 'Your company state' },
    { name: 'company_zip', description: 'Your company ZIP code' },
    { name: 'company_phone', description: 'Your company phone number' },
    { name: 'company_email', description: 'Your company email' },
    { name: 'company_website', description: 'Your company website' },

    { name: 'current_date', description: 'Today\'s date (formatted)' },
    { name: 'current_year', description: 'Current year' },
    { name: 'current_month', description: 'Current month name' },

    { name: 'created_by_name', description: 'Name of person creating proposal' },
    { name: 'created_by_email', description: 'Email of person creating proposal' },
    { name: 'created_by_title', description: 'Title of person creating proposal' }
  ];
}

module.exports = {
  processTemplate,
  buildProposalVariables,
  getAvailableVariables
};
