/**
 * Semantic Topic Clustering Engine
 * Groups ~48k raw keywords into high-impact topic clusters with rich content titles,
 * primary target, grouped similar keywords with individual metrics, and PAA questions.
 */

const STOPWORDS = new Set([
  'in', 'on', 'at', 'for', 'the', 'and', 'of', 'to', 'a', 'an', 'near', 'me',
  'uk', 'with', 'from', 'by', 'as', 'into', 'around', 'about', 'cheap',
  'online', 'free', 'cost', 'price'
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

/**
 * Generate high-converting, professional UK trade and merchant editorial titles.
 */
function generateTitle(primaryKeyword, intent, pillar, audience) {
  const cleanKw = primaryKeyword.trim();
  const cap = cleanKw.replace(/\b\w/g, l => l.toUpperCase());
  const year = 2026;

  if (intent.includes('Commercial') || cleanKw.includes('best') || cleanKw.includes('vs') || cleanKw.includes('review')) {
    if (pillar === 'Power Tools') {
      return `Best ${cap} (${year}): Trade Reviews & Buying Guide`;
    }
    return `Best ${cap} Compared: Buying Guide & Buyer's Checklist (${year})`;
  }

  if (intent.includes('How-To') || cleanKw.startsWith('how ') || cleanKw.startsWith('what ') || cleanKw.startsWith('which ')) {
    return `${cap}: Complete Step-by-Step UK Trade Guide`;
  }

  if (pillar === 'Fencing') {
    if (audience.includes('Trade')) {
      return `Contractor's Guide to ${cap}: Specifications, Installation & Spacing`;
    }
    return `The Complete Guide to ${cap}: Types, Board Calculations & Installation`;
  }

  if (pillar === 'Power Tools') {
    return `Ultimate ${cap} Guide: Features, Battery Systems & Maintenance (${year})`;
  }

  if (pillar === 'Building Materials') {
    if (audience.includes('Trade')) {
      return `${cap}: Trade Specifications, Sizing & Underground Installation`;
    }
    return `Everything You Need to Know About ${cap}: Uses, Calculations & Sizing`;
  }

  return `The Complete UK Guide to ${cap}: Costs, Types & Installation (${year})`;
}

function clusterKeywords(keywordsList, pillarName, targetClusterCount = 52) {
  // Sort primarily by a combination of volume and rankability (giving lower competition terms high visibility)
  const sorted = [...keywordsList].sort((a, b) => {
    const scoreA = (Math.log10(Math.max(a.volume || 10, 10)) * 25) + ((100 - (a.competition || 50)) * 0.4);
    const scoreB = (Math.log10(Math.max(b.volume || 10, 10)) * 25) + ((100 - (b.competition || 50)) * 0.4);
    return scoreB - scoreA;
  });

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
      const intersection = tokens.filter(t => seedTokens.has(t));
      const overlapScore = intersection.length / Math.min(tokens.length, seedTokens.size);

      if ((intersection.length >= 2 || (intersection.length === 1 && seedTokens.size <= 2 && tokens.length <= 2)) && overlapScore > 0.42) {
        if (overlapScore > highestOverlap) {
          highestOverlap = overlapScore;
          bestCluster = cluster;
        }
      }
    }

    if (bestCluster && bestCluster.keywords.length < 60) {
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
        if (cluster.keywords.length < 35) {
          cluster.keywords.push(item);
          cluster.totalVolume += item.volume;
        }
        assigned.add(item.keyword);
        break;
      }
    }
  }

  // Finalize clusters with grouped similar keywords
  const finalized = clusters.map(c => {
    // Determine cluster peak month
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

    // Group similar keywords (excluding the exact primary head)
    const groupedKeywords = c.keywords
      .slice(1, 25)
      .map(k => ({
        keyword: k.displayKeyword,
        volume: k.volume,
        competition: k.competition,
        cpc: k.cpc,
        isQuestion: k.isQuestion
      }))
      .filter(k => k.keyword.toLowerCase() !== c.primaryKeyword.toLowerCase());

    const secondaryList = groupedKeywords.map(k => k.keyword);

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
      groupedKeywords,
      secondaryKeywords: secondaryList,
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
