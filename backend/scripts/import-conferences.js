/**
 * One-time import: Conference List.xlsx → trade_shows table
 * Run from backend/: node scripts/import-conferences.js
 * Uses dotenv so it targets the Render DB (same as migration runner).
 */

require('dotenv').config();
const db = require('../src/config/database');

const TENANT_ID = 1;

// Status mapping from SharePoint confirmation status
function mapStatus(confirmStatus, endDateStr) {
  const end = parseDate(endDateStr);
  const isPast = end && end < new Date('2026-08-14');

  const s = (confirmStatus || '').trim();
  if (s === 'Declined') return 'cancelled';
  if (s === 'Registered') return isPast ? 'completed' : 'registered';
  // Opportunity or blank → upcoming
  return 'upcoming';
}

// Convert M/D/YYYY → Date object
function parseDate(str) {
  if (!str || !str.trim()) return null;
  const m = str.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return null;
  return new Date(parseInt(m[3]), parseInt(m[1]) - 1, parseInt(m[2]));
}

// Convert M/D/YYYY → 'YYYY-MM-DD' string for SQL
function sqlDate(str) {
  const d = parseDate(str);
  if (!d) return null;
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

// Parse money values like "$1,750.00", "135", "TBD", "N/A", "$0", etc.
function parseMoney(str) {
  if (!str || !str.trim()) return null;
  const s = str.trim().replace(/[$,\s]/g, '');
  if (s === '' || s === '-' || s.toLowerCase() === 'tbd' || s.toLowerCase() === 'n/a') return null;
  if (s === '-' || s === '0' || s === '0.00') return 0;
  // Handle dash-only values like "$ -" or "$-"
  if (/^-+$/.test(s)) return 0;
  const n = parseFloat(s);
  return isNaN(n) ? null : n;
}

// Parse city/state from location strings like "Chicago", "Hanover, MD", "Portland, OR"
function parseLocation(loc) {
  if (!loc || !loc.trim()) return { city: null, state: null, venue: null };
  const s = loc.trim();

  // Special venue cases
  if (s === 'Resch Expo') return { city: 'Green Bay', state: 'WI', venue: 'Resch Expo' };
  if (s === 'Lambeau Field') return { city: 'Green Bay', state: 'WI', venue: 'Lambeau Field' };
  if (s === 'Lambeau') return { city: 'Green Bay', state: 'WI', venue: null };

  // "City, State" format
  const commaIdx = s.indexOf(',');
  if (commaIdx !== -1) {
    const city = s.substring(0, commaIdx).trim();
    const state = s.substring(commaIdx + 1).trim().replace(/\.$/, '').trim();
    return { city, state, venue: null };
  }

  return { city: s, state: null, venue: null };
}

// Clean up notes field (strip leading/trailing whitespace and blank lines)
function cleanNotes(str) {
  if (!str || !str.trim()) return null;
  return str.trim().replace(/\n\s*\n/g, '\n').trim() || null;
}

// Build description from Market + Event Type
function buildDescription(market, eventType) {
  const parts = [];
  if (market && market.trim()) parts.push(`Market: ${market.trim()}`);
  if (eventType && eventType.trim()) {
    const cleaned = eventType.replace(/;#/g, ' / ');
    parts.push(`Type: ${cleaned}`);
  }
  return parts.length ? parts.join('  |  ') : null;
}

// Raw data extracted from Conference List.xlsx
// Fields: [confirmStatus, startDate, endDate, title, market, eventType, location, perPersonFee, notes, attendees, boothFee, link, totalFee]
const RAW = [
  ['Opportunity','2/28/2027','3/3/2027','PDC Summit','Healthcare','Conference','New Orleans','TBD','',null,'','https://www.pdcsummit.org/',''],
  ['Registered','12/3/2026','12/4/2026','MWFPA Convention','F&B','Expo','Wisconsin Dells','','',null,'$ 1,750.00','https://www.mwfpa.org/convention','$ 1,750.00'],
  ['Opportunity','10/28/2026','10/29/2026','Chicago Build','T/G Corporate','Conference','Chicago','0','',null,'','https://www.chicagobuildexpo.com/about','$ -'],
  ['Opportunity','10/25/2026','10/28/2026','The Intersection of AI & Traditional Data Centers','T/G Corporate','Conference','San Antonio','TBD','',null,'','https://www.7x24exchange.org/conferences/future-national-conferences/',''],
  ['Registered','10/18/2026','10/21/2026','Pack Expo','F&B','Expo','Chicago','','',null,'$ 10,275.00','https://www.packexpointernational.com/','$ 10,275.00'],
  ['Opportunity','10/12/2026','10/16/2026','LCI Congress','T/G Corporate','Conference','Atlanta','$1,420','Before 9/10.',null,'','https://congress.leanconstruction.org/','$ -'],
  ['Registered','9/22/2026','9/24/2026','WHEA Conference','Healthcare','Conference;#Expo','Appleton','','',null,'$ 750.00','https://www.whea.com/annual-conference-information/','$ 750.00'],
  ['Registered','9/15/2026','9/17/2026','AU 2026','T/G Corporate','Conference','Las Vegas','$1,999','',null,'','https://conferences.autodesk.com/flow/autodesk/au2026/','$ 1,999.00'],
  ['Opportunity','9/15/2026','9/17/2026','2026 MCAA Fabrication Conference','Manufacturing','Conference','Hanover, MD','$0','',null,'','https://www.mcaa.org/fab/','$ -'],
  ['Opportunity','9/3/2026','9/3/2026','MyMichigan Golf Outing','Healthcare','Outing','Brimley, MI','$500 Foursome','',null,'','',''],
  ['Opportunity','6/10/2026','6/11/2026','Pack Expo Exhibitor Briefing','F&B','','Chicago','$0','Hotel by 5/20.',null,'','https://www.packexpointernational.com/exhibiting/exhibitor-briefing','$ -'],
  ['Declined','6/9/2026','6/9/2026','NEW North Summit','T/G Corporate','Conference','Lambeau','$95','Before 4/15.',null,'','','$ -'],
  ['Opportunity','6/7/2026','6/10/2026','Future Proofing the AI Data Center','T/G Corporate','Conference','Orlando','$2,200','Before 5/15',null,'','https://conferences.7x24exchange.org/spring2026/','$ -'],
  ['Opportunity','5/5/2026','5/7/2026','Advancing Precon','T/G Corporate','Conference','Phoenix','$2,049','',null,'','','$ -'],
  ['Registered','4/20/2026','4/21/2026','Food NW Process & Packaging Expo','F&B','Expo','Portland','','',null,'$ 5,100.00','','$ 5,100.00'],
  ['Registered','4/14/2026','4/16/2026','CheeseExpo','F&B','Expo','Milwaukee','','',null,'$ 10,200.00','https://cheeseexpo.org/','$ 10,200.00'],
  ['Registered','4/12/2026','4/14/2026','SMACNA Fab Forum','Manufacturing','Conference','Chicago','$1,095','',null,'','','$ 1,095.00'],
  ['Declined','3/24/2026','3/26/2026','AGC Annual Convention','T/G Corporate','Conference','Orlando','$1,149','$1,149 by 11/30.',null,'','https://convention.agc.org/','$ -'],
  ['Registered','3/15/2026','3/19/2026','MCAA26','T/G Corporate','Conference','Phoenix','$2,645','$3,045 after 12/31.',null,'','https://mcaaconvention.org/','$ 7,935.00'],
  ['Declined','2/25/2026','2/27/2026','Tissue World','Paper','Expo;#Conference','Miami','','',null,'','https://www.tissueworld.com/miami/en/home.html','$ -'],
  ['Opportunity','2/25/2026','2/26/2026','GBIG Showcase Expo','Paper','Conference;#Expo','Appleton','$60','',null,'','','$ -'],
  ['Registered','2/24/2026','2/24/2026','5P Showcase Expo','Paper','Expo','Green Bay','$50','',null,'','https://greenbayinnovationgroup.com/5p-showcase-expo-2026/','$ 100.00'],
  ['Registered','1/29/2026','1/30/2026','AGC-WI Annual Membership Meeting','T/G Corporate','Conference','Milwaukee','$1,950','Table of 10.',null,'','https://www.agcwi.org/annual-membership-meeting.html','$ 1,950.00'],
  ['Registered','1/27/2026','1/29/2026','IPPE - Int\'l Production & Processing Expo','F&B','Expo','Atlanta','135','',null,'','https://www.ippexpo.org/','$ 270.00'],
  ['Registered','1/26/2026','1/28/2026','MEP Innovation Conference','T/G Corporate','Conference','Austin','$0','Chris speaking.',null,'','','$ -'],
  ['Registered','12/2/2025','12/4/2025','MWFPA Conference','F&B','Conference;#Expo','Wisconsin Dells','','',null,'$ 1,700.00','https://www.mwfpa.org/convention','$ 1,700.00'],
  ['Registered','10/29/2025','10/29/2025','Manufacturing First','Manufacturing','Expo','Resch Expo','$2,645','',null,'$ 75.00','https://www.insightonbusiness.com/manufacturingfirst/','$ 75.00'],
  ['Declined','10/28/2025','10/30/2025','Eats (Formally Process Expo)','F&B','Expo','Chicago','','',null,'','https://theeatsshow.us.messefrankfurt.com/','$ -'],
  ['Declined','10/27/2025','10/29/2025','Advancing Data Center Construction','T/G Corporate','Conference','Atlanta','$1,699','By 6/27.',null,'','https://advancing-data-center-construction.com/','$ -'],
  ['Declined','10/26/2025','10/29/2025','SMACNA Annual Convention','T/G Corporate','Conference','Maui','$2,800','',null,'','https://www.smacna.org/education-events/2025-smacna-annual-convention','$ -'],
  ['Declined','10/20/2025','10/24/2025','LCI Congress','T/G Corporate','Conference','Arlington','$1,205','Before 7/31',null,'','https://congress.leanconstruction.org/','$ -'],
  ['Registered','9/29/2025','10/1/2025','Pack Expo','F&B','Expo','Las Vegas','','20\'x25\'',null,'$ 17,120.00','https://www.packexpolasvegas.com/','$ 17,120.00'],
  ['Registered','9/23/2025','9/26/2025','WHEA Conference','Healthcare','Conference;#Expo','Appleton','$240','10\'x20\'',null,'$ 700.00','https://www.whea.com/annual-conference-information/','$ 1,180.00'],
  ['Declined','9/16/2025','9/18/2025','Autodesk University','T/G Corporate','Conference','Nashville','$1,999','',null,'','https://conferences.autodesk.com/flow/autodesk/au2025/','$ -'],
  ['Declined','9/8/2025','9/8/2025','MCAA Fabrication Conference','Manufacturing','Conference','Philadelphia','','',null,'','https://www.mcaa.org/events/calendar/fab25/','$ -'],
  ['Declined','8/25/2025','8/27/2025','Advancing Construction Technology','T/G Corporate','Conference','Chicago','$1,699','Before 5/16.',null,'','https://advancing-construction-tech.com/','$ -'],
  ['Registered','8/19/2025','8/21/2025','Stratus Innovate 2025','T/G Corporate','Conference','Kansas City','$0','Chris speaking.',null,'','https://gogtp-23344813.hs-sites.com/stratus-innovate-2025','$ -'],
  ['','8/5/2025','8/7/2025','AGC Technology Conference','T/G Corporate','Conference','Chicago','$885','',null,'','','$ -'],
  ['Registered','7/16/2025','7/17/2025','AGC Summer Membership Meeting & Golf','T/G Corporate','Conference;#Outing','Wisconsin Dells','','Golf Only.',null,'','','$ -'],
  ['Declined','6/23/2025','6/25/2025','MCAA Converge','T/G Corporate','Conference','Minneapolis','N/A','',null,'','',''],
  ['Registered','6/5/2025','6/5/2025','New North Summit','T/G Corporate','Conference','Lambeau Field','$85','By 4/15.',null,'','https://newnorthsummit.com/about/','$ 85.00'],
  ['Declined','5/4/2025','5/7/2025','TAPPICon','Paper','Expo;#Conference','Minneapolis','$250','Expo only.',null,'','https://events.tappi.org/','$ -'],
  ['Declined','4/30/2025','5/7/2025','LCI Lean in Design Forum','T/G Corporate','Conference','Chicago','$450','',null,'','https://leanconstruction.org/events/design-forum/designforum25/','$ -'],
  ['Registered','4/23/2025','4/23/2025','Hard Hats with Heart Networking Event','T/G Corporate','Social Event','Menomonee Falls','0','RSVP by April 18',null,'','','$ -'],
  ['Declined','4/14/2025','4/16/2025','Data Center World','Manufacturing','Conference','Washington, D.C.','$3,599','By 2/14.',null,'','https://datacenterworld.com/','$ -'],
  ['Declined','4/8/2025','4/10/2025','AGC Annual Convention','T/G Corporate','Conference','Columbus','$1,264','',null,'','https://convention.agc.org/','$ -'],
  ['Opportunity','4/7/2025','4/10/2025','World of Modular','T/G Corporate','Conference','Las Vegas','$1,550','$1,550 one day / $2,300 full pass',null,'','https://www.worldofmodular.org/','$ -'],
  ['Registered','3/19/2025','3/20/2025','Food Northwest Process & Packaging Expo','F&B','Expo','Portland, OR','','Shared booth through Columbia Machinery/Olney.',null,'','https://web.cvent.com/event/5e483c61-1bbe-4fc9-9a0e-8e2073630a5d/','$ -'],
  ['Registered','3/17/2025','3/19/2025','Advancing Data Center Construction','Manufacturing','Conference','Salt Lake City','$1,919','Save $380 by 1/31.',null,'','https://advancing-data-center-construction-west.com/','$ 3,838.00'],
  ['Registered','3/2/2025','3/6/2025','MCAA25','T/G Corporate','Conference','Austin','$1,810','Mike: $2,645  Jody Lehrkind: $975',null,'','https://mcaaconvention.org/','$ 3,620.00'],
  ['Declined','2/28/2025','3/1/2025','Froedtert Desert Classic','Healthcare','Outing','Scottsdale','','',null,'','https://www.froedtert.com/giving/foundation/events/desert-classic','$ -'],
  ['Registered','2/17/2025','2/20/2025','Advancing Prefabrication','T/G Corporate','Conference','Phoenix','0','Chris Hronek/Kipp presenting.',null,'','https://www.advancing-prefabrication.com/','$ -'],
  ['Registered','2/4/2025','2/4/2025','AZ Builders Exchange-Construction Activity Forecast','T/G Corporate','Conference','Phoenix','$269.17','',null,'','https://azbex.com/2025-construction-activity-forecast/','$ 538.34'],
  ['Registered','1/27/2025','1/29/2025','MEP Innovation Conference','T/G Corporate','Conference','Los Angeles','$0','Chris Hronek presenting.',null,'','https://mepconference.com/','$ -'],
  ['Registered','1/16/2025','1/17/2025','AGC Annual Membership Meeting','T/G Corporate','Conference','Madison','$195','',null,'','https://web.agcwi.org/events/','$ 195.00'],
];

async function run() {
  console.log(`Importing ${RAW.length} conferences into tenant_id=${TENANT_ID}...`);

  // Check for existing records to avoid duplicates
  const existing = await db.query(
    'SELECT name, event_start_date FROM trade_shows WHERE tenant_id = $1',
    [TENANT_ID]
  );
  const existingKeys = new Set(
    existing.rows.map(r => `${r.name}|${r.event_start_date ? r.event_start_date.toISOString().slice(0, 10) : ''}`)
  );

  let inserted = 0;
  let skipped = 0;

  for (const row of RAW) {
    const [confirmStatus, startDate, endDate, title, market, eventType, location, perPersonFeeRaw, notesRaw, , boothFeeRaw, link, totalFeeRaw] = row;

    const startSql = sqlDate(startDate);
    const key = `${title}|${startSql || ''}`;
    if (existingKeys.has(key)) {
      console.log(`  SKIP (already exists): ${title}`);
      skipped++;
      continue;
    }

    const loc = parseLocation(location);
    const perPersonFee = parseMoney(perPersonFeeRaw);
    const boothFee = parseMoney(boothFeeRaw);
    const totalFee = parseMoney(totalFeeRaw);
    const status = mapStatus(confirmStatus, endDate);
    const description = buildDescription(market, eventType);
    const notes = cleanNotes(notesRaw);
    const websiteUrl = (link || '').trim() || null;

    await db.query(
      `INSERT INTO trade_shows
        (tenant_id, name, status, description, city, state, venue,
         event_start_date, event_end_date,
         registration_cost, booth_cost, total_budget,
         website_url, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`,
      [
        TENANT_ID,
        title,
        status,
        description,
        loc.city,
        loc.state,
        loc.venue,
        startSql,
        sqlDate(endDate),
        perPersonFee,
        boothFee,
        totalFee,
        websiteUrl,
        notes,
      ]
    );

    console.log(`  INSERTED [${status}]: ${title} (${startDate})`);
    inserted++;
  }

  console.log(`\nDone. Inserted: ${inserted}, Skipped: ${skipped}`);
  process.exit(0);
}

run().catch(err => {
  console.error('Import failed:', err);
  process.exit(1);
});
