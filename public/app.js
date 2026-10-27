/**
 * Lawsons Content Engine & Editorial Planner
 * Interactive Decision Deck with Editable Titles & Dynamic Live 52-Week Roadmap
 */

let allArticles = [];
let allWeeks = [];
let allCandidates = {};
let currentView = 'tinder';
let selectedBrief = null;

// Tinder Deck State
let tinderMonth = 'Jan';
let tinderPillar = 'Fencing';
let tinderDeck = [];
let tinderIndex = 0;

// Approved Roadmap State (starts empty, persisted in localStorage)
// Structure: { [weekNumber]: { [pillar]: articleObj } }
let approvedRoadmap = {};

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

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

const PILLARS = ['Fencing', 'Power Tools', 'Building Materials'];

const KANBAN_STAGES = [
  { id: 'Briefing', label: 'Briefing / Backlog', color: '#3b82f6' },
  { id: 'Drafting', label: 'Drafting', color: '#8b5cf6' },
  { id: 'In Review', label: 'In Review', color: '#f59e0b' },
  { id: 'Scheduled', label: 'Scheduled', color: '#06b6d4' },
  { id: 'Published', label: 'Published', color: '#10b981' }
];

document.addEventListener('DOMContentLoaded', () => {
  loadData();
  setupKeyboardShortcuts();
});

async function loadData() {
  try {
    let res = await fetch('data/calendar.json');
    if (!res.ok) {
      res = await fetch('/api/calendar');
    }
    const data = await res.json();
    allArticles = data.articles || [];
    allWeeks = data.weeks || [];
    allCandidates = data.candidates || {};

    // Load saved approved roadmap from localStorage (starts empty if none)
    const saved = localStorage.getItem('lawsons_approved_roadmap');
    if (saved) {
      try {
        approvedRoadmap = JSON.parse(saved);
      } catch (e) {
        approvedRoadmap = {};
      }
    } else {
      approvedRoadmap = {};
    }

    updateStats();
    initTinderDeck();
    render();
  } catch (err) {
    console.error('Failed to load calendar data:', err);
    document.getElementById('main-content').innerHTML = `
      <div style="text-align:center; padding: 3rem; color: #ef4444;">
        <h3>Could not load calendar data.</h3>
        <p>Please check console or run <code>scripts/process_data.js</code>.</p>
      </div>
    `;
  }
}

function getApprovedCount() {
  let count = 0;
  Object.values(approvedRoadmap).forEach(weekObj => {
    if (weekObj) {
      PILLARS.forEach(p => {
        if (weekObj[p]) count++;
      });
    }
  });
  return count;
}

function getPillarApprovedInMonth(pillar, month) {
  const weeks = MONTH_WEEKS[month] || [];
  let count = 0;
  weeks.forEach(w => {
    if (approvedRoadmap[w] && approvedRoadmap[w][pillar]) {
      count++;
    }
  });
  return count;
}

function updateStats() {
  const approved = getApprovedCount();
  document.getElementById('stat-total-articles').textContent = `${approved} / 156`;

  let totalVol = 0;
  let easyCount = 0;
  Object.values(approvedRoadmap).forEach(weekObj => {
    if (weekObj) {
      PILLARS.forEach(p => {
        const item = weekObj[p];
        if (item) {
          totalVol += (item.primaryVolume || 0);
          if (item.difficultyLevel === 'Easy to Rank') easyCount++;
        }
      });
    }
  });

  document.getElementById('stat-total-vol').textContent = totalVol.toLocaleString() + '/mo';
  document.getElementById('stat-easy-count').textContent = easyCount;
}

function switchView(view) {
  currentView = view;
  document.getElementById('btn-view-tinder').classList.toggle('active', view === 'tinder');
  document.getElementById('btn-view-kanban').classList.toggle('active', view === 'kanban');
  document.getElementById('btn-view-calendar').classList.toggle('active', view === 'calendar');

  if (view === 'tinder') {
    initTinderDeck();
  }
  render();
}

function applyFilters() {
  if (currentView === 'tinder') {
    initTinderDeck();
  }
  render();
}

function render() {
  const container = document.getElementById('main-content');
  if (currentView === 'tinder') {
    renderTinderView(container);
  } else if (currentView === 'kanban') {
    renderKanban(container);
  } else {
    renderCalendar(container);
  }
}

