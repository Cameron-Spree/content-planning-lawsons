/**
 * Seasonality & 52-Week Content Calendar Scheduler
 * Aligns publishing dates with 6-8 weeks lead time before seasonal search spikes.
 */

const MONTH_ORDER = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
];

const MONTH_WEEKS = {
  'Jan': [1, 2, 3, 4],
  'Feb': [5, 6, 7, 8],
  'Mar': [9, 10, 11, 12, 13],
  'Apr': [14, 15, 16, 17],
  'May': [18, 19, 20, 21],
  'Jun': [22, 23, 24, 25, 26],
  'Jul': [27, 28, 29, 30],
  'Aug': [31, 32, 33, 34],
  'Sep': [35, 36, 37, 38, 39],
  'Oct': [40, 41, 42, 43],
  'Nov': [44, 45, 46, 47],
  'Dec': [48, 49, 50, 51, 52]
};

/**
 * Returns optimal publishing month (2 months prior to peak).
 */
function getTargetPublishMonth(peakMonth) {
  const peakIdx = MONTH_ORDER.indexOf(peakMonth);
  if (peakIdx === -1) return 'Jan';
  // 2 months prior (circular modulo)
  const targetIdx = (peakIdx - 2 + 12) % 12;
  return MONTH_ORDER[targetIdx];
}

/**
 * Calculate Priority Score based on Volume, CPC, Intent & PAA depth.
 */
function calculatePriorityScore(cluster) {
  const logVol = Math.log10(Math.max(cluster.totalVolume || 10, 10));
  const cpc = cluster.cpc || 0.5;
  const paaBonus = Math.min((cluster.paaQuestions || []).length, 5) * 1.5;
  const comp = cluster.competition || 50;

  // Weighted score (0 - 100)
  const score = (logVol * 12) + (cpc * 10) + paaBonus + (comp * 0.15);
  return parseFloat(score.toFixed(1));
}

/**
 * Assign clusters to 52 calendar weeks (1 per week per pillar).
 */
function schedulePillar52Weeks(clusters, pillarName) {
  // Score and enrich
  const scored = clusters.map(c => ({
    ...c,
    targetMonth: getTargetPublishMonth(c.peakMonth),
    priorityScore: calculatePriorityScore(c)
  }));

  // Sort by priority descending
  scored.sort((a, b) => b.priorityScore - a.priorityScore);

  // Group by target month
  const monthBuckets = {};
  MONTH_ORDER.forEach(m => { monthBuckets[m] = []; });

  scored.forEach(c => {
    monthBuckets[c.targetMonth].push(c);
  });

  // 52-week slots
  const scheduledWeeks = new Array(53).fill(null);
  const remaining = [];

  // Pass 1: Place clusters into their ideal seasonal weeks
  MONTH_ORDER.forEach(m => {
    const weeks = MONTH_WEEKS[m];
    const available = monthBuckets[m];

    weeks.forEach(w => {
      if (available.length > 0) {
        scheduledWeeks[w] = available.shift();
      }
    });

    // Overflow stays in remaining
    if (available.length > 0) {
      remaining.push(...available);
    }
  });

  // Also collect any clusters not yet placed
  scored.forEach(c => {
    if (!scheduledWeeks.includes(c) && !remaining.includes(c)) {
      remaining.push(c);
    }
  });

  // Pass 2: Fill any unassigned weeks from remaining pool
  for (let w = 1; w <= 52; w++) {
    if (!scheduledWeeks[w]) {
      if (remaining.length > 0) {
        scheduledWeeks[w] = remaining.shift();
      } else {
        // Fallback: pick best available from scored pool
        scheduledWeeks[w] = scored[(w - 1) % scored.length];
      }
    }
  }

  // Build finalized schedule for this pillar
  const schedule = [];
  for (let w = 1; w <= 52; w++) {
    const item = scheduledWeeks[w];
    const month = Object.keys(MONTH_WEEKS).find(m => MONTH_WEEKS[m].includes(w)) || 'Jan';
    schedule.push({
      ...item,
      weekNumber: w,
      scheduledMonth: month,
      scheduledDate: `2026-${String(MONTH_ORDER.indexOf(month) + 1).padStart(2, '0')}-W${w}`,
      status: w <= 4 ? 'Briefing' : 'Backlog'
    });
  }

  return schedule;
}

module.exports = {
  MONTH_ORDER,
  MONTH_WEEKS,
  getTargetPublishMonth,
  calculatePriorityScore,
  schedulePillar52Weeks
};
