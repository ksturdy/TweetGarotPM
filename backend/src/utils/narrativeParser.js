const mammoth = require('mammoth');
const pdfParse = require('pdf-parse');

// Cap at ~6000 chars (~1500 tokens) to keep well within Claude's context budget
const NARRATIVE_CHAR_LIMIT = 6000;

const ALLOWED_EXTENSIONS = ['.pdf', '.docx', '.txt'];

/**
 * Extract plain text from an uploaded design narrative file buffer.
 * Returns truncated text ready to inject into a prompt.
 * Throws a descriptive error for unsupported formats, unreadable files, or empty content.
 */
async function parseNarrative(buffer, mimeType, originalName) {
  const ext = originalName.split('.').pop().toLowerCase();
  let text = '';

  if (ext === 'pdf' || mimeType === 'application/pdf') {
    const result = await pdfParse(buffer);
    text = result.text || '';
    if (!text.trim()) {
      throw new Error(
        'The uploaded PDF appears to be a scanned image with no text layer. ' +
        'Please upload a text-based PDF or a DOCX/TXT version.'
      );
    }
  } else if (
    ext === 'docx' ||
    mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ) {
    const result = await mammoth.extractRawText({ buffer });
    text = result.value || '';
    if (!text.trim()) {
      throw new Error(
        'The uploaded DOCX file appears to contain no readable text. ' +
        'Please check the document and try again.'
      );
    }
  } else if (ext === 'txt' || mimeType === 'text/plain') {
    text = buffer.toString('utf-8');
  } else {
    throw new Error(
      `Unsupported file format ".${ext}". Please upload a PDF, DOCX, or TXT file.`
    );
  }

  // Normalize whitespace
  text = text.replace(/\r\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();

  // Truncate to char limit at a sentence boundary
  if (text.length > NARRATIVE_CHAR_LIMIT) {
    let truncated = text.slice(0, NARRATIVE_CHAR_LIMIT);
    const lastPeriod = truncated.lastIndexOf('.');
    if (lastPeriod > NARRATIVE_CHAR_LIMIT * 0.8) {
      truncated = truncated.slice(0, lastPeriod + 1);
    }
    text = truncated + '\n\n[Document truncated — first portion shown above]';
  }

  return text;
}

module.exports = { parseNarrative, ALLOWED_EXTENSIONS };