/* ==================== TINDER DECISION DECK ==================== */
function initTinderDeck() {
  const diffFilter = document.getElementById('filter-difficulty').value;
  const sortBy = document.getElementById('sort-by').value;
  const searchKw = (document.getElementById('search-kw').value || '').toLowerCase().trim();

  // Candidate pool for the active pillar
  let candidates = allCandidates[tinderPillar] || allArticles.filter(a => a.pillar === tinderPillar);

  // Filter candidates whose target month matches or have seasonal relevance
  let deck = candidates.filter(c => {
    // Exclude already approved articles
    let isAlreadyApproved = false;
    Object.values(approvedRoadmap).forEach(weekObj => {
      if (weekObj && weekObj[tinderPillar] && weekObj[tinderPillar].id === c.id) {
        isAlreadyApproved = true;
      }
    });
    if (isAlreadyApproved) return false;

    if (diffFilter !== 'all' && c.difficultyLevel !== diffFilter) return false;
    if (searchKw) {
      const matchPrimary = (c.primaryKeyword || '').toLowerCase().includes(searchKw);
      const matchTitle = (c.recommendedTitle || '').toLowerCase().includes(searchKw);
      if (!matchPrimary && !matchTitle) return false;
    }
    return true;
  });

  // Sort candidates
  if (sortBy === 'rankability') {
    deck.sort((a, b) => (b.rankabilityScore || 0) - (a.rankabilityScore || 0));
  } else if (sortBy === 'volume') {
    deck.sort((a, b) => (b.primaryVolume || 0) - (a.primaryVolume || 0));
  } else {
    deck.sort((a, b) => (b.priorityScore || 0) - (a.priorityScore || 0));
  }

  tinderDeck = deck;
  tinderIndex = 0;
}

function setTinderMonth(m) {
  tinderMonth = m;
  initTinderDeck();
  render();
}

function setTinderPillar(p) {
  tinderPillar = p;
  initTinderDeck();
  render();
}

