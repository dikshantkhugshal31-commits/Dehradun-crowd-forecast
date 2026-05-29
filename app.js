/**
 * app.js — Dehradun Tourist Crowd Forecast
 * Main application controller
 */

import { fetchWeather } from './api.js';
import {
  PLACES, HOURS, HOUR_LABELS,
  getCrowdLevel, getBarColor, getHourIndex, formatHour, getPlaceData
} from './data.js';

// ─── APP STATE ────────────────────────────────
const state = {
  currentHour: new Date().getHours(),
  weather: 'sunny',
  weatherData: null,
  selectedHourIndex: null,
  category: 'all',
  selectedDate: new Date(),
  openModalId: null
};

state.selectedHourIndex = Math.max(0, Math.min(state.currentHour - 6, HOURS.length - 1));

// ─── DOM REFS ─────────────────────────────────
const $ = id => document.getElementById(id);

// ─── BOOTSTRAP ────────────────────────────────
window.addEventListener('DOMContentLoaded', async () => {
  setupParticles();
  setupDatePicker();
  buildTimeStrip();
  renderSummary();
  renderGrid();
  startClock();
  await loadWeather();

  setTimeout(() => {
    const lo = $('loading');
    if (lo) lo.classList.add('hidden');
  }, 1600);
});

// ─── PARTICLES ───────────────────────────────
function setupParticles() {
  const container = $('particles');
  if (!container) return;
  for (let i = 0; i < 18; i++) {
    const p = document.createElement('div');
    p.className = 'particle';
    const size = Math.random() * 4 + 2;
    p.style.cssText = `
      width:${size}px; height:${size}px;
      left:${Math.random()*100}%;
      animation-delay:${Math.random()*8}s;
      animation-duration:${8+Math.random()*12}s;
    `;
    container.appendChild(p);
  }
}

// ─── CLOCK ────────────────────────────────────
function startClock() {
  function tick() {
    const now = new Date();
    const el = $('live-time');
    if (el) el.textContent = now.toLocaleTimeString('en-IN', {
      hour: '2-digit', minute: '2-digit', second: '2-digit'
    });
  }
  tick();
  setInterval(tick, 1000);
}

// ─── WEATHER ─────────────────────────────────
async function loadWeather() {
  try {
    const data = await fetchWeather();
    state.weatherData = data;
    state.weather = data.condition;

    const tw = $('temp-widget');
    if (tw) {
      tw.querySelector('.temp').textContent = `${data.temperature}°C`;
      tw.querySelector('.cond').textContent = `${data.icon} ${data.condition}`;
    }

    document.querySelectorAll('.wx-btn').forEach(b => {
      b.classList.toggle('active', b.dataset.w === data.condition);
    });

    renderGrid();
    renderSummary();
    buildTimeStrip();
    showToast(`Weather updated: ${data.icon} ${data.temperature}°C · ${data.condition}`);
  } catch (e) {
    console.warn('Weather load failed:', e);
  }
}

// ─── DATE PICKER ─────────────────────────────
function setupDatePicker() {
  const dp = $('date-picker');
  if (!dp) return;
  const today = new Date();
  dp.value = today.toISOString().split('T')[0];
  dp.min = new Date(today.getTime() - 7*86400000).toISOString().split('T')[0];
  dp.max = new Date(today.getTime() + 30*86400000).toISOString().split('T')[0];
  dp.addEventListener('change', () => {
    state.selectedDate = new Date(dp.value);
    renderGrid();
    renderSummary();
  });
}

// ─── CONTROLS (global callbacks) ─────────────
window.selectWeather = function(el, w) {
  document.querySelectorAll('.wx-btn').forEach(b => b.classList.remove('active'));
  el.classList.add('active');
  state.weather = w;
  renderGrid();
  renderSummary();
  buildTimeStrip();
};

window.filterCategory = function(el) {
  state.category = el.value;
  renderGrid();
};

// ─── TIME STRIP ───────────────────────────────
function buildTimeStrip() {
  const container = $('time-slots-scroll');
  if (!container) return;
  container.innerHTML = '';

  const avgByHour = HOURS.map((_, i) => {
    const vals = PLACES.map(p => {
      const d = p.crowd[state.weather] || p.crowd.sunny;
      return d[i] ?? 0;
    });
    return Math.round(vals.reduce((a,b)=>a+b,0) / vals.length);
  });

  const nowIdx = getHourIndex(new Date().getHours());

  HOURS.forEach((h, i) => {
    const avg = avgByHour[i];
    const maxBarH = 28;
    const barH = Math.max(3, Math.round((avg / 100) * maxBarH));
    const col = getBarColor(avg);
    const isActive = i === state.selectedHourIndex;
    const isNow = i === nowIdx;

    const slot = document.createElement('div');
    slot.className = `t-slot${isActive ? ' active' : ''}${isNow ? ' now-marker' : ''}`;
    slot.id = `ts-${i}`;
    slot.innerHTML = `
      <span class="t-label">${HOUR_LABELS[i]}</span>
      <div class="t-bar" style="height:${barH}px;background:${isActive ? 'var(--sage)' : col}"></div>
    `;
    slot.onclick = () => selectHour(i);
    container.appendChild(slot);
  });

  updateSelectedTimeBanner();

  const activeSlot = container.querySelector('.t-slot.active');
  if (activeSlot) activeSlot.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
}

