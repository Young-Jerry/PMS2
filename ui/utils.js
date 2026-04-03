/**
 * PMS UI Utilities
 * Shared formatting, DOM helpers, modal system.
 */
const PmsUI = (() => {

  // ── Formatting ────────────────────────────────────────────────
  function currency(value) {
    const n = Number(value || 0);
    return `Rs ${new Intl.NumberFormat('en-IN', { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(n)}`;
  }
  function currencyRound(value) {
    return `Rs ${new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(Math.round(Number(value || 0)))}`;
  }
  function pct(value, decimals = 2) {
    return `${Number(value || 0).toFixed(decimals)}%`;
  }
  function num(v)    { return Number.parseFloat(v); }
  function fmt2(v)   { return Number.isFinite(Number(v)) ? Number(v).toFixed(2) : '0.00'; }
  function fmtQty(v) { return new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 }).format(v || 0); }
  function esc(v)    {
    return String(v || '').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;')
      .replaceAll('"','&quot;').replaceAll("'",'&#39;');
  }
  function plClass(v)      { return Number(v) >= 0 ? 'val-profit' : 'val-loss'; }
  function round2(v)       { return Math.round(Number(v || 0) * 100) / 100; }

  // ── Modal System ──────────────────────────────────────────────
  function modal({ title, subtitle = '', body = '', actions = '', wide = false }) {
    const backdrop = document.createElement('div');
    backdrop.className = 'pms-modal-backdrop';
    const card = document.createElement('div');
    card.className = `pms-modal-card${wide ? ' pms-modal-wide' : ''}`;
    card.innerHTML = `
      <div class="pms-modal-header">
        <div>
          <span class="pms-modal-title">${esc(title)}</span>
          ${subtitle ? `<span class="pms-modal-subtitle">${esc(subtitle)}</span>` : ''}
        </div>
        <button class="pms-modal-close" data-close="true">✕</button>
      </div>
      <div class="pms-modal-body">${body}</div>
      ${actions ? `<div class="pms-modal-footer">${actions}</div>` : ''}
    `;
    backdrop.appendChild(card);
    document.body.appendChild(backdrop);
    const close = () => backdrop.remove();
    card.querySelector('[data-close]').onclick = close;
    backdrop.onclick = (e) => { if (e.target === backdrop) close(); };
    return { backdrop, card, close };
  }

  function confirm({ title, message, confirmText = 'Confirm', danger = false, onConfirm }) {
    const { card, close } = modal({
      title,
      subtitle: message,
      actions: `
        <button class="pms-btn pms-btn-ghost" data-cancel="true">Cancel</button>
        <button class="pms-btn ${danger ? 'pms-btn-danger' : 'pms-btn-primary'}" data-confirm="true">${esc(confirmText)}</button>
      `,
    });
    card.querySelector('[data-cancel]').onclick = close;
    card.querySelector('[data-confirm]').onclick = () => { onConfirm?.(); close(); };
  }

  // ── Toast Notifications ───────────────────────────────────────
  function toast(message, type = 'success', duration = 2200) {
    let container = document.getElementById('pms-toast-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'pms-toast-container';
      document.body.appendChild(container);
    }
    const toast = document.createElement('div');
    toast.className = `pms-toast pms-toast-${type}`;
    toast.textContent = message;
    container.appendChild(toast);
    requestAnimationFrame(() => toast.classList.add('pms-toast-show'));
    setTimeout(() => {
      toast.classList.remove('pms-toast-show');
      setTimeout(() => toast.remove(), 300);
    }, duration);
  }

  // ── Table Helpers ─────────────────────────────────────────────
  function td(text, cls = '') {
    const el = document.createElement('td');
    el.textContent = text;
    if (cls) el.className = cls;
    return el;
  }
  function tdHTML(html, cls = '') {
    const el = document.createElement('td');
    el.innerHTML = html;
    if (cls) el.className = cls;
    return el;
  }

  // ── Market Timer ──────────────────────────────────────────────
  function startMarketTimer(nodeId) {
    const node = document.getElementById(nodeId);
    if (!node || node.dataset.bound === '1') return;
    node.dataset.bound = '1';
    const tick = () => {
      const now  = new Date();
      const h = now.getHours(), m = now.getMinutes(), s = now.getSeconds(), d = now.getDay();
      const closed      = d === 5 || d === 6;
      const premarket   = !closed && h === 10 && m >= 45;
      const inMarket    = !closed && h >= 11 && h < 15;
      const dot         = inMarket ? 'dot-green' : premarket ? 'dot-amber' : 'dot-red';
      const label       = closed ? 'NEPSE OFF' : 'NEPSE';
      const hh = String(h).padStart(2,'0'), mm = String(m).padStart(2,'0'), ss = String(s).padStart(2,'0');
      node.innerHTML = `<span class="market-dot ${dot}"></span>${label} ${hh}:${mm}:${ss}`;
    };
    tick();
    setInterval(tick, 1000);
  }

  // ── Sparkline (inline SVG) ────────────────────────────────────
  function sparkline(data, width = 80, height = 28, color = '#34d399') {
    if (!data || data.length < 2) return `<svg width="${width}" height="${height}"></svg>`;
    const min = Math.min(...data), max = Math.max(...data);
    const range = max - min || 1;
    const pts = data.map((v, i) => {
      const x = (i / (data.length - 1)) * width;
      const y = height - ((v - min) / range) * (height - 4) - 2;
      return `${x},${y}`;
    }).join(' ');
    return `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
      <polyline points="${pts}" fill="none" stroke="${color}" stroke-width="1.5" stroke-linejoin="round"/>
    </svg>`;
  }

  function parseLtpCsv(text) {
    const updates = {};
    let parsed = 0;
    let errors = 0;
    const lines = String(text || '').split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    lines.forEach((line) => {
      const [rawScript, rawLtp] = line.split(',').map(v => String(v || '').trim());
      const script = rawScript.toUpperCase();
      const ltp = Number(rawLtp);
      if (!script || !Number.isFinite(ltp) || ltp <= 0) { errors++; return; }
      updates[script] = ltp;
      parsed++;
    });
    return { updates, parsed, errors };
  }

  function applyLtpUpdates(updates) {
    let updated = 0;
    ['trades', 'longterm'].forEach((key) => {
      let changed = false;
      const rows = key === 'trades' ? PmsState.readTrades() : PmsState.readLongterm();
      rows.forEach((row) => {
        const script = String(row.script || '').toUpperCase();
        if (updates[script] !== undefined) {
          row.ltp = Number(updates[script]);
          changed = true;
          updated++;
        }
      });
      if (!changed) return;
      if (key === 'trades') PmsState.persistTrades(rows);
      else PmsState.persistLongterm(rows);
    });
    window.dispatchEvent(new CustomEvent('pms-portfolio-updated'));
    return updated;
  }

  return {
    currency, currencyRound, pct, num, fmt2, fmtQty, esc, plClass, round2,
    modal, confirm, toast, td, tdHTML, startMarketTimer, sparkline,
    parseLtpCsv, applyLtpUpdates,
  };
})();
