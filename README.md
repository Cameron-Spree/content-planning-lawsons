# Lawsons Automated Content Planning & Editorial Calendar

Automated semantic clustering, keyword difficulty/rankability optimization, **live blog cannibalization detection**, and interactive editorial decision workflows for **~48,000 raw keyword queries** across three primary e-commerce pillars:
- 🌿 **Fencing** (~11,700 keywords)
- ⚡ **Power Tools** (~34,000 keywords)
- 🧱 **Building Materials** (~2,200 keywords)

---

## What's New

1. **🛡️ Live Lawsons Blog Overlap & Cannibalization Prevention**:
   - Ingested and indexed **370 live blog URLs** from Lawsons (`Blogs Currently Live.xlsx`).
   - Every candidate topic and cluster is cross-checked against existing URLs.
   - Distinct classification:
     - `🟢 Net-New Opportunity`: Zero crossover with live blogs. Safe to write fresh!
     - `🔄 Direct Live Match`: Overlaps with an existing live blog (e.g., `Concrete vs Timber Fence Posts`). Links directly to the live URL (`/blog/concrete-vs-timber-fence-posts`) and warns writers to update the existing page rather than publishing a competing duplicate post.
   - Dedicated UI filter: **"🟢 Net-New Opportunities Only (0% Overlap)"** so you only see content gaps!

2. **🔥 Monthly "Decision Deck" (Tinder-Style Approval)**:
   - Review articles month-by-month with instant **Yes (Approve)** or **No (Skip & Swap)** card controls.
   - Use keyboard shortcuts (`[Y]` or `[→]` to approve, `[N]` or `[←]` to skip).
   - Shows candidate queue and dynamically manages the monthly production schedule.

3. **✏️ Inline Editable Content Titles**:
   - Tweak wording or rewrite article titles directly on the card before clicking Approve.
   - Custom titles persist directly across the 52-Week Roadmap, Kanban, and exported briefs.

4. **🟢 Difficulty & Rankability Recommendations ("Ones That Would Rank")**:
   - Ranked by competition:
     - `🟢 Easy to Rank` (Low Competition: 0–35): Low-hanging fruit for quick ranking wins.
     - `🟡 Moderate` (36–65).
     - `🔴 Challenging` (66–100).
   - Filter and sort by "Best Rankability First".

5. **52-Week Live Roadmap**:
   - Starts empty until approved.
   - Live synchronization as you approve articles month by month.

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

### Deployment
Connected to GitHub repository: **[Cameron-Spree/content-planning-lawsons](https://github.com/Cameron-Spree/content-planning-lawsons)**.