function renderTinderView(container) {
  const monthWeeks = MONTH_WEEKS[tinderMonth] || [1, 2, 3, 4];
  const quotaPerPillar = monthWeeks.length; // e.g. 4 or 5
  const approvedInPillar = getPillarApprovedInMonth(tinderPillar, tinderMonth);
  const currentCard = tinderDeck[tinderIndex];

  let html = `
    <div class="tinder-container">
      <div class="tinder-header">
        <div class="tinder-header-top">
          <div class="tinder-month-select">
            <span>📅 <strong>Month to Plan:</strong></span>
            <select onchange="setTinderMonth(this.value)">
              ${MONTHS.map(m => `<option value="${m}" ${m === tinderMonth ? 'selected' : ''}>${m} 2026 (${(MONTH_WEEKS[m]||[]).length} Weeks)</option>`).join('')}
            </select>
          </div>
          <div class="tinder-progress">
            Candidate <strong>${tinderDeck.length > 0 ? tinderIndex + 1 : 0}</strong> of <strong>${tinderDeck.length}</strong>
          </div>
        </div>

        <!-- Pillar Quota Tabs -->
        <div class="tinder-pillar-tabs">
          ${PILLARS.map(p => {
            const count = getPillarApprovedInMonth(p, tinderMonth);
            const isDone = count >= quotaPerPillar;
            const icon = p === 'Fencing' ? '🌿' : p === 'Power Tools' ? '⚡' : '🧱';
            return `
              <div class="pillar-tab ${p === tinderPillar ? 'active' : ''}" onclick="setTinderPillar('${p}')">
                <span class="pillar-tab-title">${icon} ${p}</span>
                <span class="pillar-tab-count ${isDone ? 'complete' : ''}">${count} / ${quotaPerPillar} Approved</span>
              </div>
            `;
          }).join('')}
        </div>
      </div>

      <div class="tinder-card-wrapper" id="tinder-card-box">
  `;

  if (approvedInPillar >= quotaPerPillar) {
    const nextPillar = PILLARS.find(p => getPillarApprovedInMonth(p, tinderMonth) < quotaPerPillar);

    html += `
      <div class="tinder-card" style="text-align:center; padding: 3.5rem 2rem;">
        <h2 style="color:#10b981;">🎉 ${tinderPillar} for ${tinderMonth} is Fully Filled!</h2>
        <p style="color:var(--text-muted); margin-top:0.75rem; font-size:1rem;">
          You have approved all <strong>${quotaPerPillar}</strong> weekly articles for this pillar in ${tinderMonth}.
        </p>
        <div style="margin-top:2rem; display:flex; justify-content:center; gap:1rem; flex-wrap:wrap;">
          ${nextPillar ? `
            <button class="btn-action" style="padding:0.75rem 1.5rem; font-size:0.95rem" onclick="setTinderPillar('${nextPillar}')">
              Next: Review ${nextPillar} &rarr;
            </button>
          ` : `
            <button class="btn-action" style="background:#10b981; padding:0.75rem 1.5rem; font-size:0.95rem" onclick="switchView('calendar')">
              🚀 View Complete ${tinderMonth} in 52-Week Roadmap
            </button>
            <button class="btn-action btn-secondary" onclick="setTinderMonth(MONTHS[(MONTHS.indexOf(tinderMonth)+1)%12])">
              Plan Next Month (${MONTHS[(MONTHS.indexOf(tinderMonth)+1)%12]}) &rarr;
            </button>
          `}
        </div>
      </div>
    `;
  } else if (!currentCard) {
    html += `
      <div class="tinder-card" style="text-align:center; padding: 3.5rem 2rem;">
        <h2>🔍 No More Candidates Matching Filters</h2>
        <p style="color:var(--text-muted); margin-top:0.75rem;">
          Try adjusting difficulty or search filters to view more topics.
        </p>
        <div style="margin-top:1.5rem; display:flex; justify-content:center; gap:1rem;">
          <button class="btn-action btn-secondary" onclick="document.getElementById('filter-difficulty').value='all'; applyFilters();">
            Reset Filters
          </button>
        </div>
      </div>
    `;
  } else {
    const pillarClass = currentCard.pillar === 'Fencing' ? 'badge-fencing' : currentCard.pillar === 'Power Tools' ? 'badge-power-tools' : 'badge-building-materials';
    const diffClass = currentCard.difficultyLevel === 'Easy to Rank' ? 'diff-easy' : currentCard.difficultyLevel === 'Moderate' ? 'diff-moderate' : 'diff-hard';

    html += `
      <div class="tinder-card" id="active-card">
        <div class="tinder-top-row">
          <span class="pillar-badge ${pillarClass}">${currentCard.pillar}</span>
          <span class="diff-badge ${diffClass}">
            ${currentCard.difficultyLevel === 'Easy to Rank' ? '🟢' : currentCard.difficultyLevel === 'Moderate' ? '🟡' : '🔴'}
            ${currentCard.difficultyLevel} (Comp: ${currentCard.difficulty || 0}/100)
          </span>
          <span class="week-tag">Next Slot: Week ${getNextOpenWeek(tinderPillar, tinderMonth)}</span>
        </div>

        <!-- Editable Content Title -->
        <div class="title-edit-container">
          <label class="title-edit-label" for="card-title-input">
            ✏️ Content Title (Click below to edit before approving):
          </label>
          <input
            type="text"
            id="card-title-input"
            class="title-edit-input"
            value="${escapeHtml(currentCard.recommendedTitle || currentCard.primaryKeyword)}"
            placeholder="Enter custom article title..."
            oninput="currentCardTitleEdited(this.value)"
          />
        </div>

        <div class="tinder-primary-kw">
          🎯 Target Keyword: <span>${escapeHtml(currentCard.primaryKeyword)}</span>
        </div>

        <div class="tinder-meta-grid">
          <div class="tinder-meta-box">
            <div class="lbl">Search Volume</div>
            <div class="val">${(currentCard.primaryVolume || 0).toLocaleString()} <span style="font-size:0.7rem; font-weight:normal; color:#94a3b8">/mo</span></div>
          </div>
          <div class="tinder-meta-box">
            <div class="lbl">Rankability Score</div>
            <div class="val" style="color:#10b981">${currentCard.rankabilityScore || 0}</div>
          </div>
          <div class="tinder-meta-box">
            <div class="lbl">Seasonal Peak</div>
            <div class="val">${currentCard.peakMonth} <span style="font-size:0.7rem; color:#f59e0b">(+8w lead)</span></div>
          </div>
          <div class="tinder-meta-box">
            <div class="lbl">Commercial CPC</div>
            <div class="val">£${(currentCard.cpc || 0).toFixed(2)}</div>
          </div>
        </div>

        <!-- Grouped Keywords Section -->
        <div class="grouped-keywords-container">
          <div class="grouped-kw-header">
            <span>Grouped Similar Keywords (${(currentCard.groupedKeywords || []).length})</span>
            <span style="color:#38bdf8">Total Cluster Vol: ${(currentCard.totalVolume || 0).toLocaleString()}</span>
          </div>

          <table class="grouped-kw-table">
            <thead>
              <tr>
                <th>Keyword</th>
                <th style="text-align:right">Search Vol</th>
                <th style="text-align:right">Comp</th>
                <th style="text-align:right">CPC</th>
              </tr>
            </thead>
            <tbody>
              ${(currentCard.groupedKeywords && currentCard.groupedKeywords.length > 0)
                ? currentCard.groupedKeywords.slice(0, 10).map(k => `
                  <tr>
                    <td style="font-weight:500">${escapeHtml(k.keyword)}</td>
                    <td style="text-align:right">${(k.volume || 0).toLocaleString()}</td>
                    <td style="text-align:right">${k.competition}</td>
                    <td style="text-align:right">£${(k.cpc || 0).toFixed(2)}</td>
                  </tr>
                `).join('')
                : '<tr><td colspan="4" style="color:var(--text-muted)">No secondary variations attached</td></tr>'
              }
            </tbody>
          </table>
        </div>

        <button class="btn-card-view" style="width:100%" onclick="openBriefModal('${currentCard.id}')">
          🔍 Inspect Full Article Brief & Outline
        </button>
      </div>

      <div class="tinder-actions">
        <button class="btn-tinder btn-tinder-no" onclick="handleTinderDecision(false)" title="No / Skip (Left Arrow or N)">
          ✕
        </button>
        <button class="btn-tinder btn-tinder-yes" onclick="handleTinderDecision(true)" title="Yes / Approve for Slot (Right Arrow or Y)">
          ✓
        </button>
      </div>

      <div class="tinder-hints">
        Press <span class="key-hint">Y</span> or <span class="key-hint">&rarr;</span> to Approve |
        Press <span class="key-hint">N</span> or <span class="key-hint">&larr;</span> to Skip
      </div>
    `;
  }

  html += `
      </div>
    </div>
  `;

  container.innerHTML = html;
}

