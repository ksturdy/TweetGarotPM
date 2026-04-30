/**
 * Pattern-based discipline classifier for construction drawing pages.
 * Uses standard drawing number prefixes (M=Mechanical, P=Plumbing, etc.)
 * to classify pages instantly without AI.
 */

// Drawing number prefix → discipline mapping
// Order matters: more specific prefixes first
const PREFIX_RULES = [
  { pattern: /\bFP[-\s]?\d/i,        discipline: 'Fire Protection' },
  { pattern: /\bSM[-\s]?\d/i,        discipline: 'Sheet Metal' },
  { pattern: /\bM[-\s]?\d/i,         discipline: 'Mechanical' },
  { pattern: /\bP[-\s]?\d/i,         discipline: 'Plumbing' },
  { pattern: /\bE[-\s]?\d/i,         discipline: 'Electrical' },
  { pattern: /\bA[-\s]?\d/i,         discipline: 'Architectural' },
  { pattern: /\bS[-\s]?\d/i,         discipline: 'Structural' },
  { pattern: /\bC[-\s]?\d/i,         discipline: 'Civil' },
  { pattern: /\bG[-\s]?\d/i,         discipline: 'General' },
  { pattern: /\bL[-\s]?\d/i,         discipline: 'Landscape' },
  { pattern: /\bT[-\s]?\d/i,         discipline: 'Specifications' },
];

// Keyword fallbacks for pages without clear drawing numbers
const KEYWORD_RULES = [
  { keywords: ['cover sheet', 'table of contents', 'drawing index', 'abbreviations', 'legend', 'general notes'], discipline: 'General' },
  { keywords: ['hvac', 'ductwork', 'air handling', 'mechanical schedule', 'equipment schedule', 'diffuser', 'vav', 'ahu'], discipline: 'Mechanical' },
  { keywords: ['plumbing', 'drainage', 'sanitary', 'water heater', 'fixture schedule', 'domestic water'], discipline: 'Plumbing' },
  { keywords: ['electrical', 'panel schedule', 'lighting', 'power plan', 'receptacle', 'switchgear'], discipline: 'Electrical' },
  { keywords: ['floor plan', 'elevation', 'building section', 'wall section', 'door schedule', 'finish schedule', 'reflected ceiling'], discipline: 'Architectural' },
  { keywords: ['foundation', 'framing', 'structural', 'steel', 'footing', 'beam schedule', 'column schedule'], discipline: 'Structural' },
  { keywords: ['site plan', 'grading', 'civil', 'storm', 'erosion control', 'utility plan'], discipline: 'Civil' },
  { keywords: ['sprinkler', 'fire protection', 'fire alarm', 'standpipe'], discipline: 'Fire Protection' },
  { keywords: ['sheet metal', 'duct fabrication'], discipline: 'Sheet Metal' },
];

/**
 * Extract the most likely drawing number from page text.
 * Looks for patterns like M-101, A1.01, P-201, S101, etc.
 */
function extractDrawingNumber(text) {
  if (!text) return null;

  // Common formats: M-101, M101, M 101, A1.01, A-1.01, FP-101
  const patterns = [
    /\b(FP|SM)[-\s.]?\d[\d.]+/i,        // Two-letter prefixes first
    /\b([AMPSECGLT])[-\s.]?\d[\d.]+/i,   // Single-letter prefixes
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      return match[0].trim().toUpperCase();
    }
  }
  return null;
}

/**
 * Extract a likely sheet title from page text.
 * Looks for common title patterns near the drawing number.
 */
function extractTitle(text) {
  if (!text || text.length < 10) return null;

  // Try to find title-like text (usually ALL CAPS phrases of 3+ words)
  const titleMatch = text.match(/(?:^|\n)\s*([A-Z][A-Z\s&/,.-]{10,60}?)(?:\n|$)/m);
  if (titleMatch) {
    const title = titleMatch[1].trim();
    // Filter out things that are clearly not titles
    if (title.length > 10 && !title.match(/^\d/) && !title.match(/^(COPYRIGHT|SHEET|SCALE|DATE|DRAWN|CHECKED)/)) {
      return title;
    }
  }
  return null;
}

/**
 * Classify a single page by discipline using pattern matching.
 * @param {number} pageNumber
 * @param {string} text - Extracted text from the page
 * @returns {{ discipline: string, confidence: number, drawing_number: string|null, title: string|null }}
 */
function classifyPage(pageNumber, text) {
  if (!text || text.trim().length < 5) {
    return { discipline: 'Unknown', confidence: 0.1, drawing_number: null, title: null };
  }

  const drawingNumber = extractDrawingNumber(text);
  const title = extractTitle(text);

  // Primary: match by drawing number prefix
  if (drawingNumber) {
    for (const rule of PREFIX_RULES) {
      if (rule.pattern.test(drawingNumber)) {
        return {
          discipline: rule.discipline,
          confidence: 0.95,
          drawing_number: drawingNumber,
          title,
        };
      }
    }
  }

  // Secondary: match by drawing number in full text (first 500 chars)
  const headerText = text.substring(0, 500);
  for (const rule of PREFIX_RULES) {
    if (rule.pattern.test(headerText)) {
      const inlineMatch = headerText.match(rule.pattern);
      return {
        discipline: rule.discipline,
        confidence: 0.85,
        drawing_number: inlineMatch ? inlineMatch[0].trim().toUpperCase() : drawingNumber,
        title,
      };
    }
  }

  // Tertiary: keyword matching on full text
  const lowerText = text.toLowerCase();
  for (const rule of KEYWORD_RULES) {
    const matchCount = rule.keywords.filter(kw => lowerText.includes(kw)).length;
    if (matchCount >= 2) {
      return {
        discipline: rule.discipline,
        confidence: 0.7,
        drawing_number: drawingNumber,
        title,
      };
    }
    if (matchCount === 1) {
      return {
        discipline: rule.discipline,
        confidence: 0.5,
        drawing_number: drawingNumber,
        title,
      };
    }
  }

  return { discipline: 'Unknown', confidence: 0.2, drawing_number: drawingNumber, title };
}

/**
 * Classify all pages in a drawing set.
 * @param {Array<{page: number, text: string}>} pageTexts
 * @returns {Array<{page_number: number, discipline: string, confidence: number, drawing_number: string|null, title: string|null, ai_classified: boolean}>}
 */
function classifyAllPages(pageTexts) {
  return pageTexts.map(pt => {
    const result = classifyPage(pt.page, pt.text);
    return {
      page_number: pt.page,
      discipline: result.discipline,
      confidence: result.confidence,
      drawing_number: result.drawing_number,
      title: result.title,
      ai_classified: false,
    };
  });
}

module.exports = {
  classifyPage,
  classifyAllPages,
  extractDrawingNumber,
};
