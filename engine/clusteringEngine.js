/**
 * Semantic Topic Clustering Engine
 * Groups ~48k raw keywords into high-impact topic clusters with primary head,
 * secondary variations, and PAA questions.
 */

const STOPWORDS = new Set([
  'in', 'on', 'at', 'for', 'the', 'and', 'of', 'to', 'a', 'an', 'near', 'me',
  'uk', 'with', 'from', 'by', 'as', 'into', 'around', 'about', 'best', 'top',
  'cheap', 'online', 'free', 'cost', 'price'
]);

function getTokens(str) {
  return str.toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .split(/\s+/)
    .filter(t => t.length > 2 && !STOPWORDS.has(t));
}

function slugify(text) {
  return text.toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-');
}

function generateTitle(primaryKeyword, intent, pillar) {
  const cap = primaryKeyword.replace(/\b\w/g, l => l.toUpperCase());

  if (intent.includes('Commercial')) {
    return `Best ${cap}: Buying Guide & Comparisons (${new Date().getFullYear()})`;
  }
  if (intent.includes('How-To') || primaryKeyword.startsWith('how ') || primaryKeyword.startsWith('what ')) {
    return `${cap}: Complete Step-by-Step Guide`;
  }
  if (pillar === 'Building Materials') {
    return `${cap}: Trade Specifications, Types & Uses Explained`;
  }
  if (pillar === 'Power Tools') {
    return `Ultimate ${cap} Guide: Features, Choosing & Maintenance`;
  }
  return `The Complete Guide to ${cap}: Types, Costs & Installation`;
}

function clusterKeywords(keywordsList, pillarName, targetClusterCount = 52) {
  // Sort by search volume descending so high-volume terms form cluster seed heads
  const sorted = [...keywordsList].sort((a, b) => (b.volume || 0) - (a.volume || 0));

  const clusters = [];
  const assigned = new Set();

  for (let i = 0; i < sorted.length; i++) {
    const item = sorted[i];
    if (assigned.has(item.keyword)) continue;

    const tokens = getTokens(item.keyword);
    if (tokens.length === 0) continue;

    // Check if it fits an existing cluster
    let bestCluster = null;
    let highestOverlap = 0;

    for (const cluster of clusters) {
      const seedTokens = cluster.seedTokens;
      // Calculate token intersection
      const intersection = tokens.filter(t => seedTokens.has(t));
      const overlapScore = intersection.length / Math.min(tokens.length, seedTokens.size);

      // Require meaningful semantic match (at least 2 matching tokens or complete subset)
      if ((intersection.length >= 2 || (intersection.length === 1 && seedTokens.size <= 2 && tokens.length <= 2)) && overlapScore > 0.45) {
        if (overlapScore > highestOverlap) {
          highestOverlap = overlapScore;
          bestCluster = cluster;
        }
      }
    }

    if (bestCluster && bestCluster.keywords.length < 50) {
      bestCluster.keywords.push(item);
      bestCluster.totalVolume += item.volume;
      if (item.isQuestion && bestCluster.paaQuestions.length < 10) {
        if (!bestCluster.paaQuestions.includes(item.displayKeyword)) {
          bestCluster.paaQuestions.push(item.displayKeyword);
        }
      }
      assigned.add(item.keyword);
    } else if (clusters.length < targetClusterCount * 3) {
      // Create new cluster seed
      const seedTokenSet = new Set(tokens);
      const newCluster = {
        id: slugify(`${pillarName}-${item.keyword}`).substring(0, 50),
        pillar: pillarName,
        primaryKeyword: item.displayKeyword,
        seedTokens: seedTokenSet,
        primaryVolume: item.volume,
        totalVolume: item.volume,
        cpc: item.cpc,
        competition: item.competition,
        keywords: [item],
        paaQuestions: item.isQuestion ? [item.displayKeyword] : [],
        monthlyAggregate: { ...item.monthlyVolume }
      };
      clusters.push(newCluster);
      assigned.add(item.keyword);
    }
  }

  // Second pass: attach remaining questions and secondary keywords
  for (let i = 0; i < sorted.length; i++) {
    const item = sorted[i];
    if (assigned.has(item.keyword)) continue;

    const tokens = getTokens(item.keyword);
    for (const cluster of clusters) {
      const match = tokens.some(t => cluster.seedTokens.has(t));
      if (match) {
        if (item.isQuestion && cluster.paaQuestions.length < 8) {
          if (!cluster.paaQuestions.includes(item.displayKeyword)) {
            cluster.paaQuestions.push(item.displayKeyword);
          }
        }
        if (cluster.keywords.length < 25) {
          cluster.keywords.push(item);
          cluster.totalVolume += item.volume;
        }
        assigned.add(item.keyword);
        break;
      }
    }
  }

  // Finalize clusters
  const finalized = clusters.map(c => {
    // Determine cluster peak month from monthly aggregate
    const monthTotals = {};
    c.keywords.forEach(kw => {
      Object.entries(kw.monthlyVolume || {}).forEach(([mName, vol]) => {
        const mKey = mName.split(' ')[0];
        monthTotals[mKey] = (monthTotals[mKey] || 0) + vol;
      });
    });

    let peakMonth = 'Apr';
    let maxVal = -1;
    Object.entries(monthTotals).forEach(([m, val]) => {
      if (val > maxVal) {
        maxVal = val;
        peakMonth = m;
      }
    });

    const secondaries = c.keywords
      .slice(1, 15)
      .map(k => k.displayKeyword)
      .filter(k => k.toLowerCase() !== c.primaryKeyword.toLowerCase());

    return {
      id: c.id,
      pillar: c.pillar,
      primaryKeyword: c.primaryKeyword,
      primaryVolume: c.primaryVolume,
      totalVolume: c.totalVolume,
      cpc: c.cpc,
      competition: c.competition,
      peakMonth,
      monthTotals,
      secondaryKeywords: secondaries,
      paaQuestions: c.paaQuestions,
      clusterSize: c.keywords.length
    };
  });

  return finalized;
}

module.exports = {
  clusterKeywords,
  generateTitle
};
