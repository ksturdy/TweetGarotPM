const fs = require('fs').promises;
const pdfjsLib = require('pdfjs-dist/legacy/build/pdf.mjs');

/**
 * Extract text from PDF with page number mapping
 * Uses pdfjs-dist directly for reliable Node.js support
 * @param {string} filePath - Path to the PDF file
 * @returns {Promise<{fullText: string, numPages: number, pageTexts: Array<{page: number, text: string}>}>}
 */
async function extractPDFText(filePath) {
  let doc;
  try {
    const dataBuffer = await fs.readFile(filePath);
    const data = new Uint8Array(dataBuffer);

    doc = await pdfjsLib.getDocument({ data, useSystemFonts: true }).promise;
    const numPages = doc.numPages;

    const pageTexts = [];
    const allTexts = [];

    for (let i = 1; i <= numPages; i++) {
      const page = await doc.getPage(i);
      const textContent = await page.getTextContent();
      const pageText = textContent.items
        .map((item) => item.str)
        .join(' ')
        .trim();

      pageTexts.push({ page: i, text: pageText });
      allTexts.push(pageText);
    }

    return {
      fullText: allTexts.join('\n\n'),
      numPages,
      pageTexts,
    };
  } catch (error) {
    console.error('Error extracting PDF text:', error);
    throw new Error(`Failed to extract PDF text: ${error.message}`);
  } finally {
    if (doc) doc.destroy();
  }
}

/**
 * Find the page number where a text snippet appears in a PDF
 * @param {Array<{page: number, text: string}>} pageTexts - Array of page texts
 * @param {string} searchText - Text to search for
 * @returns {number|null} - Page number (1-indexed) or null if not found
 */
function findTextPage(pageTexts, searchText) {
  if (!searchText || !pageTexts || pageTexts.length === 0) {
    return null;
  }

  const normalizedSearch = searchText.toLowerCase().trim();

  for (const pageData of pageTexts) {
    const normalizedPageText = pageData.text.toLowerCase();
    if (normalizedPageText.includes(normalizedSearch)) {
      return pageData.page;
    }
  }

  return null;
}

/**
 * Extract text from a text file
 * @param {string} filePath - Path to the text file
 * @returns {Promise<{fullText: string, pageTexts: null}>}
 */
async function extractTextFile(filePath) {
  try {
    const fullText = await fs.readFile(filePath, 'utf-8');
    return {
      fullText,
      numPages: 1,
      pageTexts: null,
    };
  } catch (error) {
    console.error('Error reading text file:', error);
    throw new Error(`Failed to read text file: ${error.message}`);
  }
}

/**
 * Extract text from any supported file type
 * @param {string} filePath - Path to the file
 * @returns {Promise<{fullText: string, numPages: number, pageTexts: Array|null}>}
 */
async function extractText(filePath) {
  const ext = filePath.toLowerCase().split('.').pop();

  if (ext === 'pdf') {
    return await extractPDFText(filePath);
  } else if (ext === 'txt') {
    return await extractTextFile(filePath);
  } else {
    throw new Error(`Unsupported file type: ${ext}`);
  }
}

module.exports = {
  extractPDFText,
  extractTextFile,
  extractText,
  findTextPage,
};
