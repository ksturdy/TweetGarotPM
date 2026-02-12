const DEFAULT_SECTIONS = [
  { key: 'company_info', label: 'Company Information', visible: true, order: 1, column: 'left' },
  { key: 'project_info', label: 'Project Information', visible: true, order: 2, column: 'left' },
  { key: 'executive_summary', label: 'Executive Summary', visible: true, order: 3, column: 'right' },
  { key: 'challenge', label: 'Challenge', visible: true, order: 4, column: 'right' },
  { key: 'solution', label: 'Our Solution', visible: true, order: 5, column: 'right' },
  { key: 'results', label: 'Results', visible: true, order: 6, column: 'right' },
  { key: 'metrics', label: 'Key Metrics', visible: true, order: 7 },
  { key: 'images', label: 'Project Photos', visible: true, order: 8 },
  { key: 'services_provided', label: 'Services Provided', visible: true, order: 9, column: 'right' }
];

// Fallback column for old templates that don't have column property
const DEFAULT_COLUMN = {
  company_info: 'left',
  project_info: 'left',
  executive_summary: 'left',
  services_provided: 'left',
  challenge: 'right',
  solution: 'right',
  results: 'right',
};

function generateCaseStudyPdfHtml(caseStudy, template = null, images = [], logoBase64 = '', customerLogoUrl = '') {
  const layoutStyle = template?.layout_config?.layout_style || 'standard';

  if (layoutStyle === 'magazine') {
    return generateMagazineHtml(caseStudy, template, images, logoBase64, customerLogoUrl);
  }
  return generateStandardHtml(caseStudy, template, images, logoBase64);
}

/* ============================================================
   SHARED HELPERS
   ============================================================ */

function formatDate(dateString) {
  if (!dateString) return '';
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric', month: 'long', day: 'numeric'
  });
}

function formatCurrency(value) {
  if (!value) return '';
  return '$' + Number(value).toLocaleString('en-US', { maximumFractionDigits: 0 });
}

function formatNumber(value) {
  if (!value) return '';
  return Number(value).toLocaleString('en-US');
}

function getImageSrc(image) {
  if (image.image_url) {
    if (image.image_url.startsWith('http')) return image.image_url;
    return image.image_url;
  }
  const filePath = image.file_path || '';
  if (filePath.startsWith('http')) return filePath;
  const normalized = filePath.replace(/\\/g, '/');
  const idx = normalized.indexOf('uploads/');
  if (idx !== -1) {
    return 'file:///' + normalized;
  }
  return filePath;
}

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/* ============================================================
   STANDARD LAYOUT (original sequential sections)
   ============================================================ */

