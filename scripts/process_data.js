/**
 * Master Pipeline Runner
 * Processes ~48k raw keywords into a balanced 52-week, 3-articles/week Content Calendar,
 * cross-referenced against the 370 currently live Lawsons blogs to eliminate content crossover.
 */

const fs = require('fs');
const path = require('path');

const { parseKeywordsCSV } = require('../engine/csvParser');
const { classifyIntent, classifyAudience } = require('../engine/intentClassifier');
const { clusterKeywords, generateTitle } = require('../engine/clusteringEngine');
const { schedulePillar52Weeks } = require('../engine/seasonalityEngine');
const { OverlapDetector } = require('../engine/overlapDetector');

const ROOT_DIR = path.resolve(__dirname, '..');
const OUTPUT_DIR = path.join(ROOT_DIR, 'output');
const BRIEFS_DIR = path.join(OUTPUT_DIR, 'briefs');
const PUBLIC_DATA_DIR = path.join(ROOT_DIR, 'public', 'data');
const EXISTING_BLOGS_FILE = path.join(ROOT_DIR, 'data', 'existing_lawsons_blogs.json');

const DATASETS = [
  {
    pillar: 'Fencing',
    file: path.join(ROOT_DIR, 'conversational_keyword_ideas_results_1793096085403.csv')
  },
  {
    pillar: 'Power Tools',
    file: path.join(ROOT_DIR, 'conversational_keyword_ideas_1793096388436.csv')
  },
  {
    pillar: 'Building Materials',
    file: path.join(ROOT_DIR, 'conversational_keyword_ideas_1793096240407.csv')
  }
];

