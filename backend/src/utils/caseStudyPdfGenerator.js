const DEFAULT_SECTIONS = [
  { key: 'project_info', label: 'Project Information', visible: true, order: 1 },
  { key: 'executive_summary', label: 'Executive Summary', visible: true, order: 2 },
  { key: 'challenge', label: 'Challenge', visible: true, order: 3 },
  { key: 'solution', label: 'Our Solution', visible: true, order: 4 },
  { key: 'results', label: 'Results', visible: true, order: 5 },
  { key: 'metrics', label: 'Key Metrics', visible: true, order: 6 },
  { key: 'images', label: 'Project Photos', visible: true, order: 7 },
  { key: 'services_provided', label: 'Services Provided', visible: true, order: 8 }
];

function generateCaseStudyPdfHtml(caseStudy, template = null, images = [], logoBase64 = '') {
  const formatDate = (dateString) => {
    if (!dateString) return '';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric', month: 'long', day: 'numeric'
    });
  };

  const formatCurrency = (value) => {
    if (!value) return '';
    return '$' + Number(value).toLocaleString('en-US');
  };

  const formatNumber = (value) => {
    if (!value) return '';
    return Number(value).toLocaleString('en-US');
  };

  // Get sections from template or use defaults
  const layoutSections = template?.layout_config?.sections || DEFAULT_SECTIONS;
  const visibleSections = layoutSections
    .filter(s => s.visible)
    .sort((a, b) => a.order - b.order);

  const showImages = template ? template.show_images : true;
  const showMetrics = template ? template.show_metrics : true;
  const showLogo = template ? template.show_logo : true;

  // Build section HTML
  const sectionRenderers = {
    project_info: (label) => {
      const fields = [];
      if (caseStudy.customer_name) fields.push(`<div class="info-item"><span class="info-label">Customer</span><span class="info-value">${caseStudy.customer_name}</span></div>`);
      if (caseStudy.project_name) fields.push(`<div class="info-item"><span class="info-label">Project</span><span class="info-value">${caseStudy.project_name}</span></div>`);
      if (caseStudy.market) fields.push(`<div class="info-item"><span class="info-label">Market</span><span class="info-value">${caseStudy.market}</span></div>`);
      if (caseStudy.project_value) fields.push(`<div class="info-item"><span class="info-label">Project Value</span><span class="info-value">${formatCurrency(caseStudy.project_value)}</span></div>`);
      if (caseStudy.project_square_footage) fields.push(`<div class="info-item"><span class="info-label">Square Footage</span><span class="info-value">${formatNumber(caseStudy.project_square_footage)} SF</span></div>`);
      if (caseStudy.project_start_date || caseStudy.project_end_date) {
        let dateStr = '';
        if (caseStudy.project_start_date) dateStr += formatDate(caseStudy.project_start_date);
        if (caseStudy.project_start_date && caseStudy.project_end_date) dateStr += ' – ';
        if (caseStudy.project_end_date) dateStr += formatDate(caseStudy.project_end_date);
        fields.push(`<div class="info-item"><span class="info-label">Project Dates</span><span class="info-value">${dateStr}</span></div>`);
      }
      if (caseStudy.construction_type) fields.push(`<div class="info-item"><span class="info-label">Construction Type</span><span class="info-value">${caseStudy.construction_type}</span></div>`);
      if (caseStudy.project_size) fields.push(`<div class="info-item"><span class="info-label">Project Size</span><span class="info-value">${caseStudy.project_size}</span></div>`);

      if (fields.length === 0) return '';
      return `
        <div class="section">
          <div class="section-title">${label}</div>
          <div class="info-grid">${fields.join('')}</div>
        </div>`;
    },

    executive_summary: (label) => {
      if (!caseStudy.executive_summary) return '';
      return `
        <div class="section">
          <div class="section-title">${label}</div>
          <div class="content">${caseStudy.executive_summary}</div>
        </div>`;
    },

    challenge: (label) => {
      if (!caseStudy.challenge) return '';
      return `
        <div class="section">
          <div class="section-title">${label}</div>
          <div class="content">${caseStudy.challenge}</div>
        </div>`;
    },

    solution: (label) => {
      if (!caseStudy.solution) return '';
      return `
        <div class="section">
          <div class="section-title">${label}</div>
          <div class="content">${caseStudy.solution}</div>
        </div>`;
    },

    results: (label) => {
      if (!caseStudy.results) return '';
      return `
        <div class="section">
          <div class="section-title">${label}</div>
          <div class="content">${caseStudy.results}</div>
        </div>`;
    },

    metrics: (label) => {
      if (!showMetrics) return '';
      const metrics = [];
      if (caseStudy.cost_savings) {
        metrics.push(`<div class="metric-box"><div class="metric-value" style="color:#10b981;">${formatCurrency(caseStudy.cost_savings)}</div><div class="metric-label">Cost Savings</div></div>`);
      }
      if (caseStudy.timeline_improvement_days) {
        metrics.push(`<div class="metric-box"><div class="metric-value" style="color:#3b82f6;">${caseStudy.timeline_improvement_days} days</div><div class="metric-label">Timeline Improvement</div></div>`);
      }
      if (caseStudy.quality_score) {
        metrics.push(`<div class="metric-box"><div class="metric-value" style="color:#f59e0b;">${caseStudy.quality_score}%</div><div class="metric-label">Quality Score</div></div>`);
      }
      if (metrics.length === 0) return '';
      return `
        <div class="section">
          <div class="section-title">${label}</div>
          <div class="metrics-grid">${metrics.join('')}</div>
        </div>`;
    },

    images: (label) => {
      if (!showImages || !images || images.length === 0) return '';
      const heroImage = images.find(img => img.is_hero_image);
      const otherImages = images.filter(img => !img.is_hero_image).slice(0, 6);

      let html = `<div class="section"><div class="section-title">${label}</div>`;
      if (heroImage) {
        html += `<div class="hero-image"><img src="${getImageSrc(heroImage)}" alt="Hero" /></div>`;
      }
      if (otherImages.length > 0) {
        html += '<div class="image-grid">';
        for (const img of otherImages) {
          html += `<div class="image-item"><img src="${getImageSrc(img)}" alt="${img.caption || ''}" /></div>`;
        }
        html += '</div>';
      }
      html += '</div>';
      return html;
    },

    services_provided: (label) => {
      const services = caseStudy.services_provided;
      if (!services || services.length === 0) return '';
      const pills = services.map(s => `<span class="service-pill">${s}</span>`).join('');
      return `
        <div class="section">
          <div class="section-title">${label}</div>
          <div class="services-list">${pills}</div>
        </div>`;
    }
  };

  // Build sections HTML
  let sectionsHtml = '';
  for (const section of visibleSections) {
    const renderer = sectionRenderers[section.key];
    if (renderer) {
      sectionsHtml += renderer(section.label);
    }
  }

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    @page {
      margin: 0.5in;
      size: letter;
    }
    * { box-sizing: border-box; }
    body {
      font-family: Arial, Helvetica, sans-serif;
      color: #1a1a1a;
      line-height: 1.5;
      font-size: 10pt;
      margin: 0;
      padding: 0;
    }

    .header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 20px;
      border-bottom: 3px solid #1e3a5f;
      padding-bottom: 15px;
    }
    .header-left h1 {
      font-size: 20pt;
      font-weight: bold;
      margin: 0 0 4px 0;
      color: #1e3a5f;
    }
    .header-left .subtitle {
      font-size: 11pt;
      margin: 0;
      color: #666;
    }
    .header-right {
      text-align: right;
      max-width: 160px;
    }
    .logo {
      width: 140px;
      height: auto;
      max-height: 70px;
      object-fit: contain;
    }
    .case-study-label {
      font-size: 8pt;
      text-transform: uppercase;
      letter-spacing: 2px;
      color: #999;
      margin-bottom: 6px;
    }

    .section {
      margin-bottom: 18px;
      page-break-inside: avoid;
    }
    .section-title {
      background-color: #1e3a5f;
      color: white;
      padding: 6px 12px;
      font-size: 11pt;
      font-weight: bold;
      margin-bottom: 10px;
      border-radius: 2px;
    }
    .content {
      padding: 0 4px;
    }
    .content p { margin: 0 0 8px 0; }
    .content ul, .content ol { margin: 4px 0; padding-left: 20px; }

    .info-grid {
      display: grid;
      grid-template-columns: 1fr 1fr 1fr;
      gap: 8px;
      padding: 10px;
      background-color: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 4px;
    }
    .info-item { }
    .info-label {
      display: block;
      font-size: 8pt;
      color: #666;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .info-value {
      display: block;
      font-weight: 600;
      font-size: 10pt;
    }

    .metrics-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 12px;
    }
    .metric-box {
      text-align: center;
      padding: 16px 8px;
      background-color: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 6px;
    }
    .metric-value {
      font-size: 20pt;
      font-weight: 700;
    }
    .metric-label {
      font-size: 9pt;
      color: #666;
      margin-top: 4px;
    }

    .hero-image {
      margin-bottom: 10px;
    }
    .hero-image img {
      width: 100%;
      max-height: 300px;
      object-fit: cover;
      border-radius: 4px;
    }
    .image-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 8px;
    }
    .image-item img {
      width: 100%;
      height: 150px;
      object-fit: cover;
      border-radius: 4px;
    }

    .services-list {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
    }
    .service-pill {
      display: inline-block;
      padding: 4px 12px;
      background-color: #e0f2fe;
      color: #0369a1;
      border-radius: 20px;
      font-size: 9pt;
      font-weight: 500;
    }

    .footer {
      margin-top: 30px;
      padding-top: 10px;
      border-top: 1px solid #ddd;
      font-size: 8pt;
      color: #999;
      text-align: center;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="header-left">
        <div class="case-study-label">Case Study</div>
        <h1>${escapeHtml(caseStudy.title)}</h1>
        ${caseStudy.subtitle ? `<div class="subtitle">${escapeHtml(caseStudy.subtitle)}</div>` : ''}
      </div>
      ${showLogo && logoBase64 ? `
        <div class="header-right">
          <img class="logo" src="${logoBase64}" alt="Company Logo" />
        </div>
      ` : ''}
    </div>

    ${sectionsHtml}

    <div class="footer">
      Generated on ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
    </div>
  </div>
</body>
</html>`;
}

function getImageSrc(image) {
  // For PDF generation, images need to be accessible via absolute URL or file path
  const filePath = image.file_path || '';
  const normalized = filePath.replace(/\\/g, '/');
  const idx = normalized.indexOf('uploads/');
  if (idx !== -1) {
    // Return the absolute file path for Puppeteer to load locally
    return 'file:///' + normalized;
  }
  // If it's already a URL (R2), use as-is
  if (filePath.startsWith('http')) return filePath;
  return filePath;
}

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

module.exports = { generateCaseStudyPdfHtml, DEFAULT_SECTIONS };