function currentCardTitleEdited(val) {
  const currentCard = tinderDeck[tinderIndex];
  if (currentCard) {
    currentCard.recommendedTitle = val.trim();
  }
}

function getNextOpenWeek(pillar, month) {
  const weeks = MONTH_WEEKS[month] || [1, 2, 3, 4];
  for (const w of weeks) {
    if (!approvedRoadmap[w] || !approvedRoadmap[w][pillar]) {
      return w;
    }
  }
  return weeks[0];
}

function handleTinderDecision(approved) {
  const cardEl = document.getElementById('active-card');
  if (!cardEl) return;

  const currentCard = tinderDeck[tinderIndex];

  if (approved) {
    // Read current title from input if present
    const inputEl = document.getElementById('card-title-input');
    if (inputEl && inputEl.value.trim().length > 0) {
      currentCard.recommendedTitle = inputEl.value.trim();
    }

    cardEl.classList.add('swipe-right');

    // Assign to next open week in this month
    const targetWeek = getNextOpenWeek(tinderPillar, tinderMonth);
    if (!approvedRoadmap[targetWeek]) {
      approvedRoadmap[targetWeek] = {};
    }

    const assignedItem = {
      ...currentCard,
      weekNumber: targetWeek,
      scheduledMonth: tinderMonth,
      status: 'Scheduled'
    };

    approvedRoadmap[targetWeek][tinderPillar] = assignedItem;
    saveRoadmap();
    updateStats();
    showToast(`Approved for Week ${targetWeek}: "${assignedItem.recommendedTitle}"`);
  } else {
    cardEl.classList.add('swipe-left');
    showToast(`Skipped candidate`);
  }

  setTimeout(() => {
    tinderIndex++;
    render();
  }, 220);
}

function setupKeyboardShortcuts() {
  window.addEventListener('keydown', (e) => {
    if (currentView !== 'tinder') return;
    if (document.getElementById('brief-modal').classList.contains('active')) return;
    if (document.activeElement && document.activeElement.tagName === 'INPUT') return;

    if (e.key === 'y' || e.key === 'Y' || e.key === 'ArrowRight') {
      handleTinderDecision(true);
    } else if (e.key === 'n' || e.key === 'N' || e.key === 'ArrowLeft') {
      handleTinderDecision(false);
    }
  });
}

function saveRoadmap() {
  localStorage.setItem('lawsons_approved_roadmap', JSON.stringify(approvedRoadmap));
}