function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function runPipeline() {
  console.log('🚀 Starting Cannibalization-Free Keyword Planning Pipeline...\n');
  ensureDir(OUTPUT_DIR);
  ensureDir(BRIEFS_DIR);
  ensureDir(PUBLIC_DATA_DIR);

  // Initialize Overlap Detector against 370 live Lawsons blogs
  const detector = new OverlapDetector(EXISTING_BLOGS_FILE);
  console.log(`🔎 Loaded ${detector.existingBlogs.length} live Lawsons blog URLs for crossover detection.`);

  const pillarSchedules = {};
  const pillarCandidates = {};

  DATASETS.forEach(ds => {
    console.log(`\n📂 Ingesting ${ds.pillar}...`);
    if (!fs.existsSync(ds.file)) {
      console.error(`❌ File not found: ${ds.file}`);
      return;
    }

    const content = fs.readFileSync(ds.file, 'utf8');
    const rawKeywords = parseKeywordsCSV(content, ds.pillar);
    console.log(`   Parsed ${rawKeywords.length.toLocaleString()} keywords.`);

    // Tag intent & audience
    rawKeywords.forEach(k => {
      k.intent = classifyIntent(k.keyword, k.isQuestion);
      k.audience = classifyAudience(k.keyword, ds.pillar);
    });

    console.log(`   Clustering topics & grouping semantic keywords for ${ds.pillar}...`);
    const clusters = clusterKeywords(rawKeywords, ds.pillar, 52);

    // Cross-reference every cluster against live Lawsons blogs
    let liveMatchCount = 0;
    clusters.forEach(c => {
      c.intent = classifyIntent(c.primaryKeyword, (c.paaQuestions || []).length > 0);
      c.audience = classifyAudience(c.primaryKeyword, ds.pillar);
      c.recommendedTitle = generateTitle(c.primaryKeyword, c.intent, ds.pillar, c.audience);

      const overlapCheck = detector.checkOverlap(c.primaryKeyword, c.recommendedTitle);
      c.overlapStatus = overlapCheck.overlapStatus;
      c.matchedBlog = overlapCheck.matchedBlog;

      if (c.overlapStatus === 'Direct Live Match') {
        liveMatchCount++;
      }
    });

    console.log(`   Formed ${clusters.length} topic clusters (${liveMatchCount} match existing live blogs, ${clusters.length - liveMatchCount} 100% net-new).`);

    // Schedule 52 weeks and prioritize by rankability & net-new opportunity
    console.log(`   Scheduling 52-week editorial calendar for ${ds.pillar}...`);
    const { scheduled, allCandidates } = schedulePillar52Weeks(clusters, ds.pillar);
    pillarSchedules[ds.pillar] = scheduled;
    pillarCandidates[ds.pillar] = allCandidates;
    console.log(`   ✅ Finished scheduling 52 weeks for ${ds.pillar}.`);
  });

  // Interleave the pillars: Week 1..52, each week has [Fencing, Power Tools, Building Materials]
  const masterCalendar = [];
  const weeksData = [];

  for (let w = 1; w <= 52; w++) {
    const fencingItem = pillarSchedules['Fencing'] ? pillarSchedules['Fencing'][w - 1] : null;
    const toolsItem = pillarSchedules['Power Tools'] ? pillarSchedules['Power Tools'][w - 1] : null;
    const materialsItem = pillarSchedules['Building Materials'] ? pillarSchedules['Building Materials'][w - 1] : null;

    const weekGroup = {
      weekNumber: w,
      month: fencingItem ? fencingItem.scheduledMonth : 'Jan',
      articles: [fencingItem, toolsItem, materialsItem].filter(Boolean)
    };

    weeksData.push(weekGroup);

    if (fencingItem) masterCalendar.push(fencingItem);
    if (toolsItem) masterCalendar.push(toolsItem);
    if (materialsItem) masterCalendar.push(materialsItem);
  }

  console.log(`\n📊 Total Candidate Articles: ${masterCalendar.length} (3 articles/week × 52 weeks)`);

  // Write individual JSON briefs
  console.log(`📝 Writing ${masterCalendar.length} article briefs to ${BRIEFS_DIR}...`);
  masterCalendar.forEach(item => {
    const brief = {
      id: item.id,
      pillar: item.pillar,
      weekNumber: item.weekNumber,
      scheduledMonth: item.scheduledMonth,
      scheduledDate: item.scheduledDate,
      status: item.status || 'Briefing',
      contentTitle: item.recommendedTitle,
      targetKeyword: item.primaryKeyword,
      intent: item.intent,
      audience: item.audience,
      overlapCheck: {
        overlapStatus: item.overlapStatus || 'Net-New Opportunity',
        matchedBlog: item.matchedBlog || null
      },
      seoMetrics: {
        searchVolume: item.primaryVolume,
        totalClusterVolume: item.totalVolume,
        cpc: item.cpc,
        difficulty: item.difficulty,
        difficultyLevel: item.difficultyLevel,
        rankabilityScore: item.rankabilityScore,
        peakSearchMonth: item.peakMonth
      },
      groupedKeywords: item.groupedKeywords || [],
      secondaryKeywords: item.secondaryKeywords || [],
      paaQuestions: item.paaQuestions || [],
      suggestedSections: [
        'Zero-Click Fast Answer / Key Takeaways',
        `What is ${item.primaryKeyword}? Overview & Specifications`,
        item.intent.includes('Commercial') ? 'Key Comparison & Selection Criteria' : 'Step-by-Step Installation / Best Practice',
        'Common Problems, Costs & Material Calculations',
        'Frequently Asked Questions (PAA Spine)',
        'Internal Links to Relevant Products & Categories'
      ]
    };

    fs.writeFileSync(
      path.join(BRIEFS_DIR, `${item.id}.json`),
      JSON.stringify(brief, null, 2),
      'utf8'
    );
  });

  // Export calendar JSON
  const fullPayload = {
    metadata: {
      generatedAt: new Date().toISOString(),
      cadence: '3 articles per week (1 Fencing, 1 Power Tools, 1 Building Materials)',
      totalWeeks: 52,
      totalArticles: masterCalendar.length,
      pillars: ['Fencing', 'Power Tools', 'Building Materials'],
      liveBlogsIndexed: detector.existingBlogs.length
    },
    weeks: weeksData,
    articles: masterCalendar,
    candidates: pillarCandidates
  };

  const masterJsonPath = path.join(OUTPUT_DIR, 'content_calendar_master.json');
  fs.writeFileSync(masterJsonPath, JSON.stringify(fullPayload, null, 2), 'utf8');

  // Copy to public/data for frontend consumption
  fs.writeFileSync(
    path.join(PUBLIC_DATA_DIR, 'calendar.json'),
    JSON.stringify(fullPayload, null, 2),
    'utf8'
  );

  // Write Master CSV
  const csvHeaders = [
    'Week',
    'Month',
    'Pillar',
    'Content Title',
    'Target Keyword',
    'Overlap Status',
    'Matched Live Blog Title',
    'Matched Live URL',
    'Difficulty Level',
    'Difficulty (Comp 0-100)',
    'Rankability Score',
    'Search Volume',
    'Total Cluster Volume',
    'Grouped Keywords Count',
    'CPC (GBP)',
    'Peak Month',
    'Intent',
    'Audience',
    'Status'
  ];

  const csvRows = [csvHeaders.join(',')];

  masterCalendar.forEach(item => {
    const matchedTitle = item.matchedBlog ? item.matchedBlog.title : 'None (100% Net-New)';
    const matchedUrl = item.matchedBlog ? item.matchedBlog.liveUrl : '';

    const row = [
      item.weekNumber,
      `"${item.scheduledMonth}"`,
      `"${item.pillar}"`,
      `"${(item.recommendedTitle || '').replace(/"/g, '""')}"`,
      `"${item.primaryKeyword.replace(/"/g, '""')}"`,
      `"${item.overlapStatus || 'Net-New Opportunity'}"`,
      `"${matchedTitle.replace(/"/g, '""')}"`,
      `"${matchedUrl}"`,
      `"${item.difficultyLevel}"`,
      item.difficulty,
      item.rankabilityScore,
      item.primaryVolume,
      item.totalVolume,
      (item.groupedKeywords || []).length,
      item.cpc,
      `"${item.peakMonth}"`,
      `"${item.intent}"`,
      `"${item.audience}"`,
      `"${item.status || 'Briefing'}"`
    ];
    csvRows.push(row.join(','));
  });

  const masterCsvPath = path.join(OUTPUT_DIR, 'content_calendar_master.csv');
  fs.writeFileSync(masterCsvPath, csvRows.join('\n'), 'utf8');
  fs.copyFileSync(masterCsvPath, path.join(ROOT_DIR, 'public', 'content_calendar_master.csv'));

  console.log(`\n🎉 Pipeline completed successfully!`);
  console.log(`📁 Master JSON: ${masterJsonPath}`);
  console.log(`📁 Master CSV:  ${masterCsvPath}`);
  console.log(`📁 Briefs:      ${BRIEFS_DIR} (${masterCalendar.length} briefs ready)`);
}

runPipeline();
