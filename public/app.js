/**
 * Lawsons Content Engine & 52-Week Editorial Calendar
 * Interactive Kanban & Roadmap Controller
 */

let allArticles = [];
let allWeeks = [];
let currentView = 'kanban';
let selectedBrief = null;

const KANBAN_STAGES = [
  { id: 'Briefing', label: 'Briefing / Backlog', color: '#3b82f6' },
  { id: 'Drafting', label: 'Drafting', color: '#8b5cf6' },
  { id: 'In Review', label: 'In Review', color: '#f59e0b' },
  { id: 'Scheduled', label: 'Scheduled', color: '#06b6d4' },
  { id: 'Published', label: 'Published', color: '#10b981' }
];

document.addEventListener('DOMContentLoaded', () => {
  loadData();
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

    // Load saved statuses from localStorage if any
    const savedStatuses = JSON.parse(localStorage.getItem('lawsons_card_statuses') || '{}');
    allArticles.forEach(a => {
      if (savedStatuses[a.id]) {
        a.status = savedStatuses[a.id];
      }
    });

    updateStats();
    render();
  } catch (err) {
    console.error('Failed to load calendar data:', err);
    document.getElementById('main-content').innerHTML = `
      <div style="text-align:center; padding: 3rem; color: #ef4444;">
        <h3>Could not load calendar data.</h3>
        <p>Please ensure <code>scripts/process_data.js</code> has been executed.</p>
      </div>
    `;
  }
}

function updateStats() {
  document.getElementById('stat-total-articles').textContent = allArticles.length;
  const totalVol = allArticles.reduce((sum, a) => sum + (a.primaryVolume || 0), 0);
  document.getElementById('stat-total-vol').textContent = totalVol.toLocaleString() + '/mo';
  const totalPaa = allArticles.reduce((sum, a) => sum + (a.paaQuestions ? a.paaQuestions.length : 0), 0);
  document.getElementById('stat-total-paa').textContent = totalPaa.toLocaleString();
}

function switchView(view) {
  currentView = view;
  document.getElementById('btn-view-kanban').classList.toggle('active', view === 'kanban');
  document.getElementById('btn-view-calendar').classList.toggle('active', view === 'calendar');
  render();
}

function getFilteredArticles() {
  const pillarFilter = document.getElementById('filter-pillar').value;
  const audienceFilter = document.getElementById('filter-audience').value;
  const searchKw = (document.getElementById('search-kw').value || '').toLowerCase().trim();

  return allArticles.filter(a => {
    if (pillarFilter !== 'all' && a.pillar !== pillarFilter) return false;
    if (audienceFilter !== 'all' && a.audience !== audienceFilter) return false;
    if (searchKw) {
      const matchPrimary = (a.primaryKeyword || '').toLowerCase().includes(searchKw);
      const matchTitle = (a.recommendedTitle || '').toLowerCase().includes(searchKw);
      const matchSecondaries = (a.secondaryKeywords || []).some(k => k.toLowerCase().includes(searchKw));
      if (!matchPrimary && !matchTitle && !matchSecondaries) return false;
    }
    return true;
  });
}

function applyFilters() {
  render();
}

function render() {
  const container = document.getElementById('main-content');
  if (currentView === 'kanban') {
    renderKanban(container);
  } else {
    renderCalendar(container);
  }
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
  const audienceClass = a.audience.includes('Trade') ? 'audience-trade' : 'audience-diy';

  return `
    <div class="kanban-card" draggable="true" ondragstart="onDragStart(event, '${a.id}')">
      <div class="card-top">
        <span class="pillar-badge ${pillarClass}">${a.pillar}</span>
        <span class="week-tag">Wk ${a.weekNumber} (${a.scheduledMonth})</span>
      </div>
      <div class="card-title">${escapeHtml(a.recommendedTitle || a.primaryKeyword)}</div>
      <div class="card-target-kw">🎯 ${escapeHtml(a.primaryKeyword)}</div>
      <div class="card-meta-row">
        <div class="meta-stats">
          <span class="meta-stat">Vol: <span>${(a.primaryVolume || 0).toLocaleString()}</span></span>
          <span class="meta-stat">CPC: <span>£${(a.cpc || 0).toFixed(2)}</span></span>
        </div>
        <span class="audience-pill ${audienceClass}">${a.audience.split('&')[0]}</span>
      </div>
      <button class="btn-card-view" onclick="openBriefModal('${a.id}')">🔍 View Brief & PAAs</button>
    </div>
  `;
}

