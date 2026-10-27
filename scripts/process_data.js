/**
 * Master Pipeline Runner
 * Processes ~48k raw keywords into a balanced 52-week, 3-articles/week Content Calendar.
 */

const fs = require('fs');
const path = require('path');

const { parseKeywordsCSV } = require('../engine/csvParser');
const { classifyIntent, classifyAudience } = require('../engine/intentClassifier');
const { clusterKeywords, generateTitle } = require('../engine/clusteringEngine');
const { schedulePillar52Weeks } = require('../engine/seasonalityEngine');

const ROOT_DIR = path.resolve(__dirname, '..');
const OUTPUT_DIR = path.join(ROOT_DIR, 'output');
const BRIEFS_DIR = path.join(OUTPUT_DIR, 'briefs');
const PUBLIC_DATA_DIR = path.join(ROOT_DIR, 'public', 'data');

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
  console.log('🚀 Starting Keyword-to-Content Calendar Pipeline...\n');
  ensureDir(OUTPUT_DIR);
  ensureDir(BRIEFS_DIR);
  ensureDir(PUBLIC_DATA_DIR);

  const pillarSchedules = {};

  DATASETS.forEach(ds => {
    console.log(`📂 Ingesting ${ds.pillar}...`);
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

    console.log(`   Clustering topics for ${ds.pillar}...`);
    const clusters = clusterKeywords(rawKeywords, ds.pillar, 52);
    console.log(`   Formed ${clusters.length} candidate topic clusters.`);

    // Enrich clusters with intent and recommended titles
    clusters.forEach(c => {
      c.intent = classifyIntent(c.primaryKeyword, (c.paaQuestions || []).length > 0);
      c.audience = classifyAudience(c.primaryKeyword, ds.pillar);
      c.recommendedTitle = generateTitle(c.primaryKeyword, c.intent, ds.pillar);
    });

    // Schedule across 52 weeks
    console.log(`   Scheduling 52-week editorial calendar for ${ds.pillar}...`);
    const schedule = schedulePillar52Weeks(clusters, ds.pillar);
    pillarSchedules[ds.pillar] = schedule;
    console.log(`   ✅ Finished scheduling 52 weeks for ${ds.pillar}.\n`);
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

  console.log(`📊 Total Scheduled Articles: ${masterCalendar.length} (3 articles/week × 52 weeks)`);

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
      priorityScore: item.priorityScore,
      targetKeyword: item.primaryKeyword,
      recommendedTitle: item.recommendedTitle,
      intent: item.intent,
      audience: item.audience,
      metrics: {
        primaryVolume: item.primaryVolume,
        totalClusterVolume: item.totalVolume,
        cpc: item.cpc,
        competition: item.competition,
        peakSearchMonth: item.peakMonth
      },
      secondaryKeywords: item.secondaryKeywords,
      paaQuestions: item.paaQuestions,
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

  // Write Master JSON & CSV
  const masterJsonPath = path.join(OUTPUT_DIR, 'content_calendar_master.json');
  fs.writeFileSync(masterJsonPath, JSON.stringify({
    metadata: {
      generatedAt: new Date().toISOString(),
      cadence: '3 articles per week (1 Fencing, 1 Power Tools, 1 Building Materials)',
      totalWeeks: 52,
      totalArticles: masterCalendar.length,
      pillars: ['Fencing', 'Power Tools', 'Building Materials']
    },
    weeks: weeksData,
    articles: masterCalendar
  }, null, 2), 'utf8');

  // Copy to public/data for frontend consumption
  fs.writeFileSync(
    path.join(PUBLIC_DATA_DIR, 'calendar.json'),
    JSON.stringify({
      generatedAt: new Date().toISOString(),
      articles: masterCalendar,
      weeks: weeksData
    }, null, 2),
    'utf8'
  );

  // Write Master CSV
  const csvHeaders = [
    'Week',
    'Month',
    'Pillar',
    'Target Keyword',
    'Recommended Title',
    'Intent',
    'Audience',
    'Search Volume',
    'CPC (GBP)',
    'Peak Month',
    'PAA Question Count',
    'Status',
    'Priority Score'
  ];

  const csvRows = [csvHeaders.join(',')];

  masterCalendar.forEach(item => {
    const row = [
      item.weekNumber,
      `"${item.scheduledMonth}"`,
      `"${item.pillar}"`,
      `"${item.primaryKeyword.replace(/"/g, '""')}"`,
      `"${(item.recommendedTitle || '').replace(/"/g, '""')}"`,
      `"${item.intent}"`,
      `"${item.audience}"`,
      item.primaryVolume,
      item.cpc,
      `"${item.peakMonth}"`,
      (item.paaQuestions || []).length,
      `"${item.status || 'Briefing'}"`,
      item.priorityScore
    ];
    csvRows.push(row.join(','));
  });

  const masterCsvPath = path.join(OUTPUT_DIR, 'content_calendar_master.csv');
  fs.writeFileSync(masterCsvPath, csvRows.join('\n'), 'utf8');

  console.log(`\n🎉 Pipeline completed successfully!`);
  console.log(`📁 Master JSON: ${masterJsonPath}`);
  console.log(`📁 Master CSV:  ${masterCsvPath}`);
  console.log(`📁 Briefs:      ${BRIEFS_DIR} (${masterCalendar.length} briefs ready for Content Generator)`);
}

runPipeline();
