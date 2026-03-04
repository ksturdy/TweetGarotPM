/**
 * Sell Sheet PDF HTML Generator
 * Two layouts: full_width (like Fabrication example) and two_column (like Industrial Piping example)
 */

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function getImageSrc(image) {
  if (image.image_url) return image.image_url;
  const filePath = image.file_path || '';
  if (filePath.startsWith('http')) return filePath;
  return filePath;
}

function generateSellSheetPdfHtml(sellSheet, images = [], logoBase64 = '') {
  const layout = sellSheet.layout_style || 'full_width';
  if (layout === 'two_column') {
    return generateTwoColumnHtml(sellSheet, images, logoBase64);
  }
  return generateFullWidthHtml(sellSheet, images, logoBase64);
}

/* ============================================================
   SHARED STYLES
   ============================================================ */

const primaryColor = '#1e3a5f';
const accentColor = '#3b82f6';

function sharedStyles() {
  return `
    @page { margin: 0.5in; size: letter; }
    * { box-sizing: border-box; }
    body {
      font-family: Arial, Helvetica, sans-serif;
      color: #1a1a1a;
      line-height: 1.6;
      font-size: 10pt;
      margin: 0;
      padding: 0;
    }
    .header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 20px;
      border-bottom: 3px solid ${primaryColor};
      padding-bottom: 15px;
    }
    .header-left h1 {
      font-size: 22pt;
      font-weight: bold;
      margin: 0 0 4px 0;
      color: ${primaryColor};
    }
    .header-left .subtitle {
      font-size: 11pt;
      margin: 0;
      color: #666;
    }
    .header-right { text-align: right; max-width: 180px; }
    .logo { width: 160px; height: auto; max-height: 70px; object-fit: contain; }
    .content-section {
      margin-bottom: 16px;
      page-break-inside: avoid;
    }
    .content-section h2 {
      font-size: 14pt;
      font-weight: 700;
      color: ${primaryColor};
      border-bottom: 2px solid #e5e7eb;
      padding-bottom: 6px;
      margin: 0 0 10px 0;
    }
    .rich-content { font-size: 10pt; line-height: 1.6; color: #374151; }
    .rich-content p { margin: 0 0 8px 0; }
    .rich-content ul, .rich-content ol { margin: 4px 0 8px 0; padding-left: 20px; }
    .rich-content li { margin-bottom: 4px; }
    .rich-content h1 { font-size: 16pt; font-weight: 700; color: ${primaryColor}; margin: 16px 0 8px 0; }
    .rich-content h2 { font-size: 13pt; font-weight: 700; color: ${primaryColor}; margin: 14px 0 6px 0; border: none; padding: 0; }
    .rich-content h3 { font-size: 11pt; font-weight: 700; color: ${primaryColor}; margin: 12px 0 6px 0; }
    .rich-content strong { font-weight: 700; }
    .hero-image { margin-bottom: 16px; }
    .hero-image img { width: 100%; max-height: 250px; object-fit: cover; border-radius: 4px; }
    .image-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin-bottom: 16px; }
    .image-grid img { width: 100%; height: 140px; object-fit: cover; border-radius: 4px; }
    .logo-area { padding: 0 40px 12px 40px; text-align: right; }
    .logo-area img { width: 140px; height: auto; max-height: 60px; object-fit: contain; }
    .page-break { page-break-before: always; }
  `;
}

/* ============================================================
   FULL-WIDTH LAYOUT (like Mechanical Fabrication example)
   ============================================================ */

