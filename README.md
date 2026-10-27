# Lawsons Automated Content Planning & Editorial Calendar

Automated semantic clustering, keyword difficulty/rankability optimization, and interactive editorial decision workflows for **~48,000 raw keyword queries** across three primary e-commerce pillars:
- 🌿 **Fencing** (~11,700 keywords)
- ⚡ **Power Tools** (~34,000 keywords)
- 🧱 **Building Materials** (~2,200 keywords)

---

## What's New

1. **🔥 Monthly "Decision Deck" (Tinder-Style Approval)**:
   - Review articles month-by-month with instant **Yes (Approve)** or **No (Skip & Swap)** card controls.
   - Use keyboard shortcuts (`[Y]` or `[→]` to approve, `[N]` or `[←]` to skip).
   - Shows candidate queue and dynamically manages the monthly production schedule.

2. **🟢 Difficulty & Rankability Recommendations ("Ones That Would Rank")**:
   - Every topic is classified by competition:
     - `🟢 Easy to Rank` (Low Competition: 0–35): Low-hanging fruit for quick ranking wins.
     - `🟡 Moderate` (36–65).
     - `🔴 Challenging` (66–100).
   - Algorithmic **Rankability Score** prioritizes low-competition queries with healthy search volume so the business captures page 1 rankings rapidly.
   - Filter and sort the entire calendar by "Best Rankability First".

3. **📝 Editorial Content Titles & Grouped Keywords**:
   - Each topic receives a high-converting, click-worthy **Content Title** (e.g. `Best Cordless Lawn Mowers (2026): Trade Reviews & Buying Guide`).
   - Semantically related search queries are grouped together under that title with individual search volumes, competition levels, and CPCs (e.g. 5–25 related keywords per title).
   - Eliminates keyword cannibalization and equips content writers with a clear secondary keyword checklist.

4. **Exact 3 Articles / Week Cadence (156 Articles / Year)**:
   - Balanced with 1 Fencing, 1 Power Tools, and 1 Building Materials per week.
   - Seasonally scheduled 6 to 8 weeks ahead of Google peak search spikes.

5. **3 Flexible Views**:
   - **Decision Deck**: Fast monthly swipe/review card deck.
   - **Kanban Board**: Drag-and-drop workflow across *Briefing*, *Drafting*, *In Review*, *Scheduled*, *Published*.
   - **52-Week Roadmap**: Month-by-month calendar view with 3 slots per week.

---

## Quick Start

### Re-process Data
```bash
node scripts/process_data.js
```

### Local Dev Server
```bash
npm start
```
Runs at [http://localhost:3002](http://localhost:3002).

### Zero-Config Vercel Deployment
Connected directly to GitHub repository: **[Cameron-Spree/content-planning-lawsons](https://github.com/Cameron-Spree/content-planning-lawsons)**.
Deploy by connecting the repo in Vercel.
