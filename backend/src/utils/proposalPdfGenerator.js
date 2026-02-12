/**
 * Proposal PDF HTML Generator
 * Generates a print-ready HTML document for proposals.
 * Case study pages are passed in as pre-rendered HTML from generateCaseStudyPdfHtml().
 */

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function formatCurrency(amount) {
  if (!amount) return '';
  return '$' + Number(amount).toLocaleString('en-US', { maximumFractionDigits: 0 });
}

function formatDate(dateString) {
  if (!dateString) return '';
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric', month: 'long', day: 'numeric'
  });
}

/**
 * @param {Object} proposal - Full proposal object from findByIdAndTenant
 * @param {string} logoBase64 - Company logo as data URL
 * @param {string[]} caseStudyPages - Array of full HTML documents from generateCaseStudyPdfHtml
 */
function generateProposalPdfHtml(proposal, logoBase64 = '', caseStudyPages = []) {
  const sections = proposal.sections || [];
  const caseStudies = proposal.case_studies || [];
  const serviceOfferings = proposal.service_offerings || [];
  const resumes = proposal.resumes || [];

  const primaryColor = '#1e3a5f';
  const accentColor = '#3b82f6';

  const logoHtml = logoBase64
    ? `<img src="${logoBase64}" style="max-height:60px; max-width:200px; object-fit:contain;" />`
    : '';

  // Extract <body> content from each case study HTML page
  const caseStudyBodies = caseStudyPages.map(html => {
    const bodyMatch = html.match(/<body[^>]*>([\s\S]*)<\/body>/i);
    return bodyMatch ? bodyMatch[1] : '';
  });

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<title>${escapeHtml(proposal.title)} - ${escapeHtml(proposal.proposal_number)}</title>
<style>
  @page { margin: 0.6in; size: letter; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; color: #1a202c; font-size: 11pt; line-height: 1.5; }

  .header { display: flex; justify-content: space-between; align-items: center; padding-bottom: 16px; border-bottom: 3px solid ${primaryColor}; margin-bottom: 24px; }
  .header-left .proposal-number { font-size: 12pt; color: ${primaryColor}; font-weight: 700; }
  .header-left .proposal-title { font-size: 18pt; font-weight: 700; color: ${primaryColor}; margin-top: 4px; }
  .header-left .proposal-date { font-size: 9pt; color: #6b7280; margin-top: 4px; }

  .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 24px; }
  .info-box { padding: 16px; background: #f8fafc; border-radius: 6px; border-left: 4px solid ${accentColor}; }
  .info-box-title { font-size: 9pt; font-weight: 700; color: ${accentColor}; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 8px; }
  .info-row { font-size: 10pt; margin-bottom: 4px; }
  .info-row strong { color: #374151; }

  .content-section { margin-bottom: 20px; page-break-inside: avoid; }
  .content-section h2 { font-size: 14pt; font-weight: 700; color: ${primaryColor}; border-bottom: 2px solid #e5e7eb; padding-bottom: 6px; margin-bottom: 10px; }
  .content-section .body { font-size: 10.5pt; line-height: 1.6; color: #374151; white-space: pre-wrap; }

  .attachment-section { margin-bottom: 20px; page-break-inside: avoid; }
  .attachment-section h2 { font-size: 14pt; font-weight: 700; color: ${primaryColor}; border-bottom: 2px solid #e5e7eb; padding-bottom: 6px; margin-bottom: 12px; }
  .attachment-card { padding: 12px 16px; background: #f9fafb; border-radius: 6px; margin-bottom: 8px; border-left: 3px solid ${accentColor}; }
  .attachment-card .att-name { font-size: 11pt; font-weight: 600; color: #1a202c; }
  .attachment-card .att-meta { font-size: 9pt; color: #6b7280; margin-top: 2px; }
  .attachment-card .att-desc { font-size: 9.5pt; color: #4b5563; margin-top: 4px; }

  .service-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
  .service-pill { padding: 10px 14px; background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 6px; }
  .service-pill .svc-name { font-size: 10.5pt; font-weight: 600; color: #1e40af; }
  .service-pill .svc-cat { font-size: 8.5pt; color: #6b7280; }
  .service-pill .svc-desc { font-size: 9pt; color: #4b5563; margin-top: 4px; }

  .footer { margin-top: 30px; padding-top: 12px; border-top: 2px solid ${primaryColor}; font-size: 9pt; color: #6b7280; display: flex; justify-content: space-between; }

  .cs-page { page-break-before: always; }

  @media print {
    .content-section, .attachment-section { page-break-inside: avoid; }
    .cs-page { page-break-before: always; }
  }
</style>
</head>
<body>

<!-- Header -->
<div class="header">
  <div class="header-left">
    <div class="proposal-number">${escapeHtml(proposal.proposal_number)}</div>
    <div class="proposal-title">${escapeHtml(proposal.title)}</div>
    <div class="proposal-date">Prepared ${formatDate(proposal.created_at)}${proposal.valid_until ? ` &middot; Valid until ${formatDate(proposal.valid_until)}` : ''}</div>
  </div>
  <div class="header-right">${logoHtml}</div>
</div>

<!-- Info Grid -->
<div class="info-grid">
  <div class="info-box">
    <div class="info-box-title">Prepared For</div>
    ${proposal.customer_name ? `<div class="info-row"><strong>${escapeHtml(proposal.customer_name)}</strong></div>` : ''}
    ${proposal.customer_owner ? `<div class="info-row">${escapeHtml(proposal.customer_owner)}</div>` : ''}
    ${proposal.customer_address ? `<div class="info-row">${escapeHtml(proposal.customer_address)}</div>` : ''}
  </div>
  <div class="info-box">
    <div class="info-box-title">Project Details</div>
    ${proposal.project_name ? `<div class="info-row"><strong>Project:</strong> ${escapeHtml(proposal.project_name)}</div>` : ''}
    ${proposal.project_location ? `<div class="info-row"><strong>Location:</strong> ${escapeHtml(proposal.project_location)}</div>` : ''}
    ${proposal.total_amount ? `<div class="info-row"><strong>Total Amount:</strong> ${formatCurrency(proposal.total_amount)}</div>` : ''}
    ${proposal.payment_terms ? `<div class="info-row"><strong>Payment Terms:</strong> ${escapeHtml(proposal.payment_terms)}</div>` : ''}
  </div>
</div>

<!-- Content Sections -->
${renderContentSection('Executive Summary', proposal.executive_summary)}
${renderContentSection('Company Overview', proposal.company_overview)}
${renderContentSection('Scope of Work', proposal.scope_of_work)}
${renderContentSection('Approach & Methodology', proposal.approach_and_methodology)}

<!-- Template Sections -->
${sections
  .sort((a, b) => a.display_order - b.display_order)
  .map(s => renderContentSection(s.title, s.content))
  .join('\n')}

<!-- Service Offerings -->
${serviceOfferings.length > 0 ? `
<div class="attachment-section">
  <h2>Service Offerings</h2>
  <div class="service-grid">
    ${serviceOfferings
      .sort((a, b) => a.display_order - b.display_order)
      .map(so => `
        <div class="service-pill">
          <div class="svc-name">${escapeHtml(so.name)}</div>
          ${so.category ? `<div class="svc-cat">${escapeHtml(so.category)}</div>` : ''}
          ${so.custom_description ? `<div class="svc-desc">${escapeHtml(so.custom_description)}</div>` : (so.description ? `<div class="svc-desc">${escapeHtml(so.description)}</div>` : '')}
        </div>
      `).join('')}
  </div>
</div>
` : ''}

<!-- Team Resumes -->
${resumes.length > 0 ? `
<div class="attachment-section">
  <h2>Key Personnel</h2>
  ${resumes
    .sort((a, b) => a.display_order - b.display_order)
    .map(r => `
      <div class="attachment-card">
        <div class="att-name">${escapeHtml(r.employee_name)}</div>
        <div class="att-meta">${escapeHtml(r.job_title)}${r.role_on_project ? ` | Role: ${escapeHtml(r.role_on_project)}` : ''}${r.years_experience ? ` | ${r.years_experience} years experience` : ''}</div>
        ${r.summary ? `<div class="att-desc">${escapeHtml(r.summary)}</div>` : ''}
      </div>
    `).join('')}
</div>
` : ''}

<!-- Terms & Conditions -->
${renderContentSection('Terms & Conditions', proposal.terms_and_conditions)}

<!-- Footer -->
<div class="footer">
  <span>${escapeHtml(proposal.proposal_number)} &middot; Version ${proposal.version_number || 1}</span>
  <span>Prepared by ${escapeHtml(proposal.created_by_name || '')}</span>
</div>

<!-- Attached Case Study Pages (actual published case studies) -->
${caseStudyBodies.map(body => `
<div class="cs-page">
${body}
</div>
`).join('\n')}

</body>
</html>`;
}

function renderContentSection(title, content) {
  if (!content) return '';
  return `
<div class="content-section">
  <h2>${escapeHtml(title)}</h2>
  <div class="body">${escapeHtml(content)}</div>
</div>`;
}

module.exports = { generateProposalPdfHtml };
