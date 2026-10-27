/**
 * Lawsons Content Engine & Editorial Planner
 * Interactive Decision Deck (Tinder Style), Kanban, and 52-Week Roadmap
 */

let allArticles = [];
let allWeeks = [];
let allCandidates = {};
let currentView = 'tinder'; // default to Tinder decision deck
let selectedBrief = null;

// Tinder Mode State
let tinderMonth = 'Jan';
let tinderDeck = [];
let tinderIndex = 0;
let approvedCount = {};

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

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

    // Restore saved statuses from localStorage
    const savedStatuses = JSON.parse(localStorage.getItem('lawsons_card_statuses') || '{}');
    allArticles.forEach(a => {
      if (savedStatuses[a.id]) {
        a.status = savedStatuses[a.id];
      }
    });

    // Count approved per month
    MONTHS.forEach(m => {
      approvedCount[m] = allArticles.filter(a => a.scheduledMonth === m && a.status === 'Scheduled').length;
    });

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

function updateStats() {
  document.getElementById('stat-total-articles').textContent = allArticles.length;
  const totalVol = allArticles.reduce((sum, a) => sum + (a.primaryVolume || 0), 0);
  document.getElementById('stat-total-vol').textContent = totalVol.toLocaleString() + '/mo';
  const easyCount = allArticles.filter(a => a.difficultyLevel === 'Easy to Rank').length;
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

function getFilteredArticles() {
  const pillarFilter = document.getElementById('filter-pillar').value;
  const diffFilter = document.getElementById('filter-difficulty').value;
  const sortBy = document.getElementById('sort-by').value;
  const searchKw = (document.getElementById('search-kw').value || '').toLowerCase().trim();

  let list = allArticles.filter(a => {
    if (pillarFilter !== 'all' && a.pillar !== pillarFilter) return false;
    if (diffFilter !== 'all' && a.difficultyLevel !== diffFilter) return false;
    if (searchKw) {
      const matchPrimary = (a.primaryKeyword || '').toLowerCase().includes(searchKw);
      const matchTitle = (a.recommendedTitle || '').toLowerCase().includes(searchKw);
      const matchGrouped = (a.groupedKeywords || []).some(k => k.keyword.toLowerCase().includes(searchKw));
      if (!matchPrimary && !matchTitle && !matchGrouped) return false;
    }
    return true;
  });

  // Sort
  if (sortBy === 'rankability') {
    list.sort((a, b) => (b.rankabilityScore || 0) - (a.rankabilityScore || 0));
  } else if (sortBy === 'volume') {
    list.sort((a, b) => (b.primaryVolume || 0) - (a.primaryVolume || 0));
  } else if (sortBy === 'priority') {
    list.sort((a, b) => (b.priorityScore || 0) - (a.priorityScore || 0));
  }

  return list;
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

/* ==================== TINDER / MONTHLY DECISION DECK ==================== */
function initTinderDeck() {
  const pillarFilter = document.getElementById('filter-pillar').value;
  const diffFilter = document.getElementById('filter-difficulty').value;
  const sortBy = document.getElementById('sort-by').value;

  // Grab articles scheduled for the selected month or candidates
  let deck = allArticles.filter(a => a.scheduledMonth === tinderMonth);

  if (pillarFilter !== 'all') {
    deck = deck.filter(a => a.pillar === pillarFilter);
  }
  if (diffFilter !== 'all') {
    deck = deck.filter(a => a.difficultyLevel === diffFilter);
  }

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

function renderTinderView(container) {
  const currentCard = tinderDeck[tinderIndex];

  let html = `
    <div class="tinder-container">
      <div class="tinder-header">
        <div class="tinder-month-select">
          <span>📅 Month to Review:</span>
          <select onchange="setTinderMonth(this.value)">
            ${MONTHS.map(m => `<option value="${m}" ${m === tinderMonth ? 'selected' : ''}>${m} 2026</option>`).join('')}
          </select>
        </div>
        <div class="tinder-progress">
          Card <strong>${tinderDeck.length > 0 ? tinderIndex + 1 : 0}</strong> of <strong>${tinderDeck.length}</strong> in queue
        </div>
      </div>

      <div class="tinder-card-wrapper" id="tinder-card-box">
  `;

  if (!currentCard) {
    html += `
      <div class="tinder-card" style="text-align:center; padding: 4rem 2rem;">
        <h2>🎉 All Caught Up for ${tinderMonth}!</h2>
        <p style="color:var(--text-muted); margin-top:0.75rem;">
          You have reviewed all available topic candidates for this month.
        </p>
        <div style="margin-top:1.5rem; display:flex; justify-content:center; gap:1rem;">
          <button class="btn-action" onclick="setTinderMonth(MONTHS[(MONTHS.indexOf(tinderMonth)+1)%12])">
            Review Next Month (${MONTHS[(MONTHS.indexOf(tinderMonth)+1)%12]}) &rarr;
          </button>
          <button class="btn-action btn-secondary" onclick="initTinderDeck(); render();">
            Reset & Re-review
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
          <span class="week-tag">Week ${currentCard.weekNumber} (${currentCard.scheduledMonth})</span>
        </div>

        <div class="tinder-title">${escapeHtml(currentCard.recommendedTitle || currentCard.primaryKeyword)}</div>

        <div class="tinder-primary-kw">
          🎯 Primary Target: <span>${escapeHtml(currentCard.primaryKeyword)}</span>
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

        <!-- Grouped Keywords Section under Content Title -->
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
        <button class="btn-tinder btn-tinder-no" onclick="handleTinderDecision(false)" title="No / Skip & Swap (Left Arrow or N)">
          ✕
        </button>
        <button class="btn-tinder btn-tinder-yes" onclick="handleTinderDecision(true)" title="Yes / Approve for Month (Right Arrow or Y)">
          ✓
        </button>
      </div>

      <div class="tinder-hints">
        Press <span class="key-hint">Y</span> or <span class="key-hint">&rarr;</span> to Approve |
        Press <span class="key-hint">N</span> or <span class="key-hint">&larr;</span> to Skip/Swap
      </div>
    `;
  }

  html += `
      </div>
    </div>
  `;

  container.innerHTML = html;
}

function handleTinderDecision(approved) {
  const cardEl = document.getElementById('active-card');
  if (!cardEl) return;

  const currentCard = tinderDeck[tinderIndex];

  if (approved) {
    cardEl.classList.add('swipe-right');
    currentCard.status = 'Scheduled';
    saveStatus(currentCard.id, 'Scheduled');
    showToast(`Approved: "${currentCard.recommendedTitle || currentCard.primaryKeyword}"`);
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

    if (e.key === 'y' || e.key === 'Y' || e.key === 'ArrowRight') {
      handleTinderDecision(true);
    } else if (e.key === 'n' || e.key === 'N' || e.key === 'ArrowLeft') {
      handleTinderDecision(false);
    }
  });
}

function saveStatus(id, status) {
  const saved = JSON.parse(localStorage.getItem('lawsons_card_statuses') || '{}');
  saved[id] = status;
  localStorage.setItem('lawsons_card_statuses', JSON.stringify(saved));
}

/* ==================== KANBAN BOARD ==================== */
function renderKanban(container) {
  const filtered = getFilteredArticles();

  let html = `<div class="kanban-board">`;

  KANBAN_STAGES.forEach(stage => {
    const stageArticles = filtered.filter(a => (a.status || 'Briefing') === stage.id);

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
          ${a.difficultyLevel === 'Easy to Rank' ? '🟢' : a.difficultyLevel === 'Moderate' ? '🟡' : '🔴'}
          ${a.difficultyLevel}
        </span>
        <span class="card-grouped-pill">${(a.groupedKeywords || []).length} similar kw</span>
      </div>
      <div class="card-meta-row">
        <div class="meta-stats">
          <span class="meta-stat">Vol: <span>${(a.primaryVolume || 0).toLocaleString()}</span></span>
          <span class="meta-stat">Rank Score: <span>${a.rankabilityScore || 0}</span></span>
        </div>
      </div>
      <button class="btn-card-view" onclick="openBriefModal('${a.id}')">🔍 View Brief & Grouped Keywords</button>
    </div>
  `;
}

/* ==================== 52-WEEK ROADMAP ==================== */
function renderCalendar(container) {
  const filtered = getFilteredArticles();
  const filterMap = new Set(filtered.map(a => a.id));

  let html = `<div class="calendar-view">`;

  MONTHS.forEach(m => {
    const monthWeeks = allWeeks.filter(w => w.month === m);
    if (monthWeeks.length === 0) return;

    html += `
      <div class="month-block">
        <div class="month-header">
          <div class="month-title">
            <span>📅 ${m} 2026</span>
          </div>
          <span class="month-cadence-pill">${monthWeeks.length * 3} Articles (3/wk balanced)</span>
        </div>
        <div class="weeks-grid">
          ${monthWeeks.map(w => {
            const fencingArticle = w.articles.find(a => a.pillar === 'Fencing');
            const toolsArticle = w.articles.find(a => a.pillar === 'Power Tools');
            const materialsArticle = w.articles.find(a => a.pillar === 'Building Materials');

            const isFencingVisible = fencingArticle && filterMap.has(fencingArticle.id);
            const isToolsVisible = toolsArticle && filterMap.has(toolsArticle.id);
            const isMaterialsVisible = materialsArticle && filterMap.has(materialsArticle.id);

            return `
              <div class="week-row">
                <div class="week-label">Week ${w.weekNumber}</div>
                <div>${fencingArticle && isFencingVisible ? renderSlotCard(fencingArticle, 'slot-fencing') : '<div style="color:#64748b; font-size:0.75rem;">No match</div>'}</div>
                <div>${toolsArticle && isToolsVisible ? renderSlotCard(toolsArticle, 'slot-tools') : '<div style="color:#64748b; font-size:0.75rem;">No match</div>'}</div>
                <div>${materialsArticle && isMaterialsVisible ? renderSlotCard(materialsArticle, 'slot-materials') : '<div style="color:#64748b; font-size:0.75rem;">No match</div>'}</div>
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

function renderSlotCard(a, slotClass) {
  const diffClass = a.difficultyLevel === 'Easy to Rank' ? 'diff-easy' : a.difficultyLevel === 'Moderate' ? 'diff-moderate' : 'diff-hard';

  return `
    <div class="slot-card ${slotClass}" onclick="openBriefModal('${a.id}')">
      <div class="slot-top-row">
        <span class="slot-pillar">${a.pillar}</span>
        <span class="diff-badge ${diffClass}" style="font-size:0.62rem; padding:0.1rem 0.35rem">
          ${a.difficultyLevel}
        </span>
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

  const article = allArticles.find(a => a.id === draggedCardId);
  if (article) {
    article.status = newStage;
    saveStatus(article.id, newStage);
    render();
    showToast(`Updated to ${newStage}`);
  }
}

/* ==================== MODAL ==================== */
function openBriefModal(id) {
  const a = allArticles.find(item => item.id === id);
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
      <div class="brief-section-title">Content Title</div>
      <div style="font-size:1.1rem; font-weight:700; color:#f8fafc; padding:0.5rem; background:rgba(255,255,255,0.03); border-radius:6px;">
        ${escapeHtml(a.recommendedTitle || a.primaryKeyword)}
      </div>
    </div>

    <!-- Grouped Similar Keywords Table -->
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
  window.open('content_calendar_master.csv', '_blank');
  showToast('Downloaded CSV Calendar');
}

function exportJSON() {
  const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(allArticles, null, 2));
  const link = document.createElement('a');
  link.setAttribute('href', dataStr);
  link.setAttribute('download', 'lawsons_content_calendar_master.json');
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  showToast('Downloaded JSON Calendar');
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
