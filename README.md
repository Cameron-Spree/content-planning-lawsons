# Lawsons Automated Content Planning & Editorial Calendar

Automated semantic clustering, seasonal schedule optimization, and Kanban management for **~48,000 raw keyword queries** across three primary e-commerce pillars:
- 🌿 **Fencing** (~11,700 keywords)
- ⚡ **Power Tools** (~34,000 keywords)
- 🧱 **Building Materials** (~2,200 keywords)

---

## Key Features

1. **Exact 3 Articles / Week Cadence (156 Articles / Year)**:
   - Every single week is strictly balanced with **1 Fencing**, **1 Power Tools**, and **1 Building Materials** article.
   - Prevents content overload and maintains balanced growth across all three departments.

2. **Automated Seasonality Scheduling**:
   - Analyzes 12-month search trends from the raw CSV data.
   - Automatically backdates publication dates **6 to 8 weeks ahead of peak search demand** so content matures and ranks on Google before the seasonal surge.

3. **Anti-Cannibalization Topic Clustering**:
   - Compresses 48k noisy queries into 156 high-impact cluster briefs.
   - Designates primary head target, secondary variations, and embeds People Also Ask (PAA) questions.
   - Classifies search intent (`Informational`, `Commercial`, `Transactional`) and audience (`Domestic & DIY` vs `Trade & Contractors`).

4. **Vercel-Ready Web Dashboard**:
   - **Interactive Kanban Board**: `Briefing / Backlog`, `Drafting`, `In Review`, `Scheduled`, `Published` with drag-and-drop state persistence.
   - **52-Week Roadmap**: Week-by-week and month-by-month grid showing the 3 slots per week.
   - **Brief Inspector Modal**: Full outline architecture, PAA questions, and one-click JSON payload copy.
   - **One-Click Export**: Instant CSV and JSON calendar export.

5. **Direct Integration with Lawsons Blog Creation Engine**:
   - Exported JSON briefs match the ingestion schemas of `Blog Creation Tool`.

---

## Quick Start

### 1. Run the Pipeline (CLI / Double-click)
To re-process the CSV files and regenerate the calendar:
```bash
node scripts/process_data.js
```
*(On Windows, you can also simply double-click `run_pipeline.bat`)*

### 2. View Locally
Start a lightweight static server:
```bash
npm start
```
Open **[http://localhost:3002](http://localhost:3002)** in your browser.

### 3. Deploy to Vercel
This repository is configured for **Zero-Config Vercel Deployment**:
1. Push this repository to GitHub/GitLab.
2. In your [Vercel Dashboard](https://vercel.com), click **Add New Project** and select this repo.
3. Deploy! Vercel will automatically serve:
   - The interactive frontend from `/public`
   - The serverless calendar data endpoint at `/api/calendar`

---

## Output Structure

- `output/content_calendar_master.csv`: 52-week spreadsheet for editorial planning.
- `output/content_calendar_master.json`: Machine-readable master calendar.
- `output/briefs/<id>.json`: 156 individual, generator-ready brief files.
- `public/content_calendar_master.csv`: Downloadable calendar from the web dashboard.
- `run_batch_generator.js`: Batch runner to feed briefs into your `Blog Creation Tool`.
