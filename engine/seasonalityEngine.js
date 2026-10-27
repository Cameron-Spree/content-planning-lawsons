/**
 * Seasonality & 52-Week Content Calendar Scheduler
 * Aligns publishing dates with 6-8 weeks lead time before seasonal search spikes,
 * and prioritizes articles with high rankability (low competition & high demand).
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

function getTargetPublishMonth(peakMonth) {
  const peakIdx = MONTH_ORDER.indexOf(peakMonth);
  if (peakIdx === -1) return 'Jan';
  const targetIdx = (peakIdx - 2 + 12) % 12;
  return MONTH_ORDER[targetIdx];
}

function getDifficultyLevel(competition) {
  const comp = typeof competition === 'number' ? competition : 50;
  if (comp <= 35) return 'Easy to Rank';
  if (comp <= 65) return 'Moderate';
  return 'Challenging';
}

/**
 * Rankability Score: Higher score = faster and easier to rank on Google Page 1.
 * Heavily rewards lower competition (100 - competition) while valuing search volume.
 */
function calculateRankabilityScore(cluster) {
  const logVol = Math.log10(Math.max(cluster.primaryVolume || 10, 10));
  const comp = cluster.competition !== undefined ? cluster.competition : 50;
  const easeFactor = (100 - comp); // 0 to 100
  const paaBonus = Math.min((cluster.paaQuestions || []).length, 6) * 2;
  const cpc = Math.min(cluster.cpc || 0, 5);

  const score = (logVol * 18) + (easeFactor * 0.45) + (cpc * 3) + paaBonus;
  return parseFloat(score.toFixed(1));
}

function calculatePriorityScore(cluster) {
  const logVol = Math.log10(Math.max(cluster.totalVolume || 10, 10));
  const cpc = cluster.cpc || 0.5;
  const paaBonus = Math.min((cluster.paaQuestions || []).length, 5) * 1.5;
  const comp = cluster.competition !== undefined ? cluster.competition : 50;
  const rankEase = (100 - comp) * 0.25;

  const score = (logVol * 12) + (cpc * 8) + paaBonus + rankEase;
  return parseFloat(score.toFixed(1));
}

function schedulePillar52Weeks(clusters, pillarName) {
  // Score and enrich each cluster
  const scored = clusters.map(c => {
    const comp = c.competition !== undefined ? c.competition : 50;
    return {
      ...c,
      competition: comp,
      difficulty: comp,
      difficultyLevel: getDifficultyLevel(comp),
      rankabilityScore: calculateRankabilityScore(c),
      targetMonth: getTargetPublishMonth(c.peakMonth),
      priorityScore: calculatePriorityScore(c)
    };
  });

  // Sort by Rankability & Priority descending (best opportunities first)
  scored.sort((a, b) => b.rankabilityScore - a.rankabilityScore);

  // Group by target month
  const monthBuckets = {};
  MONTH_ORDER.forEach(m => { monthBuckets[m] = []; });

  scored.forEach(c => {
    monthBuckets[c.targetMonth].push(c);
  });

  // 52-week slots
  const scheduledWeeks = new Array(53).fill(null);
  const remaining = [];

  // Pass 1: Place best ranking candidates into their seasonal target months
  MONTH_ORDER.forEach(m => {
    const weeks = MONTH_WEEKS[m];
    const available = monthBuckets[m];

    weeks.forEach(w => {
      if (available.length > 0) {
        scheduledWeeks[w] = available.shift();
      }
    });

    if (available.length > 0) {
      remaining.push(...available);
    }
  });

  scored.forEach(c => {
    if (!scheduledWeeks.includes(c) && !remaining.includes(c)) {
      remaining.push(c);
    }
  });

  // Pass 2: Fill remaining weeks
  for (let w = 1; w <= 52; w++) {
    if (!scheduledWeeks[w]) {
      if (remaining.length > 0) {
        scheduledWeeks[w] = remaining.shift();
      } else {
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

  return {
    scheduled: schedule,
    allCandidates: scored
  };
}

module.exports = {
  MONTH_ORDER,
  MONTH_WEEKS,
  getTargetPublishMonth,
  getDifficultyLevel,
  calculateRankabilityScore,
  calculatePriorityScore,
  schedulePillar52Weeks
};