function selectHour(i) {
  state.selectedHourIndex = i;
  document.querySelectorAll('.t-slot').forEach((s, idx) => {
    s.classList.toggle('active', idx === i);
    const bar = s.querySelector('.t-bar');
    if (bar) {
      const avg = PLACES.map(p => (p.crowd[state.weather]||p.crowd.sunny)[idx]??0);
      const v = Math.round(avg.reduce((a,b)=>a+b,0)/avg.length);
      bar.style.background = idx === i ? 'var(--sage)' : getBarColor(v);
    }
  });
  updateSelectedTimeBanner();
  renderGrid();
}

function updateSelectedTimeBanner() {
  const el = $('selected-time-val');
  if (el) el.textContent = formatHour(HOURS[state.selectedHourIndex]);
}

// ─── SUMMARY ROW ─────────────────────────────
function renderSummary() {
  const hour = HOURS[state.selectedHourIndex];
  const openPlaces = PLACES.filter(p => hour >= p.openHour && hour < p.closeHour);
  const avgCrowd = Math.round(PLACES.reduce((sum, p) => {
    const d = p.crowd[state.weather] || p.crowd.sunny;
    return sum + (d[state.selectedHourIndex] ?? 0);
  }, 0) / PLACES.length);

  const leastBusy = [...openPlaces].sort((a,b) => {
    const av = (a.crowd[state.weather]||a.crowd.sunny)[state.selectedHourIndex]??99;
    const bv = (b.crowd[state.weather]||b.crowd.sunny)[state.selectedHourIndex]??99;
    return av - bv;
  })[0];

  setSC('sc-open', `${openPlaces.length}/${PLACES.length}`, 'Currently Open');
  setSC('sc-crowd', `${avgCrowd}%`, 'Avg Crowd Level');
  setSC('sc-weather', state.weatherData ? `${state.weatherData.temperature}°C` : '--°C',
        state.weatherData?.condition || 'Loading...');
  setSC('sc-tip', leastBusy?.name || '--', 'Least Crowded Now');
}

function setSC(id, val, sub) {
  const el = $(id);
  if (!el) return;
  el.querySelector('.sc-val').textContent = val;
  el.querySelector('.sc-sub').textContent = sub;
}

// ─── PLACES GRID ─────────────────────────────
function renderGrid() {
  const grid = $('places-grid');
  if (!grid) return;

  const filtered = state.category === 'all'
    ? PLACES
    : PLACES.filter(p => p.category === state.category);

  const countEl = $('places-count');
  if (countEl) countEl.textContent = `${filtered.length} places`;

  grid.innerHTML = '';

  if (filtered.length === 0) {
    grid.innerHTML = `<div class="empty-state"><div class="emoji">🔍</div><p>No places found for this category.</p></div>`;
    return;
  }

  filtered.forEach((place, idx) => {
    grid.appendChild(buildCard(place, idx));
  });
}

function buildCard(place, delay = 0) {
  const { crowdData, currentCrowd, isOpen, avgCrowd, peakCrowd, peakHourIndex } =
    getPlaceData(place, state.weather, state.selectedHourIndex);

  const level = isOpen ? getCrowdLevel(currentCrowd) : { label: 'Closed', cls: 'closed', color: '#888' };

  const card = document.createElement('div');
  card.className = 'place-card';
  card.style.animationDelay = `${delay * 0.06}s`;
  card.onclick = () => openModal(place.id);

  const maxH = 38;
  const barsHtml = crowdData.map((v, i) => {
    const h = Math.max(2, Math.round((v/100)*maxH));
    const isOpenHr = HOURS[i] >= place.openHour && HOURS[i] < place.closeHour;
    const col = isOpenHr ? getBarColor(v) : '#ede8d8';
    const isSel = i === state.selectedHourIndex;
    return `<div class="mini-bar${isSel?' selected-hr':''}" style="height:${h}px;background:${col}" title="${HOUR_LABELS[i]}: ${v}%"></div>`;
  }).join('');

  let alertHtml = '';
  if (isOpen) {
    if (currentCrowd <= 30) {
      alertHtml = `<div class="card-alert good">✅ <span>Great time to visit! Low crowd right now.</span></div>`;
    } else if (currentCrowd > 75) {
      const betterHour = crowdData.findIndex((v, i) => v <= 30 && HOURS[i] >= place.openHour && HOURS[i] < place.closeHour);
      const suggestion = betterHour >= 0 ? `Try ${HOUR_LABELS[betterHour]}` : 'Early morning recommended';
      alertHtml = `<div class="card-alert warn">⚠️ <span>Very crowded — ${suggestion}</span></div>`;
    }
  }

  card.innerHTML = `
    <div class="card-visual" style="background:${place.bgGrad}">
      <div class="card-emoji">${place.emoji}</div>
      <div class="card-visual-overlay"></div>
      <div class="rating-badge">⭐ ${place.rating}</div>
      <div class="crowd-badge ${level.cls}">${level.label}</div>
    </div>
    <div class="card-body">
      <div class="card-name">${place.name}</div>
      <div class="card-subtitle">${place.subtitle}</div>
      <div class="meter-row">
        <span class="meter-label">Crowd Level</span>
        <span class="meter-pct" style="color:${level.color}">${isOpen ? currentCrowd+'%' : 'Closed'}</span>
      </div>
      <div class="crowd-meter">
        <div class="crowd-fill" style="width:${isOpen ? currentCrowd : 0}%;background:${level.color}"></div>
      </div>
      <div class="mini-chart">${barsHtml}</div>
      <div class="card-meta">
        <div class="meta-tag ${isOpen ? 'open' : 'closed'}">${isOpen ? '✅ Open' : '🚫 Closed'} · ${place.openHour}:00–${place.closeHour}:00</div>
        <div class="meta-tag">🎟 ${place.entryFee}</div>
        <div class="meta-tag">📍 ${place.distance}</div>
      </div>
      ${alertHtml}
    </div>`;

  return card;
}