function generateFullWidthHtml(sellSheet, images, logoBase64) {
  const heroImage = images.find(img => img.is_hero_image);
  const otherImages = images.filter(img => !img.is_hero_image).slice(0, 6);

  let page1Images = '';
  if (heroImage) {
    page1Images += `<div class="hero-image"><img src="${getImageSrc(heroImage)}" alt="" /></div>`;
  }
  if (otherImages.length > 0 && otherImages.length <= 3) {
    page1Images += '<div class="image-grid">';
    for (const img of otherImages) {
      page1Images += `<img src="${getImageSrc(img)}" alt="${escapeHtml(img.caption || '')}" />`;
    }
    page1Images += '</div>';
  }

  let page2Html = '';
  if (sellSheet.page2_content) {
    let page2Images = '';
    if (otherImages.length > 3) {
      page2Images = '<div class="image-grid">';
      for (const img of otherImages.slice(3, 6)) {
        page2Images += `<img src="${getImageSrc(img)}" alt="${escapeHtml(img.caption || '')}" />`;
      }
      page2Images += '</div>';
    }

    page2Html = `
    <div class="page-break"></div>
    <div class="header">
      <div class="header-left">
        <h1>${escapeHtml(sellSheet.title || sellSheet.service_name)}</h1>
      </div>
      ${logoBase64 ? `<div class="header-right"><img class="logo" src="${logoBase64}" alt="Logo" /></div>` : ''}
    </div>
    <div class="rich-content">${sellSheet.page2_content}</div>
    ${page2Images}
    `;
  }

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    ${sharedStyles()}
  </style>
</head>
<body>

  <div class="header">
    <div class="header-left">
      <h1>${escapeHtml(sellSheet.title || sellSheet.service_name)}</h1>
      ${sellSheet.subtitle ? `<div class="subtitle">${escapeHtml(sellSheet.subtitle)}</div>` : ''}
    </div>
    ${logoBase64 ? `<div class="header-right"><img class="logo" src="${logoBase64}" alt="Logo" /></div>` : ''}
  </div>

  ${sellSheet.overview ? `
  <div class="content-section">
    <div class="rich-content">${sellSheet.overview}</div>
  </div>
  ` : ''}

  ${page1Images}

  ${sellSheet.content ? `
  <div class="content-section">
    <div class="rich-content">${sellSheet.content}</div>
  </div>
  ` : ''}

  ${page2Html}

  ${logoBase64 ? `<div class="logo-area"><img src="${logoBase64}" alt="Logo" /></div>` : ''}

</body>
</html>`;
}

/* ============================================================
   TWO-COLUMN LAYOUT (like Industrial Piping example)
   ============================================================ */

function generateTwoColumnHtml(sellSheet, images, logoBase64) {
  const heroImage = images.find(img => img.is_hero_image);
  const otherImages = images.filter(img => !img.is_hero_image).slice(0, 6);

  let contentImages = '';
  if (heroImage) {
    contentImages += `<div class="hero-image" style="margin: 12px 0;"><img src="${getImageSrc(heroImage)}" alt="" style="max-height: 180px;" /></div>`;
  }
  if (otherImages.length > 0 && otherImages.length <= 2) {
    for (const img of otherImages) {
      contentImages += `<img src="${getImageSrc(img)}" alt="${escapeHtml(img.caption || '')}" style="width: 100%; max-height: 160px; object-fit: cover; border-radius: 4px; margin: 8px 0;" />`;
    }
  }

  let page2Html = '';
  if (sellSheet.page2_content) {
    let page2Images = '';
    if (otherImages.length > 2) {
      page2Images = '<div class="image-grid">';
      for (const img of otherImages.slice(2, 5)) {
        page2Images += `<img src="${getImageSrc(img)}" alt="${escapeHtml(img.caption || '')}" />`;
      }
      page2Images += '</div>';
    }

    page2Html = `
    <div class="page-break"></div>
    <div class="header">
      <div class="header-left">
        <h1>${escapeHtml(sellSheet.title || sellSheet.service_name)}</h1>
      </div>
      ${logoBase64 ? `<div class="header-right"><img class="logo" src="${logoBase64}" alt="Logo" /></div>` : ''}
    </div>
    <div class="rich-content">${sellSheet.page2_content}</div>
    ${page2Images}
    `;
  }

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    ${sharedStyles()}
    .two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; }
    .two-col .left-col { }
    .two-col .right-col { }
    .sidebar-title {
      font-size: 14pt;
      font-weight: 700;
      color: ${primaryColor};
      border-bottom: 2px solid #e5e7eb;
      padding-bottom: 6px;
      margin: 0 0 10px 0;
    }
  </style>
</head>
<body>

  <div class="header">
    <div class="header-left">
      <h1>${escapeHtml(sellSheet.title || sellSheet.service_name)}</h1>
      ${sellSheet.subtitle ? `<div class="subtitle">${escapeHtml(sellSheet.subtitle)}</div>` : ''}
    </div>
    ${logoBase64 ? `<div class="header-right"><img class="logo" src="${logoBase64}" alt="Logo" /></div>` : ''}
  </div>

  <div class="two-col">
    <div class="left-col">
      ${sellSheet.overview ? `
      <div class="content-section">
        <h2>Overview</h2>
        <div class="rich-content">${sellSheet.overview}</div>
      </div>
      ` : ''}

      ${contentImages}

      ${sellSheet.content ? `
      <div class="content-section">
        <div class="rich-content">${sellSheet.content}</div>
      </div>
      ` : ''}
    </div>

    <div class="right-col">
      ${sellSheet.sidebar_content ? `
      <div class="content-section">
        <h2>Service Offerings</h2>
        <div class="rich-content">${sellSheet.sidebar_content}</div>
      </div>
      ` : ''}
    </div>
  </div>

  ${page2Html}

  ${logoBase64 ? `<div class="logo-area"><img src="${logoBase64}" alt="Logo" /></div>` : ''}

</body>
</html>`;
}

module.exports = { generateSellSheetPdfHtml };