function generateStandardHtml(caseStudy, template, images, logoBase64) {
  const layoutSections = template?.layout_config?.sections || DEFAULT_SECTIONS;
  const visibleSections = layoutSections
    .filter(s => s.visible)
    .sort((a, b) => a.order - b.order);

  const showImages = template ? template.show_images : true;
  const showMetrics = template ? template.show_metrics : true;
  const showLogo = template ? template.show_logo : true;

  // Check if this template has a separate company_info section
  const hasCompanySection = layoutSections.some(s => s.key === 'company_info');

  const sectionRenderers = {
    company_info: (label) => {
      const fields = [];
      if (caseStudy.customer_name) fields.push(`<div class="info-item"><span class="info-label">Customer</span><span class="info-value">${escapeHtml(caseStudy.customer_name)}</span></div>`);
      if (caseStudy.project_name) fields.push(`<div class="info-item"><span class="info-label">Project</span><span class="info-value">${escapeHtml(caseStudy.project_name)}</span></div>`);
      if (fields.length === 0) return '';
      return `
        <div class="section">
          <div class="section-title">${escapeHtml(label)}</div>
          <div class="info-grid" style="grid-template-columns: 1fr 1fr;">${fields.join('')}</div>
        </div>`;
    },

    project_info: (label) => {
      const fields = [];
      if (!hasCompanySection) {
        if (caseStudy.customer_name) fields.push(`<div class="info-item"><span class="info-label">Customer</span><span class="info-value">${escapeHtml(caseStudy.customer_name)}</span></div>`);
        if (caseStudy.project_name) fields.push(`<div class="info-item"><span class="info-label">Project</span><span class="info-value">${escapeHtml(caseStudy.project_name)}</span></div>`);
      }
      if (caseStudy.market) fields.push(`<div class="info-item"><span class="info-label">Market</span><span class="info-value">${escapeHtml(caseStudy.market)}</span></div>`);
      if (caseStudy.project_value) fields.push(`<div class="info-item"><span class="info-label">Project Value</span><span class="info-value">${formatCurrency(caseStudy.project_value)}</span></div>`);
      if (caseStudy.project_square_footage) fields.push(`<div class="info-item"><span class="info-label">Square Footage</span><span class="info-value">${formatNumber(caseStudy.project_square_footage)} SF</span></div>`);
      if (caseStudy.project_start_date || caseStudy.project_end_date) {
        let dateStr = '';
        if (caseStudy.project_start_date) dateStr += formatDate(caseStudy.project_start_date);
        if (caseStudy.project_start_date && caseStudy.project_end_date) dateStr += ' – ';
        if (caseStudy.project_end_date) dateStr += formatDate(caseStudy.project_end_date);
        fields.push(`<div class="info-item"><span class="info-label">Project Dates</span><span class="info-value">${dateStr}</span></div>`);
      }
      if (caseStudy.construction_type) fields.push(`<div class="info-item"><span class="info-label">Construction Type</span><span class="info-value">${escapeHtml(caseStudy.construction_type)}</span></div>`);
      if (caseStudy.project_size) fields.push(`<div class="info-item"><span class="info-label">Project Size</span><span class="info-value">${escapeHtml(caseStudy.project_size)}</span></div>`);
      if (fields.length === 0) return '';
      return `
        <div class="section">
          <div class="section-title">${escapeHtml(label)}</div>
          <div class="info-grid">${fields.join('')}</div>
        </div>`;
    },

    executive_summary: (label) => {
      if (!caseStudy.executive_summary) return '';
      return `
        <div class="section">
          <div class="section-title">${escapeHtml(label)}</div>
          <div class="content">${caseStudy.executive_summary}</div>
        </div>`;
    },

    challenge: (label) => {
      if (!caseStudy.challenge) return '';
      return `
        <div class="section">
          <div class="section-title">${escapeHtml(label)}</div>
          <div class="content">${caseStudy.challenge}</div>
        </div>`;
    },

    solution: (label) => {
      if (!caseStudy.solution) return '';
      return `
        <div class="section">
          <div class="section-title">${escapeHtml(label)}</div>
          <div class="content">${caseStudy.solution}</div>
        </div>`;
    },

    results: (label) => {
      if (!caseStudy.results) return '';
      return `
        <div class="section">
          <div class="section-title">${escapeHtml(label)}</div>
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
          <div class="section-title">${escapeHtml(label)}</div>
          <div class="metrics-grid">${metrics.join('')}</div>
        </div>`;
    },

    images: (label) => {
      if (!showImages || !images || images.length === 0) return '';
      const heroImage = images.find(img => img.is_hero_image);
      const otherImages = images.filter(img => !img.is_hero_image).slice(0, 6);

      let html = `<div class="section"><div class="section-title">${escapeHtml(label)}</div>`;
      if (heroImage) {
        html += `<div class="hero-image"><img src="${getImageSrc(heroImage)}" alt="Hero" /></div>`;
      }
      if (otherImages.length > 0) {
        html += '<div class="image-grid">';
        for (const img of otherImages) {
          html += `<div class="image-item"><img src="${getImageSrc(img)}" alt="${escapeHtml(img.caption || '')}" /></div>`;
        }
        html += '</div>';
      }
      html += '</div>';
      return html;
    },

    services_provided: (label) => {
      const services = caseStudy.services_provided;
      if (!services || services.length === 0) return '';
      const pills = services.map(s => `<span class="service-pill">${escapeHtml(s)}</span>`).join('');
      return `
        <div class="section">
          <div class="section-title">${escapeHtml(label)}</div>
          <div class="services-list">${pills}</div>
        </div>`;
    }
  };

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
    @page { margin: 0.5in; size: letter; }
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
    .header-left .subtitle { font-size: 11pt; margin: 0; color: #666; }
    .header-right { text-align: right; max-width: 160px; }
    .logo { width: 140px; height: auto; max-height: 70px; object-fit: contain; }
    .case-study-label {
      font-size: 8pt;
      text-transform: uppercase;
      letter-spacing: 2px;
      color: #999;
      margin-bottom: 6px;
    }
    .section { margin-bottom: 18px; page-break-inside: avoid; }
    .section-title {
      background-color: #1e3a5f;
      color: white;
      padding: 6px 12px;
      font-size: 11pt;
      font-weight: bold;
      margin-bottom: 10px;
      border-radius: 2px;
    }
    .content { padding: 0 4px; }
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
    .info-label {
      display: block;
      font-size: 8pt;
      color: #666;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .info-value { display: block; font-weight: 600; font-size: 10pt; }
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
    .metric-value { font-size: 20pt; font-weight: 700; }
    .metric-label { font-size: 9pt; color: #666; margin-top: 4px; }
    .hero-image { margin-bottom: 10px; }
    .hero-image img { width: 100%; max-height: 300px; object-fit: cover; border-radius: 4px; }
    .image-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
    .image-item img { width: 100%; height: 150px; object-fit: cover; border-radius: 4px; }
    .services-list { display: flex; flex-wrap: wrap; gap: 6px; }
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

/* ============================================================
   MAGAZINE LAYOUT (hero banner + two-column one-pager)
   ============================================================ */

function generateMagazineHtml(caseStudy, template, images, logoBase64, customerLogoUrl) {
  const showImages = template ? template.show_images : true;
  const showMetrics = template ? template.show_metrics : true;
  const showLogo = template ? template.show_logo : true;
  const accentColor = template?.color_scheme || '#c0392b';
  const darkColor = '#1a1a2e';

  // Build ordered visible sections
  const layoutSections = template?.layout_config?.sections || DEFAULT_SECTIONS;
  const visibleSections = [...layoutSections].filter(s => s.visible).sort((a, b) => a.order - b.order);

  // Check if this template has a separate company_info section
  const hasCompanySection = layoutSections.some(s => s.key === 'company_info');

  // Use section.column with fallback to defaults for old templates
  const getColumn = (s) => s.column || DEFAULT_COLUMN[s.key] || 'left';
  const leftSections = visibleSections.filter(s => getColumn(s) === 'left');
  const rightSections = visibleSections.filter(s => getColumn(s) === 'right');
  const showPhotos = visibleSections.some(s => s.key === 'images');

  const heroImage = images.find(img => img.is_hero_image);
  const otherImages = images.filter(img => !img.is_hero_image).slice(0, 3);
  const heroSrc = heroImage ? getImageSrc(heroImage) : '';

  // Build info items (no company/project name - those go in company_info)
  const infoItems = [];
  if (caseStudy.market) infoItems.push({ label: 'Market', value: caseStudy.market });
  if (caseStudy.construction_type) infoItems.push({ label: 'Construction Type', value: caseStudy.construction_type });
  if (caseStudy.project_size) infoItems.push({ label: 'Project Size', value: caseStudy.project_size });
  if (caseStudy.project_value) infoItems.push({ label: 'Project Value', value: formatCurrency(caseStudy.project_value) });
  if (caseStudy.project_square_footage) infoItems.push({ label: 'Square Footage', value: formatNumber(caseStudy.project_square_footage) + ' SF' });
  let dateStr = '';
  if (caseStudy.project_start_date) dateStr += formatDate(caseStudy.project_start_date);
  if (caseStudy.project_start_date && caseStudy.project_end_date) dateStr += ' – ';
  if (caseStudy.project_end_date) dateStr += formatDate(caseStudy.project_end_date);
  if (dateStr) infoItems.push({ label: 'Project Dates', value: dateStr });

  const services = caseStudy.services_provided || [];
  const servicePills = services.map(s => `<span class="service-pill">${escapeHtml(s)}</span>`).join('');

  // Metrics
  const metricsData = [];
  if (showMetrics) {
    if (caseStudy.cost_savings) metricsData.push({ value: formatCurrency(caseStudy.cost_savings), label: 'Cost Savings', color: '#10b981' });
    if (caseStudy.timeline_improvement_days) metricsData.push({ value: `${caseStudy.timeline_improvement_days} days`, label: 'Timeline Improvement', color: '#3b82f6' });
    if (caseStudy.quality_score) metricsData.push({ value: `${caseStudy.quality_score}%`, label: 'Quality Score', color: '#f59e0b' });
  }

  // Photo strip
  let photoStripHtml = '';
  if (showImages && showPhotos && otherImages.length > 0) {
    const cols = Math.min(otherImages.length, 3);
    photoStripHtml = `<div class="photo-strip" style="grid-template-columns: repeat(${cols}, 1fr);">`;
    for (const img of otherImages) {
      photoStripHtml += `<img src="${getImageSrc(img)}" alt="${escapeHtml(img.caption || '')}" />`;
    }
    photoStripHtml += '</div>';
  }

  // Unified section renderers (column assignment comes from section.column)
  const allRenderers = {
    company_info: (label) => {
      let html = '';
      if (caseStudy.project_name) {
        html += `<div class="project-name">${escapeHtml(caseStudy.project_name)}</div>`;
      }
      if (caseStudy.customer_name) {
        html += `<div class="customer-name">${escapeHtml(caseStudy.customer_name)}</div>`;
      }
      return html;
    },
    project_info: (label) => {
      let html = '';
      // If no separate company_info, include project/company name here (backward compat)
      if (!hasCompanySection) {
        if (caseStudy.project_name) {
          html += `<div class="project-name">${escapeHtml(caseStudy.project_name)}</div>`;
          if (caseStudy.customer_name) html += `<div class="customer-name">${escapeHtml(caseStudy.customer_name)}</div>`;
        }
      }
      for (const item of infoItems) {
        html += `<div class="info-row"><div class="info-dot" style="background-color:${accentColor};"></div><div class="info-content"><div class="info-label">${escapeHtml(item.label)}</div><div class="info-value">${escapeHtml(item.value)}</div></div></div>`;
      }
      return html;
    },
    services_provided: (label) => {
      if (services.length === 0) return '';
      return `<div class="services-list"><div style="width:100%;"><div class="section-header">${escapeHtml(label)}</div></div>${servicePills}</div>`;
    },
    executive_summary: (label) => {
      if (!caseStudy.executive_summary) return '';
      return `<div class="right-section"><div class="right-title">${escapeHtml(label)}</div><div class="right-content">${caseStudy.executive_summary}</div></div>`;
    },
    challenge: (label) => {
      if (!caseStudy.challenge) return '';
      return `<div class="right-section"><div class="right-title">${escapeHtml(label)}</div><div class="right-content">${caseStudy.challenge}</div></div>`;
    },
    solution: (label) => {
      if (!caseStudy.solution) return '';
      return `<div class="right-section"><div class="right-title">${escapeHtml(label)}</div><div class="right-content">${caseStudy.solution}</div></div>`;
    },
    results: (label) => {
      if (!caseStudy.results) return '';
      return `<div class="right-section"><div class="right-title">${escapeHtml(label)}</div><div class="right-content">${caseStudy.results}</div></div>`;
    },
  };

  // Build column HTML in template order
  let leftHtml = '';
  for (const s of leftSections) {
    const renderer = allRenderers[s.key];
    if (renderer) leftHtml += renderer(s.label);
  }
  let rightHtml = '';
  for (const s of rightSections) {
    const renderer = allRenderers[s.key];
    if (renderer) rightHtml += renderer(s.label);
  }

  // Metrics bar
  let metricsHtml = '';
  if (metricsData.length > 0) {
    metricsHtml = `<div class="metrics-bar" style="grid-template-columns: repeat(${metricsData.length}, 1fr);">`;
    metricsData.forEach((m, i) => {
      const border = i < metricsData.length - 1 ? 'border-right: 1px solid rgba(255,255,255,0.1);' : '';
      metricsHtml += `<div class="metric-cell" style="${border}"><div class="metric-value" style="color:${m.color};">${m.value}</div><div class="metric-label">${m.label}</div></div>`;
    });
    metricsHtml += '</div>';
  }

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    @page { margin: 0; size: letter; }
    * { box-sizing: border-box; }
    body {
      font-family: Arial, Helvetica, sans-serif;
      color: #1a1a1a; line-height: 1.5; font-size: 10pt; margin: 0; padding: 0;
    }
    .hero {
      position: relative; width: 100%;
      height: ${heroSrc ? '160px' : '110px'};
      background-color: ${darkColor}; overflow: hidden;
    }
    .hero img.hero-bg { width: 100%; height: 100%; object-fit: cover; opacity: 0.35; position: absolute; top: 0; left: 0; }
    .hero-content { position: relative; z-index: 1; padding: 30px 40px; height: 100%; display: flex; flex-direction: column; justify-content: flex-end; }
    .hero-label { font-size: 8pt; text-transform: uppercase; letter-spacing: 3px; color: ${accentColor}; margin-bottom: 8px; font-weight: 700; }
    .hero h1 { font-size: 24pt; font-weight: 900; margin: 0 0 6px 0; color: white; text-transform: uppercase; letter-spacing: 1px; }
    .hero .subtitle { font-size: 11pt; color: #ccc; font-style: italic; }
    .hero-accent { position: absolute; bottom: 0; left: 0; right: 0; height: 4px; background-color: ${accentColor}; }
    .photo-strip { display: grid; gap: 0; }
    .photo-strip img { width: 100%; height: 100px; object-fit: cover; display: block; }
    .body-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 30px; padding: 24px 40px 20px 40px; }
    .project-name { font-size: 16pt; font-weight: 800; color: ${darkColor}; line-height: 1.2; margin-bottom: 4px; }
    .customer-name { font-size: 10pt; color: #666; margin-bottom: 16px; }
    .info-row { display: flex; align-items: flex-start; margin-bottom: 10px; padding-bottom: 10px; border-bottom: 1px solid #eee; }
    .info-dot { width: 22px; height: 22px; border-radius: 50%; flex-shrink: 0; margin-right: 10px; margin-top: 2px; }
    .info-label { font-size: 7pt; text-transform: uppercase; letter-spacing: 0.8px; color: #999; font-weight: 600; }
    .info-value { font-size: 10pt; font-weight: 600; color: #333; }
    .section-header { font-size: 10pt; font-weight: 800; text-transform: uppercase; letter-spacing: 1px; color: ${darkColor}; margin-bottom: 8px; border-bottom: 2px solid ${accentColor}; padding-bottom: 4px; display: inline-block; }
    .services-list { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 14px; }
    .service-pill { display: inline-block; padding: 3px 12px; background-color: #f1f5f9; color: #334155; border-radius: 3px; font-size: 8pt; font-weight: 600; border: 1px solid #e2e8f0; }
    .right-section { margin-bottom: 18px; }
    .right-title { font-size: 14pt; font-weight: 800; text-transform: uppercase; letter-spacing: 1px; color: ${darkColor}; margin-bottom: 10px; }
    .right-content { font-size: 9pt; color: #444; line-height: 1.7; }
    .right-content p { margin: 0 0 8px 0; }
    .right-content ul, .right-content ol { margin: 4px 0; padding-left: 20px; }
    .customer-logo { position: absolute; top: 14px; right: 24px; z-index: 2; width: 70px; height: 70px; border-radius: 8px; background-color: rgba(255,255,255,0.95); display: flex; align-items: center; justify-content: center; padding: 6px; box-shadow: 0 2px 8px rgba(0,0,0,0.3); }
    .customer-logo img { max-width: 100%; max-height: 100%; object-fit: contain; }
    .customer-logo-placeholder { position: absolute; top: 14px; right: 24px; z-index: 2; width: 60px; height: 60px; border-radius: 8px; border: 2px dashed rgba(255,255,255,0.4); display: flex; align-items: center; justify-content: center; font-size: 7pt; color: rgba(255,255,255,0.5); text-align: center; line-height: 1.2; }
    .logo-area { padding: 0 40px 12px 40px; text-align: right; }
    .logo-area img { width: 140px; height: auto; max-height: 60px; object-fit: contain; }
    .metrics-bar { display: grid; background-color: ${darkColor}; margin: 0 40px 20px 40px; border-radius: 4px; overflow: hidden; }
    .metric-cell { text-align: center; padding: 14px 8px; }
    .metric-value { font-size: 18pt; font-weight: 800; }
    .metric-label { font-size: 8pt; color: #aaa; margin-top: 2px; text-transform: uppercase; letter-spacing: 0.5px; }
    .footer { padding: 8px 40px; font-size: 7pt; color: #bbb; text-align: center; border-top: 1px solid #eee; }
  </style>
</head>
<body>

  <div class="hero">
    ${heroSrc ? `<img class="hero-bg" src="${heroSrc}" alt="" />` : ''}
    <div class="hero-content">
      <div class="hero-label">Case Study</div>
      <h1>${escapeHtml(caseStudy.title)}</h1>
      ${caseStudy.subtitle ? `<div class="subtitle">${escapeHtml(caseStudy.subtitle)}</div>` : ''}
    </div>
    ${customerLogoUrl ? `<div class="customer-logo"><img src="${customerLogoUrl}" alt="Client Logo" /></div>` : `<div class="customer-logo-placeholder">Client<br/>Logo</div>`}
    <div class="hero-accent"></div>
  </div>

  ${photoStripHtml}

  <div class="body-grid">
    <div>${leftHtml}</div>
    <div>${rightHtml}</div>
  </div>

  ${metricsHtml}

  ${showLogo && logoBase64 ? `<div class="logo-area"><img src="${logoBase64}" alt="Company Logo" /></div>` : ''}

  <div class="footer">
    Generated on ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
  </div>

</body>
</html>`;
}

module.exports = { generateCaseStudyPdfHtml, DEFAULT_SECTIONS };
