const express = require('express');
const router = express.Router();
const nodemailer = require('nodemailer');

// POST /api/questionnaire/submit
router.post('/submit', async (req, res) => {
  try {
    const { formData, submittedBy, submittedAt } = req.body;

    // Create email HTML content
    const emailHTML = generateEmailHTML(formData, submittedBy, submittedAt);

    // Configure nodemailer transporter
    const transporter = nodemailer.createTransporter({
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: process.env.SMTP_PORT || 587,
      secure: false,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });

    // Send email
    await transporter.sendMail({
      from: process.env.SMTP_USER,
      to: 'sales@missionintegratedsystems.com',
      subject: `New Build Questionnaire - ${formData.companyName}`,
      html: emailHTML,
    });

    res.status(200).json({ message: 'Questionnaire submitted successfully' });
  } catch (error) {
    console.error('Error submitting questionnaire:', error);
    res.status(500).json({ error: 'Failed to submit questionnaire' });
  }
});

function generateEmailHTML(formData, submittedBy, submittedAt) {
  return `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 800px; margin: 0 auto; padding: 20px; }
    h1 { color: #3b82f6; border-bottom: 3px solid #3b82f6; padding-bottom: 10px; }
    h2 { color: #1a1a2e; background: #f0f4f8; padding: 10px; border-left: 4px solid #3b82f6; margin-top: 30px; }
    h3 { color: #5a5a72; margin-top: 20px; }
    .section { margin-bottom: 30px; }
    .field { margin: 10px 0; padding: 8px; background: #f9fafb; border-radius: 4px; }
    .field-label { font-weight: bold; color: #1a1a2e; }
    .field-value { margin-left: 10px; color: #5a5a72; }
    .checkbox-list { list-style: none; padding-left: 0; }
    .checkbox-list li:before { content: "✓ "; color: #10b981; font-weight: bold; }
    .meta { background: #e8f4f8; padding: 15px; border-radius: 8px; margin-bottom: 20px; }
    ul { padding-left: 20px; }
  </style>
</head>
<body>
  <h1>New Build Questionnaire Submission</h1>

  <div class="meta">
    <p><strong>Submitted by:</strong> ${submittedBy}</p>
    <p><strong>Submitted at:</strong> ${new Date(submittedAt).toLocaleString()}</p>
  </div>

  <div class="section">
    <h2>Project Overview</h2>
    <div class="field">
      <span class="field-label">Company Name:</span>
      <span class="field-value">${formData.companyName || 'N/A'}</span>
    </div>
    <div class="field">
      <span class="field-label">Industry/Domain:</span>
      <span class="field-value">${formData.industry || 'N/A'}</span>
    </div>
    <div class="field">
      <span class="field-label">Primary Business Activity:</span>
      <span class="field-value">${formData.businessActivity || 'N/A'}</span>
    </div>
    <div class="field">
      <span class="field-label">Estimated Users:</span>
      <span class="field-value">${formData.estimatedUsers || 'N/A'}</span>
    </div>
    <div class="field">
      <span class="field-label">Number of Locations:</span>
      <span class="field-value">${formData.locations || 'N/A'}</span>
    </div>
    <div class="field">
      <span class="field-label">Project Timeline:</span>
      <span class="field-value">${formData.timeline || 'N/A'}</span>
    </div>
    <div class="field">
      <span class="field-label">Budget Range:</span>
      <span class="field-value">${formData.budgetRange || 'N/A'}</span>
    </div>
    <div class="field">
      <span class="field-label">Problem Being Solved:</span>
      <span class="field-value">${formData.problemSolving || 'N/A'}</span>
    </div>
    <div class="field">
      <span class="field-label">Business Goals:</span>
      <ul>
        ${formData.businessGoals.filter(g => g).map(goal => `<li>${goal}</li>`).join('') || '<li>N/A</li>'}
      </ul>
    </div>
    <div class="field">
      <span class="field-label">Primary Users:</span>
      <span class="field-value">${formData.primaryUsers || 'N/A'}</span>
    </div>
  </div>

  <div class="section">
    <h2>Core Global Entities</h2>
    <h3>Users & Authentication</h3>
    <div class="field">
      <span class="field-label">Need User Accounts:</span>
      <span class="field-value">${formData.needUsers ? 'Yes' : 'No'}</span>
    </div>
    ${formData.needUsers && formData.authMethods.length > 0 ? `
    <div class="field">
      <span class="field-label">Authentication Methods:</span>
      <ul class="checkbox-list">
        ${formData.authMethods.map(method => `<li>${method}</li>`).join('')}
      </ul>
    </div>
    ` : ''}
    ${formData.needUsers && formData.userRoles.length > 0 ? `
    <div class="field">
      <span class="field-label">User Roles:</span>
      <ul class="checkbox-list">
        ${formData.userRoles.map(role => `<li>${role}</li>`).join('')}
      </ul>
    </div>
    ` : ''}

    <h3>Customers</h3>
    <div class="field">
      <span class="field-label">Need Customer Database:</span>
      <span class="field-value">${formData.needCustomers ? 'Yes' : 'No'}</span>
    </div>
    ${formData.needCustomers && formData.customerType ? `
    <div class="field">
      <span class="field-label">Customer Type:</span>
      <span class="field-value">${formData.customerType}</span>
    </div>
    ` : ''}

    <h3>Other Entities</h3>
    <div class="field">
      <span class="field-label">Need Employee Database:</span>
      <span class="field-value">${formData.needEmployees ? 'Yes' : 'No'}</span>
    </div>
    <div class="field">
      <span class="field-label">Need Vendor Database:</span>
      <span class="field-value">${formData.needVendors ? 'Yes' : 'No'}</span>
    </div>
    <div class="field">
      <span class="field-label">Need Departments/Teams:</span>
      <span class="field-value">${formData.needDepartments ? 'Yes' : 'No'}</span>
    </div>
    <div class="field">
      <span class="field-label">Need Locations:</span>
      <span class="field-value">${formData.needLocations ? 'Yes' : 'No'}</span>
    </div>
    <div class="field">
      <span class="field-label">Need Product Catalog:</span>
      <span class="field-value">${formData.needProductCatalog ? 'Yes' : 'No'}</span>
    </div>
    <div class="field">
      <span class="field-label">Need Service Catalog:</span>
      <span class="field-value">${formData.needServiceCatalog ? 'Yes' : 'No'}</span>
    </div>
  </div>

  <div class="section">
    <h2>Feature Modules</h2>
    ${formData.projectMgmtFeatures.length > 0 ? `
    <div class="field">
      <span class="field-label">Project Management:</span>
      <ul class="checkbox-list">
        ${formData.projectMgmtFeatures.map(f => `<li>${f}</li>`).join('')}
      </ul>
    </div>
    ` : ''}
    ${formData.docMgmtFeatures.length > 0 ? `
    <div class="field">
      <span class="field-label">Document Management:</span>
      <ul class="checkbox-list">
        ${formData.docMgmtFeatures.map(f => `<li>${f}</li>`).join('')}
      </ul>
    </div>
    ` : ''}
    ${formData.financialFeatures.length > 0 ? `
    <div class="field">
      <span class="field-label">Financial Management:</span>
      <ul class="checkbox-list">
        ${formData.financialFeatures.map(f => `<li>${f}</li>`).join('')}
      </ul>
    </div>
    ` : ''}
    ${formData.commFeatures.length > 0 ? `
    <div class="field">
      <span class="field-label">Communication & Collaboration:</span>
      <ul class="checkbox-list">
        ${formData.commFeatures.map(f => `<li>${f}</li>`).join('')}
      </ul>
    </div>
    ` : ''}
    ${formData.reportingFeatures.length > 0 ? `
    <div class="field">
      <span class="field-label">Reporting & Analytics:</span>
      <ul class="checkbox-list">
        ${formData.reportingFeatures.map(f => `<li>${f}</li>`).join('')}
      </ul>
    </div>
    ` : ''}
    ${formData.integrations.length > 0 ? `
    <div class="field">
      <span class="field-label">Integrations:</span>
      <ul class="checkbox-list">
        ${formData.integrations.map(i => `<li>${i}</li>`).join('')}
      </ul>
    </div>
    ` : ''}
  </div>

  <div class="section">
    <h2>Industry-Specific Modules</h2>
    ${formData.constructionModules.length > 0 ? `
    <div class="field">
      <span class="field-label">Construction:</span>
      <ul class="checkbox-list">
        ${formData.constructionModules.map(m => `<li>${m}</li>`).join('')}
      </ul>
    </div>
    ` : ''}
    ${formData.serviceModules.length > 0 ? `
    <div class="field">
      <span class="field-label">Service Business:</span>
      <ul class="checkbox-list">
        ${formData.serviceModules.map(m => `<li>${m}</li>`).join('')}
      </ul>
    </div>
    ` : ''}
    ${formData.crmModules.length > 0 ? `
    <div class="field">
      <span class="field-label">Sales/CRM:</span>
      <ul class="checkbox-list">
        ${formData.crmModules.map(m => `<li>${m}</li>`).join('')}
      </ul>
    </div>
    ` : ''}
    ${formData.otherIndustryNeeds ? `
    <div class="field">
      <span class="field-label">Other Industry Needs:</span>
      <span class="field-value">${formData.otherIndustryNeeds}</span>
    </div>
    ` : ''}
  </div>

  <div class="section">
    <h2>Technical Requirements</h2>
    ${formData.accessModel ? `
    <div class="field">
      <span class="field-label">Access Model:</span>
      <span class="field-value">${formData.accessModel}</span>
    </div>
    ` : ''}
    ${formData.mobileRequirements.length > 0 ? `
    <div class="field">
      <span class="field-label">Mobile Requirements:</span>
      <ul class="checkbox-list">
        ${formData.mobileRequirements.map(r => `<li>${r}</li>`).join('')}
      </ul>
    </div>
    ` : ''}
    <div class="field">
      <span class="field-label">Email Notifications:</span>
      <span class="field-value">${formData.emailNotifications ? 'Yes' : 'No'}</span>
    </div>
    ${formData.customization.length > 0 ? `
    <div class="field">
      <span class="field-label">Customization Needs:</span>
      <ul class="checkbox-list">
        ${formData.customization.map(c => `<li>${c}</li>`).join('')}
      </ul>
    </div>
    ` : ''}
  </div>

  <div class="section">
    <h2>Deployment & Hosting</h2>
    ${formData.hostingPreference ? `
    <div class="field">
      <span class="field-label">Hosting Preference:</span>
      <span class="field-value">${formData.hostingPreference}</span>
    </div>
    ` : ''}
    ${formData.domainType ? `
    <div class="field">
      <span class="field-label">Domain Type:</span>
      <span class="field-value">${formData.domainType}</span>
    </div>
    ` : ''}
    ${formData.securityRequirements.length > 0 ? `
    <div class="field">
      <span class="field-label">Security Requirements:</span>
      <ul class="checkbox-list">
        ${formData.securityRequirements.map(s => `<li>${s}</li>`).join('')}
      </ul>
    </div>
    ` : ''}
  </div>

  <div class="section">
    <h2>Data Migration</h2>
    ${formData.dataToImport.length > 0 ? `
    <div class="field">
      <span class="field-label">Data to Import:</span>
      <ul class="checkbox-list">
        ${formData.dataToImport.map(d => `<li>${d}</li>`).join('')}
      </ul>
    </div>
    ` : ''}
    ${formData.sourceSystem ? `
    <div class="field">
      <span class="field-label">Source System:</span>
      <span class="field-value">${formData.sourceSystem}</span>
    </div>
    ` : ''}
    ${formData.dataFormat ? `
    <div class="field">
      <span class="field-label">Data Format:</span>
      <span class="field-value">${formData.dataFormat}</span>
    </div>
    ` : ''}
  </div>

  <div class="section">
    <h2>Training & Support</h2>
    ${formData.trainingNeeds.length > 0 ? `
    <div class="field">
      <span class="field-label">Training Needs:</span>
      <ul class="checkbox-list">
        ${formData.trainingNeeds.map(t => `<li>${t}</li>`).join('')}
      </ul>
    </div>
    ` : ''}
    ${formData.usersNeedingTraining ? `
    <div class="field">
      <span class="field-label">Users Needing Training:</span>
      <span class="field-value">${formData.usersNeedingTraining}</span>
    </div>
    ` : ''}
    ${formData.supportNeeds.length > 0 ? `
    <div class="field">
      <span class="field-label">Support Needs:</span>
      <ul class="checkbox-list">
        ${formData.supportNeeds.map(s => `<li>${s}</li>`).join('')}
      </ul>
    </div>
    ` : ''}
  </div>

  <div class="section">
    <h2>Success Metrics & Launch</h2>
    ${formData.successMetrics.filter(m => m).length > 0 ? `
    <div class="field">
      <span class="field-label">Success Metrics:</span>
      <ul>
        ${formData.successMetrics.filter(m => m).map(m => `<li>${m}</li>`).join('')}
      </ul>
    </div>
    ` : ''}
    ${formData.launchCriteria.filter(c => c).length > 0 ? `
    <div class="field">
      <span class="field-label">Launch Criteria:</span>
      <ul>
        ${formData.launchCriteria.filter(c => c).map(c => `<li>${c}</li>`).join('')}
      </ul>
    </div>
    ` : ''}
    ${formData.phase2Features.filter(f => f).length > 0 ? `
    <div class="field">
      <span class="field-label">Phase 2 Features:</span>
      <ul>
        ${formData.phase2Features.filter(f => f).map(f => `<li>${f}</li>`).join('')}
      </ul>
    </div>
    ` : ''}
    ${formData.specialConsiderations ? `
    <div class="field">
      <span class="field-label">Special Considerations:</span>
      <span class="field-value">${formData.specialConsiderations}</span>
    </div>
    ` : ''}
    ${formData.knownChallenges ? `
    <div class="field">
      <span class="field-label">Known Challenges:</span>
      <span class="field-value">${formData.knownChallenges}</span>
    </div>
    ` : ''}
    ${formData.referenceSystems ? `
    <div class="field">
      <span class="field-label">Reference Systems:</span>
      <span class="field-value">${formData.referenceSystems}</span>
    </div>
    ` : ''}
    ${formData.dealBreakers ? `
    <div class="field">
      <span class="field-label">Deal Breakers:</span>
      <span class="field-value">${formData.dealBreakers}</span>
    </div>
    ` : ''}
  </div>

</body>
</html>
  `;
}

module.exports = router;
