const TerminalUI = (() => {
  function card(title, body, extra = '') {
    return `<section class="pms-card glass-card"><div class="pms-card-header"><span class="pms-card-title">${title}</span>${extra}</div><div class="pms-card-body">${body}</div></section>`;
  }

  function kpiCard({ label, value, delta = '', trend = [], tone = 'neutral' }) {
    const toneClass = tone === 'profit' ? 'kpi-profit' : tone === 'loss' ? 'kpi-loss' : '';
    return `<div class="kpi-card ${toneClass}">
      <div class="kpi-top"><span>${label}</span><span class="kpi-delta">${delta}</span></div>
      <div class="kpi-value">${value}</div>
      <div class="kpi-spark">${PmsUI.sparkline(trend.length ? trend : [0, 0], 120, 34, tone === 'loss' ? '#f87171' : '#34d399')}</div>
    </div>`;
  }

  function allocationBar(percent) {
    const p = Math.max(0, Math.min(100, Number(percent || 0)));
    return `<div class="alloc-bar"><span style="width:${p}%;"></span></div><div class="alloc-text">${p.toFixed(1)}%</div>`;
  }

  return { card, kpiCard, allocationBar };
})();