/* ==================== 52-WEEK CALENDAR ROADMAP ==================== */
function renderCalendar(container) {
  const filtered = getFilteredArticles();
  const filterMap = new Set(filtered.map(a => a.id));

  // Group weeks into months
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  let html = `<div class="calendar-view">`;

  months.forEach(m => {
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
                <div>${fencingArticle && isFencingVisible ? renderSlotCard(fencingArticle, 'slot-fencing') : '<div style=\"color:#64748b; font-size:0.75rem;\">No match</div>'}</div>
                <div>${toolsArticle && isToolsVisible ? renderSlotCard(toolsArticle, 'slot-tools') : '<div style=\"color:#64748b; font-size:0.75rem;\">No match</div>'}</div>
                <div>${materialsArticle && isMaterialsVisible ? renderSlotCard(materialsArticle, 'slot-materials') : '<div style=\"color:#64748b; font-size:0.75rem;\">No match</div>'}</div>
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
  return `
    <div class="slot-card ${slotClass}" onclick="openBriefModal('${a.id}')">
      <div class="slot-pillar">${a.pillar} &bull; Peak: ${a.peakMonth}</div>
      <div class="slot-kw">${escapeHtml(a.primaryKeyword)}</div>
      <div class="slot-metrics">
        <span>${(a.primaryVolume || 0).toLocaleString()} vol</span> &bull;
        <span>£${(a.cpc || 0).toFixed(2)} cpc</span> &bull;
        <span>Score: ${a.priorityScore || 0}</span>
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
    // Persist
    const saved = JSON.parse(localStorage.getItem('lawsons_card_statuses') || '{}');
    saved[article.id] = newStage;
    localStorage.setItem('lawsons_card_statuses', JSON.stringify(saved));
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

  const body = document.getElementById('modal-body');
  body.innerHTML = `
    <div class="brief-meta-grid">
      <div class="meta-box">
        <div class="m-lbl">Target Keyword</div>
        <div class="m-val" style="font-size:0.85rem">${escapeHtml(a.primaryKeyword)}</div>
      </div>
      <div class="meta-box">
        <div class="m-lbl">Scheduled Publishing</div>
        <div class="m-val">Week ${a.weekNumber} (${a.scheduledMonth})</div>
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
      <div class="brief-section-title">Classification & Target Audience</div>
      <div style="display:flex; gap:0.5rem; flex-wrap:wrap;">
        <span class="keyword-pill" style="background:#2563eb; color:white;">${a.intent}</span>
        <span class="keyword-pill" style="background:#7c3aed; color:white;">${a.audience}</span>
        <span class="keyword-pill" style="background:#059669; color:white;">Priority: ${a.priorityScore}</span>
      </div>
    </div>

    <div>
      <div class="brief-section-title">Secondary Keywords (${(a.secondaryKeywords || []).length})</div>
      <div class="pills-list">
        ${(a.secondaryKeywords && a.secondaryKeywords.length > 0)
          ? a.secondaryKeywords.map(k => `<span class="keyword-pill">${escapeHtml(k)}</span>`).join('')
          : '<span style="color:var(--text-muted); font-size:0.85rem;">None extracted for this cluster</span>'}
      </div>
    </div>

    <div>
      <div class="brief-section-title">Frequently Asked Questions (PAA Spine) (${(a.paaQuestions || []).length})</div>
      <ul class="paa-list">
        ${(a.paaQuestions && a.paaQuestions.length > 0)
          ? a.paaQuestions.map(q => `<li class="paa-item"><span>❓</span> ${escapeHtml(q)}</li>`).join('')
          : '<li class="paa-item" style="border-left-color:#64748b"><span>💡</span> Auto-generate questions via Blog Creation Tool Gemini API</li>'}
      </ul>
    </div>

    <div>
      <div class="brief-section-title">Recommended Article Outline Architecture</div>
      <div style="display:flex; flex-direction:column; gap:0.4rem;">
        <div class="outline-item"><span class="outline-num">H2.1</span> Zero-Click Answer Block & Key Takeaways</div>
        <div class="outline-item"><span class="outline-num">H2.2</span> What is ${escapeHtml(a.primaryKeyword)}? Core Specs & Materials</div>
        <div class="outline-item"><span class="outline-num">H2.3</span> ${a.intent.includes('Commercial') ? 'Key Comparison & Selection Factors' : 'Step-by-Step Installation & Best Practices'}</div>
        <div class="outline-item"><span class="outline-num">H2.4</span> Cost Breakdown, Board/Quantity Calculations & Quantities</div>
        <div class="outline-item"><span class="outline-num">H2.5</span> FAQs & Common Mistakes</div>
        <div class="outline-item"><span class="outline-num">H2.6</span> Internal Links to Lawsons Supplies & Categories</div>
      </div>
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
  // Fallback programmatic CSV download if needed
  const rows = [
    ['Week', 'Month', 'Pillar', 'Target Keyword', 'Recommended Title', 'Intent', 'Audience', 'Volume', 'CPC', 'Peak Month', 'Priority']
  ];
  allArticles.forEach(a => {
    rows.push([
      a.weekNumber,
      `"${a.scheduledMonth}"`,
      `"${a.pillar}"`,
      `"${(a.primaryKeyword || '').replace(/"/g, '""')}"`,
      `"${(a.recommendedTitle || '').replace(/"/g, '""')}"`,
      `"${a.intent}"`,
      `"${a.audience}"`,
      a.primaryVolume,
      a.cpc,
      `"${a.peakMonth}"`,
      a.priorityScore
    ]);
  });
  const csvContent = 'data:text/csv;charset=utf-8,' + rows.map(e => e.join(',')).join('\n');
  const encodedUri = encodeURI(csvContent);
  const link = document.createElement('a');
  link.setAttribute('href', encodedUri);
  link.setAttribute('download', 'lawsons_content_calendar_52_weeks.csv');
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
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
  }, 2500);
}

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