// ─── MODAL ────────────────────────────────────
window.openModal = function(id) {
  const place = PLACES.find(p => p.id === id);
  if (!place) return;
  state.openModalId = id;

  const { crowdData, currentCrowd, isOpen, avgCrowd, peakCrowd, peakHourIndex } =
    getPlaceData(place, state.weather, state.selectedHourIndex);
  const level = isOpen ? getCrowdLevel(currentCrowd) : { label: 'Closed', cls: 'closed', color: '#888' };

  $('m-emoji').textContent = place.emoji;
  $('m-title').textContent = place.name;
  $('m-subtitle').textContent = `${place.subtitle} · Dehradun, Uttarakhand`;

  $('m-status-val').textContent = isOpen ? currentCrowd + '%' : 'Closed';
  const badge = $('m-crowd-badge');
  badge.textContent = level.label;
  badge.style.background = level.color;
  badge.style.color = level.cls === 'moderate' ? '#2a1800' : 'white';

  const maxV = Math.max(...crowdData, 1);
  const maxH = 120;
  $('m-chart').innerHTML = crowdData.map((v, i) => {
    const isOpenHr = HOURS[i] >= place.openHour && HOURS[i] < place.closeHour;
    const h = Math.max(3, Math.round((v/maxV)*maxH));
    const col = isOpenHr ? getBarColor(v) : '#f0ede4';
    const isSel = i === state.selectedHourIndex;
    return `<div class="modal-bar${isSel?' selected-bar':''}" style="height:${h}px;background:${col}" title="${HOUR_LABELS[i]}">
      <div class="bar-tip">${HOUR_LABELS[i]}: ${v}%</div>
    </div>`;
  }).join('');

  $('m-chart-axis').innerHTML = crowdData.map((_, i) =>
    `<span class="axis-label">${HOUR_LABELS[i]}</span>`
  ).join('');

  $('m-stat-current').textContent = isOpen ? currentCrowd+'%' : 'Closed';
  $('m-stat-peak').textContent = `${peakCrowd}% at ${HOUR_LABELS[peakHourIndex]}`;
  $('m-stat-avg').textContent = avgCrowd+'%';

  $('m-best-time').innerHTML = `🌅 <strong>Best:</strong> ${place.bestTime}`;
  $('m-tips').innerHTML = place.tips.split('. ').filter(Boolean).map(t => `• ${t}.`).join('<br>');
  $('m-tags').innerHTML = place.tags.map(t => `<span class="meta-tag">${t}</span>`).join('');
  $('m-entry').textContent = place.entryFee;
  $('m-dist').textContent = place.distance;

  $('modal-overlay').classList.add('open');
  document.body.style.overflow = 'hidden';
};

window.closeModal = function(e) {
  if (e.target === $('modal-overlay') || e.currentTarget?.id === 'modal-close') {
    $('modal-overlay').classList.remove('open');
    document.body.style.overflow = '';
  }
};

window.closeModalBtn = function() {
  $('modal-overlay').classList.remove('open');
  document.body.style.overflow = '';
};

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    $('modal-overlay').classList.remove('open');
    document.body.style.overflow = '';
  }
});

// ─── TOAST ────────────────────────────────────
function showToast(msg) {
  const t = $('toast');
  if (!t) return;
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 3000);
}

// ─── SCROLL REVEAL ────────────────────────────
const observer = new IntersectionObserver(entries => {
  entries.forEach(e => {
    if (e.isIntersecting) e.target.style.opacity = '1';
  });
}, { threshold: 0.1 });

window.addEventListener('load', () => {
  document.querySelectorAll('.place-card, .summary-card').forEach(el => observer.observe(el));
});
