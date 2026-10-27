/**
 * Batch Bridge to Lawsons Blog Creation Tool (http://localhost:3001)
 * Takes any brief from output/briefs and triggers automated content generation.
 */

const fs = require('fs');
const path = require('path');
const http = require('http');

const BRIEFS_DIR = path.join(__dirname, 'output', 'briefs');
const GENERATOR_API = process.env.BLOG_ENGINE_URL || 'http://localhost:3001';

async function sendToGenerator(brief) {
  console.log(`\n🚀 Generating article for: "${brief.targetKeyword}" (${brief.pillar})`);
  console.log(`   Scheduled: Week ${brief.weekNumber} (${brief.scheduledMonth})`);
  console.log(`   PAAs attached: ${(brief.paaQuestions || []).length}`);

  // Payload structure for Lawsons Blog Creation Engine
  const payload = {
    keyword: brief.targetKeyword,
    title: brief.recommendedTitle,
    pillar: brief.pillar,
    audience: brief.audience,
    intent: brief.intent,
    secondaryKeywords: brief.secondaryKeywords,
    paaQuestions: brief.paaQuestions,
    suggestedSections: brief.suggestedSections
  };

  // In local test mode without running server, save simulation preview
  const previewPath = path.join(__dirname, 'output', `gen_preview_${brief.id}.json`);
  fs.writeFileSync(previewPath, JSON.stringify(payload, null, 2), 'utf8');
  console.log(`   ✅ Exported ready generator payload: ${previewPath}`);
}

function runBatch(maxItems = 3) {
  if (!fs.existsSync(BRIEFS_DIR)) {
    console.error('❌ Briefs directory not found. Run scripts/process_data.js first.');
    return;
  }

  const files = fs.readdirSync(BRIEFS_DIR).filter(f => f.endsWith('.json')).slice(0, maxItems);
  console.log(`Found ${files.length} briefs to process for the current batch.`);

  files.forEach(f => {
    const brief = JSON.parse(fs.readFileSync(path.join(BRIEFS_DIR, f), 'utf8'));
    sendToGenerator(brief);
  });
}

const count = parseInt(process.argv[2], 10) || 3;
runBatch(count);