function removeApprovedSlot(weekNum, pillar, event) {
  if (event) event.stopPropagation();
  if (approvedRoadmap[weekNum] && approvedRoadmap[weekNum][pillar]) {
    delete approvedRoadmap[weekNum][pillar];
    saveRoadmap();
    updateStats();
    render();
    showToast(`Removed ${pillar} from Week ${weekNum}`);
  }
}

function jumpToDecisionDeck(month, pillar) {
  tinderMonth = month;
  tinderPillar = pillar;
  switchView('tinder');
}

/* ==================== 52-WEEK ROADMAP VIEW ==================== */
function renderCalendar(container) {
  let html = `
    <div class="calendar-view">
      <div style="display:flex; justify-content:space-between; align-items:center; background:var(--bg-secondary); padding:0.85rem 1.25rem; border-radius:10px; border:1px solid var(--border-color);">
        <div>
          <strong style="color:#38bdf8; font-size:1.1rem;">52-Week Editorial Roadmap</strong>
          <span style="color:var(--text-muted); font-size:0.85rem; margin-left:0.5rem;">
            (${getApprovedCount()} / 156 Approved Slots Filled)
          </span>
        </div>
        <div style="display:flex; gap:0.65rem;">
          <button class="btn-action" style="padding:0.4rem 0.8rem; font-size:0.8rem;" onclick="switchView('tinder')">
            🔥 Open Decision Deck to Fill Slots
          </button>
          <button class="btn-action btn-danger" style="padding:0.4rem 0.8rem; font-size:0.8rem;" onclick="clearRoadmap()">
            Reset All Slots
          </button>
          <button class="btn-action btn-secondary" style="padding:0.4rem 0.8rem; font-size:0.8rem;" onclick="autoFillRoadmap()">
            ⚡ Pre-fill All Defaults
          </button>
        </div>
      </div>
  `;

  MONTHS.forEach(m => {
    const monthWeeks = MONTH_WEEKS[m] || [];
    let monthApprovedCount = 0;
    monthWeeks.forEach(w => {
      PILLARS.forEach(p => {
        if (approvedRoadmap[w] && approvedRoadmap[w][p]) monthApprovedCount++;
      });
    });

    html += `
      <div class="month-block">
        <div class="month-header">
          <div class="month-title">
            <span>📅 ${m} 2026</span>
          </div>
          <span class="month-cadence-pill" style="${monthApprovedCount === monthWeeks.length * 3 ? 'background:#10b981; color:white;' : ''}">
            ${monthApprovedCount} / ${monthWeeks.length * 3} Slots Approved
          </span>
        </div>
        <div class="weeks-grid">
          ${monthWeeks.map(w => {
            const fencingArticle = approvedRoadmap[w] ? approvedRoadmap[w]['Fencing'] : null;
            const toolsArticle = approvedRoadmap[w] ? approvedRoadmap[w]['Power Tools'] : null;
            const materialsArticle = approvedRoadmap[w] ? approvedRoadmap[w]['Building Materials'] : null;

            return `
              <div class="week-row">
                <div class="week-label">Week ${w}</div>
                <div>${fencingArticle ? renderSlotCard(fencingArticle, 'slot-fencing', w, 'Fencing') : renderEmptySlot(m, 'Fencing', w)}</div>
                <div>${toolsArticle ? renderSlotCard(toolsArticle, 'slot-tools', w, 'Power Tools') : renderEmptySlot(m, 'Power Tools', w)}</div>
                <div>${materialsArticle ? renderSlotCard(materialsArticle, 'slot-materials', w, 'Building Materials') : renderEmptySlot(m, 'Building Materials', w)}</div>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `;
  });

  html += `</div>`;
  container.innerHTML = html;
}

function renderEmptySlot(month, pillar, weekNum) {
  const icon = pillar === 'Fencing' ? '🌿' : pillar === 'Power Tools' ? '⚡' : '🧱';
  return `
    <div class="slot-empty" onclick="jumpToDecisionDeck('${month}', '${pillar}')" title="Click to review and approve an article for this slot">
      <span>+ ${icon} Approve ${pillar} (Wk ${weekNum})</span>
    </div>
  `;
}

function renderSlotCard(a, slotClass, weekNum, pillar) {
  const diffClass = a.difficultyLevel === 'Easy to Rank' ? 'diff-easy' : a.difficultyLevel === 'Moderate' ? 'diff-moderate' : 'diff-hard';

  return `
    <div class="slot-card ${slotClass}" onclick="openBriefModal('${a.id}')">
      <div class="slot-top-row">
        <span class="slot-pillar">${a.pillar}</span>
        <div style="display:flex; align-items:center; gap:0.4rem;">
          <span class="diff-badge ${diffClass}" style="font-size:0.62rem; padding:0.1rem 0.35rem">
            ${a.difficultyLevel}
          </span>
          <button class="slot-remove-btn" onclick="removeApprovedSlot(${weekNum}, '${pillar}', event)" title="Remove from Roadmap">&times;</button>
        </div>
      </div>
      <div class="slot-title">${escapeHtml(a.recommendedTitle || a.primaryKeyword)}</div>
      <div class="slot-metrics">
        <span>🎯 ${escapeHtml(a.primaryKeyword)}</span> &bull;
        <span>${(a.primaryVolume || 0).toLocaleString()} vol</span> &bull;
        <span>Score: ${a.rankabilityScore || 0}</span>
      </div>
    </div>
  `;
}

/* ==================== KANBAN BOARD VIEW ==================== */
function renderKanban(container) {
  // Collect all approved articles
  const approvedList = [];
  Object.values(approvedRoadmap).forEach(weekObj => {
    if (weekObj) {
      PILLARS.forEach(p => {
        if (weekObj[p]) approvedList.push(weekObj[p]);
      });
    }
  });

  if (approvedList.length === 0) {
    container.innerHTML = `
      <div style="text-align:center; padding: 4rem 2rem; background:var(--bg-secondary); border-radius:12px; border:1px solid var(--border-color); max-width:650px; margin:2rem auto;">
        <h2>📋 Kanban Board is Currently Empty</h2>
        <p style="color:var(--text-muted); margin-top:0.75rem;">
          Use the <strong>Decision Deck</strong> to approve articles for each month. Approved articles will automatically appear here!
        </p>
        <button class="btn-action" style="margin:1.5rem auto 0; padding:0.65rem 1.25rem;" onclick="switchView('tinder')">
          🔥 Open Decision Deck &rarr;
        </button>
      </div>
    `;
    return;
  }

  let html = `<div class="kanban-board">`;

  KANBAN_STAGES.forEach(stage => {
    const stageArticles = approvedList.filter(a => (a.status || 'Scheduled') === stage.id);

    html += `
      <div class="kanban-column" data-stage="${stage.id}">
        <div class="kanban-header">
          <div class="kanban-title">
            <span class="col-dot" style="background:${stage.color}"></span>
            ${stage.label}
          </div>
          <span class="kanban-count">${stageArticles.length}</span>
        </div>
        <div class="kanban-cards" ondragover="onDragOver(event)" ondragleave="onDragLeave(event)" ondrop="onDrop(event, '${stage.id}')">
          ${stageArticles.map(a => renderKanbanCard(a)).join('')}
        </div>
      </div>
    `;
  });

  html += `</div>`;
  container.innerHTML = html;
}

function renderKanbanCard(a) {
  const pillarClass = a.pillar === 'Fencing' ? 'badge-fencing' : a.pillar === 'Power Tools' ? 'badge-power-tools' : 'badge-building-materials';
  const diffClass = a.difficultyLevel === 'Easy to Rank' ? 'diff-easy' : a.difficultyLevel === 'Moderate' ? 'diff-moderate' : 'diff-hard';

  return `
    <div class="kanban-card" draggable="true" ondragstart="onDragStart(event, '${a.id}')">
      <div class="card-top">
        <span class="pillar-badge ${pillarClass}">${a.pillar}</span>
        <span class="week-tag">Wk ${a.weekNumber} (${a.scheduledMonth})</span>
      </div>
      <div class="card-title">${escapeHtml(a.recommendedTitle || a.primaryKeyword)}</div>
      <div class="card-target-kw">🎯 Primary: ${escapeHtml(a.primaryKeyword)}</div>
      <div style="display:flex; justify-content:space-between; align-items:center;">
        <span class="diff-badge ${diffClass}">
          ${a.difficultyLevel}
        </span>
        <span class="card-grouped-pill">${(a.groupedKeywords || []).length} similar kw</span>
      </div>
      <div class="card-meta-row">
        <div class="meta-stats">
          <span class="meta-stat">Vol: <span>${(a.primaryVolume || 0).toLocaleString()}</span></span>
          <span class="meta-stat">Rank: <span>${a.rankabilityScore || 0}</span></span>
        </div>
      </div>
      <button class="btn-card-view" onclick="openBriefModal('${a.id}')">🔍 View Brief & Grouped Keywords</button>
    </div>
  `;
}

/* ==================== DRAG & DROP ==================== */
let draggedCardId = null;

function onDragStart(e, id) {
  draggedCardId = id;
  e.dataTransfer.setData('text/plain', id);
}

function onDragOver(e) {
  e.preventDefault();
  e.currentTarget.classList.add('drag-over');
}

function onDragLeave(e) {
  e.currentTarget.classList.remove('drag-over');
}

function onDrop(e, newStage) {
  e.preventDefault();
  e.currentTarget.classList.remove('drag-over');
  if (!draggedCardId) return;

  Object.values(approvedRoadmap).forEach(weekObj => {
    if (weekObj) {
      PILLARS.forEach(p => {
        if (weekObj[p] && weekObj[p].id === draggedCardId) {
          weekObj[p].status = newStage;
        }
      });
    }
  });

  saveRoadmap();
  render();
  showToast(`Updated to ${newStage}`);
}

/* ==================== CLEAR & AUTO-FILL ==================== */
function clearRoadmap() {
  if (confirm('Are you sure you want to clear all approved roadmap slots?')) {
    approvedRoadmap = {};
    saveRoadmap();
    updateStats();
    render();
    showToast('Roadmap cleared');
  }
}

function autoFillRoadmap() {
  if (confirm('Pre-fill all 52 weeks with the AI recommended schedule?')) {
    approvedRoadmap = {};
    allArticles.forEach(a => {
      const w = a.weekNumber;
      if (!approvedRoadmap[w]) approvedRoadmap[w] = {};
      approvedRoadmap[w][a.pillar] = { ...a, status: 'Scheduled' };
    });
    saveRoadmap();
    updateStats();
    render();
    showToast('Pre-filled all 156 slots');
  }
}

/* ==================== MODAL ==================== */
function openBriefModal(id) {
  // Look in approved or allArticles
  let a = null;
  Object.values(approvedRoadmap).forEach(wObj => {
    if (wObj) {
      PILLARS.forEach(p => {
        if (wObj[p] && wObj[p].id === id) a = wObj[p];
      });
    }
  });
  if (!a) a = allArticles.find(item => item.id === id);
  if (!a) return;

  selectedBrief = a;
  document.getElementById('modal-title').textContent = `${a.pillar}: ${a.recommendedTitle || a.primaryKeyword}`;

  const diffClass = a.difficultyLevel === 'Easy to Rank' ? 'diff-easy' : a.difficultyLevel === 'Moderate' ? 'diff-moderate' : 'diff-hard';

  const body = document.getElementById('modal-body');
  body.innerHTML = `
    <div class="brief-meta-grid">
      <div class="meta-box">
        <div class="m-lbl">Target Primary Keyword</div>
        <div class="m-val" style="font-size:0.85rem">${escapeHtml(a.primaryKeyword)}</div>
      </div>
      <div class="meta-box">
        <div class="m-lbl">Rankability & Difficulty</div>
        <div class="m-val" style="font-size:0.85rem">
          <span class="diff-badge ${diffClass}">${a.difficultyLevel} (Comp: ${a.difficulty || 0}/100)</span>
        </div>
      </div>
      <div class="meta-box">
        <div class="m-lbl">Peak Search Demand</div>
        <div class="m-val">${a.peakMonth} (Lead time: 8 wks)</div>
      </div>
      <div class="meta-box">
        <div class="m-lbl">Search Volume / CPC</div>
        <div class="m-val">${(a.primaryVolume || 0).toLocaleString()} / £${(a.cpc || 0).toFixed(2)}</div>
      </div>
    </div>

    <div>
      <div class="brief-section-title">Approved Content Title</div>
      <div style="font-size:1.15rem; font-weight:700; color:#f8fafc; padding:0.65rem 0.85rem; background:rgba(255,255,255,0.04); border-radius:8px; border:1px solid var(--border-color);">
        ${escapeHtml(a.recommendedTitle || a.primaryKeyword)}
      </div>
    </div>

    <div>
      <div class="brief-section-title">Similar Keywords Grouped Under This Title (${(a.groupedKeywords || []).length})</div>
      <table class="grouped-kw-table" style="max-height:220px">
        <thead>
          <tr>
            <th>Keyword</th>
            <th style="text-align:right">Search Vol</th>
            <th style="text-align:right">Competition</th>
            <th style="text-align:right">CPC</th>
          </tr>
        </thead>
        <tbody>
          ${(a.groupedKeywords && a.groupedKeywords.length > 0)
            ? a.groupedKeywords.map(k => `
              <tr>
                <td style="font-weight:500">${escapeHtml(k.keyword)}</td>
                <td style="text-align:right">${(k.volume || 0).toLocaleString()}</td>
                <td style="text-align:right">${k.competition}</td>
                <td style="text-align:right">£${(k.cpc || 0).toFixed(2)}</td>
              </tr>
            `).join('')
            : '<tr><td colspan="4" style="color:var(--text-muted)">No secondary variations attached</td></tr>'
          }
        </tbody>
      </table>
    </div>

    <div>
      <div class="brief-section-title">Frequently Asked Questions (PAA Spine) (${(a.paaQuestions || []).length})</div>
      <ul class="paa-list">
        ${(a.paaQuestions && a.paaQuestions.length > 0)
          ? a.paaQuestions.map(q => `<li class="paa-item"><span>❓</span> ${escapeHtml(q)}</li>`).join('')
          : '<li class="paa-item" style="border-left-color:#64748b"><span>💡</span> Auto-generate questions via Blog Creation Tool Gemini API</li>'}
      </ul>
    </div>
  `;

  document.getElementById('brief-modal').classList.add('active');
}

function closeModal() {
  document.getElementById('brief-modal').classList.remove('active');
  selectedBrief = null;
}

function closeModalOnOutsideClick(e) {
  if (e.target.id === 'brief-modal') {
    closeModal();
  }
}

function copyBriefPayload() {
  if (!selectedBrief) return;
  const payload = {
    keyword: selectedBrief.primaryKeyword,
    title: selectedBrief.recommendedTitle,
    pillar: selectedBrief.pillar,
    audience: selectedBrief.audience,
    intent: selectedBrief.intent,
    difficulty: selectedBrief.difficulty,
    difficultyLevel: selectedBrief.difficultyLevel,
    groupedKeywords: selectedBrief.groupedKeywords || [],
    secondaryKeywords: selectedBrief.secondaryKeywords || [],
    paaQuestions: selectedBrief.paaQuestions || [],
    scheduledWeek: selectedBrief.weekNumber,
    scheduledMonth: selectedBrief.scheduledMonth
  };

  navigator.clipboard.writeText(JSON.stringify(payload, null, 2)).then(() => {
    showToast('Copied brief JSON to clipboard!');
  });
}

/* ==================== EXPORT UTILS ==================== */
function exportCSV() {
  const approvedList = [];
  Object.values(approvedRoadmap).forEach(wObj => {
    if (wObj) {
      PILLARS.forEach(p => {
        if (wObj[p]) approvedList.push(wObj[p]);
      });
    }
  });

  const listToExport = approvedList.length > 0 ? approvedList : allArticles;

  const rows = [
    ['Week', 'Month', 'Pillar', 'Content Title', 'Target Keyword', 'Difficulty Level', 'Difficulty', 'Rankability Score', 'Volume', 'CPC', 'Status']
  ];

  listToExport.forEach(a => {
    rows.push([
      a.weekNumber,
      `"${a.scheduledMonth}"`,
      `"${a.pillar}"`,
      `"${(a.recommendedTitle || '').replace(/"/g, '""')}"`,
      `"${(a.primaryKeyword || '').replace(/"/g, '""')}"`,
      `"${a.difficultyLevel}"`,
      a.difficulty,
      a.rankabilityScore,
      a.primaryVolume,
      a.cpc,
      `"${a.status || 'Scheduled'}"`
    ]);
  });

  const csvContent = 'data:text/csv;charset=utf-8,' + rows.map(e => e.join(',')).join('\n');
  const encodedUri = encodeURI(csvContent);
  const link = document.createElement('a');
  link.setAttribute('href', encodedUri);
  link.setAttribute('download', 'lawsons_content_calendar_approved.csv');
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  showToast(`Exported ${listToExport.length} articles to CSV`);
}

function exportJSON() {
  const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(approvedRoadmap, null, 2));
  const link = document.createElement('a');
  link.setAttribute('href', dataStr);
  link.setAttribute('download', 'lawsons_approved_roadmap.json');
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  showToast('Exported approved roadmap JSON');
}

function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.style.display = 'block';
  setTimeout(() => {
    t.style.display = 'none';
  }, 2400);
}

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
