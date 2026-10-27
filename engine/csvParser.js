/**
 * Robust CSV parser for keyword datasets with quoted strings and numerical cleaning.
 */

function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

function cleanNumber(val) {
  if (!val || val === 'N/A' || val === '-' || val === '') return 0;
  const cleaned = String(val).replace(/[^\d.-]/g, '');
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
}

const MONTH_NAMES = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
];

function parseKeywordsCSV(content, pillarName) {
  const lines = content.split(/\r?\n/).filter(l => l.trim().length > 0);
  if (lines.length === 0) return [];

  const headers = parseCSVLine(lines[0]);
  const monthCols = [];

  headers.forEach((h, idx) => {
    // Look for month column e.g. "Jan 2026", "Sep 2025"
    const match = h.match(/^([A-Za-z]{3})\s+(\d{4})$/);
    if (match) {
      monthCols.push({ index: idx, name: h, month: match[1], year: parseInt(match[2], 10) });
    }
  });

  const kwIdx = headers.findIndex(h => h.toLowerCase() === 'keyword');
  const volIdx = headers.findIndex(h => h.toLowerCase().includes('avg volume'));
  const cpcIdx = headers.findIndex(h => h.toLowerCase().includes('cpc'));
  const compIdx = headers.findIndex(h => h.toLowerCase().includes('competition'));
  const questionIdx = headers.findIndex(h => h.toLowerCase() === 'question');

  const rows = [];

  for (let i = 1; i < lines.length; i++) {
    const cols = parseCSVLine(lines[i]);
    if (!cols || cols.length <= kwIdx) continue;

    const keyword = cols[kwIdx];
    if (!keyword || keyword.length < 2) continue;

    const volume = cleanNumber(cols[volIdx]);
    const cpc = cleanNumber(cols[cpcIdx]);
    const competition = cleanNumber(cols[compIdx]);
    const isQuestion = cols[questionIdx] ? cols[questionIdx].toLowerCase() === 'yes' : false;

    // Monthly seasonality tracking
    const monthlyVolume = {};
    let peakMonth = 'Jan';
    let maxMonthlyVol = -1;

    monthCols.forEach(m => {
      const vol = cleanNumber(cols[m.index]);
      monthlyVolume[m.name] = vol;
      if (vol > maxMonthlyVol) {
        maxMonthlyVol = vol;
        peakMonth = m.month;
      }
    });

    rows.push({
      keyword: keyword.trim().toLowerCase(),
      displayKeyword: keyword.trim(),
      pillar: pillarName,
      volume,
      cpc,
      competition,
      isQuestion,
      peakMonth,
      maxMonthlyVol,
      monthlyVolume
    });
  }

  return rows;
}

module.exports = {
  parseCSVLine,
  cleanNumber,
  parseKeywordsCSV,
  MONTH_NAMES
};
