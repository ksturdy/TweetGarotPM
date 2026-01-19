const fs = require('fs').promises;
const pdfParse = require('pdf-parse');

/**
 * Extract text from PDF with page number mapping
 * @param {string} filePath - Path to the PDF file
 * @returns {Promise<{fullText: string, pageTexts: Array<{page: number, text: string}>}>}
 */
async function extractPDFText(filePath) {
  try {
    const dataBuffer = await fs.readFile(filePath);
    const data = await pdfParse(dataBuffer);

    // Extract full text
    const fullText = data.text;

    // Try to split text by pages (pdf-parse provides page info)
    const pageTexts = [];

    // pdf-parse doesn't always provide clean page breaks, so we'll use a workaround
    // We'll re-parse with custom render function to track pages
    const pdfData = await pdfParse(dataBuffer, {
      pagerender: (pageData) => {
        return pageData.getTextContent().then((textContent) => {
          const page = pageData.pageNumber;
          const pageText = textContent.items
            .map((item) => item.str)
            .join(' ')
            .trim();

          pageTexts.push({
            page,
            text: pageText,
          });

          return pageText;
        });
      },
    });

    return {
      fullText: pdfData.text,
      numPages: pdfData.numpages,
      pageTexts,
    };
  } catch (error) {
    console.error('Error extracting PDF text:', error);
    throw new Error(`Failed to extract PDF text: ${error.message}`);
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
      pageTexts: null, // Text files don't have pages
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
