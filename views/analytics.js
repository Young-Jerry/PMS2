/**
 * Analytics View
 * Advanced performance analytics: P&L curve, moving average, drawdown,
 * win rate, per-trade breakdown, behavior patterns.
 * Chart logic preserved from original analytics.js
 */
const AnalyticsView = (() => {
  let mainChart   = null;
  let distChart   = null;
  const MA_DEFAULT = 5;

  const hoverGuidePlugin = {
    id: 'hoverGuidePlugin',
    afterDatasetsDraw(activeChart) {
      const tooltip = activeChart.tooltip;
      if (!tooltip || !tooltip.getActiveElements().length) return;
      const activePoint = tooltip.getActiveElements()[0].element;
      if (!activePoint) return;
      const { ctx, chartArea } = activeChart;
      ctx.save();
      ctx.setLineDash([5, 5]);
      ctx.strokeStyle = 'rgba(245,158,11,0.4)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(activePoint.x, chartArea.top);
      ctx.lineTo(activePoint.x, chartArea.bottom);
      ctx.stroke();
      ctx.restore();
    },
  };

  function render(container) {
    container.innerHTML = `
      <div class="view-enter">
        <div class="view-header">
          <div>
            <div class="view-title">Analytics</div>
            <div class="view-subtitle">Performance analysis, risk metrics &amp; behavioral insights</div>
          </div>
        </div>

        <!-- Summary KPIs -->
        <div class="stat-grid" id="analytics-kpis"></div>

        <!-- Main Chart -->
        <div class="pms-card section-gap">
          <div class="pms-card-header">
            <span class="pms-card-title">Profit Curve</span>
            <div style="display:flex;gap:12px;align-items:center;flex-wrap:wrap;">
              <label class="pms-toggle">
                <input type="checkbox" id="tog-pertrade"> Per Trade
              </label>
              <label class="pms-toggle">
                <input type="checkbox" id="tog-invested"> Invested
              </label>
              <label class="pms-toggle">
                <input type="checkbox" id="tog-ma"> MA
                <input type="number" id="ma-window" value="${MA_DEFAULT}" min="2" max="50" style="width:44px;margin-left:4px;" class="pms-input" style="padding:2px 4px;">
              </label>
              <button class="pms-btn pms-btn-ghost pms-btn-icon" id="reset-zoom">↺ Zoom</button>
            </div>
          </div>
          <div class="pms-card-body" style="padding:12px 16px;">
            <div class="chart-wrap" style="height:280px;">
              <canvas id="analytics-main-chart"></canvas>
            </div>
          </div>
        </div>

        <div class="grid-2 section-gap">
          <!-- Distribution Chart -->
          <div class="pms-card">
            <div class="pms-card-header"><span class="pms-card-title">Profit Distribution</span></div>
            <div class="pms-card-body" style="padding:12px 16px;">
              <div class="chart-wrap" style="height:180px;">
                <canvas id="analytics-dist-chart"></canvas>
              </div>
            </div>
          </div>

          <!-- Risk / Behavior Insights -->
          <div class="pms-card">
            <div class="pms-card-header"><span class="pms-card-title">Performance Insights</span></div>
            <div class="pms-card-body" id="analytics-insights"></div>
          </div>
        </div>

        <!-- Trade Log Table -->
        <div class="table-section section-gap">
          <div class="pms-card-header" style="background:var(--bg-elevated);">
            <span class="pms-card-title">Closed Trade Detail</span>
          </div>
          <div class="pms-table-wrap">
            <table class="pms-table">
              <thead><tr>
                <th>#</th><th>Script</th><th>Type</th><th>Qty</th>
                <th>Buy Px</th><th>Sell Px</th><th>Days</th>
                <th>Gross P&L</th><th>Tax</th><th>Net Profit</th><th>ROI%</th>
              </tr></thead>
              <tbody id="analytics-trade-log"></tbody>
            </table>
          </div>
        </div>
      </div>
    `;

    bindEvents(container);
    renderAnalytics(container);
  }

  function bindEvents(container) {
    ['#tog-pertrade','#tog-invested','#tog-ma','#ma-window'].forEach(sel => {
      container.querySelector(sel)?.addEventListener('change', () => renderAnalytics(container));
    });
    container.querySelector('#reset-zoom')?.addEventListener('click', () => {
      if (mainChart) mainChart.resetZoom?.();
    });
    window.addEventListener('pms-data-restored', () => renderAnalytics(container));
  }

  function renderAnalytics(container) {
    if (!container.isConnected) return;
    const exited = PmsState.readExited().map(normalizeExited);
    renderKPIs(container, exited);
    renderMainChart(container, exited);
    renderDistribution(container, exited);
    renderInsights(container, exited);
    renderTradeLog(container, exited);
  }

  function renderKPIs(container, exited) {
    const totals = exited.reduce((acc, r) => {
      acc.invested += Number(r.invested || 0);
      acc.profit   += Number(r.profit   || 0);
      return acc;
    }, { invested: 0, profit: 0 });

    const roi     = totals.invested > 0 ? (totals.profit / totals.invested * 100) : 0;
    const wins    = exited.filter(r => r.profit > 0).length;
    const losses  = exited.filter(r => r.profit < 0).length;
    const winRate = exited.length > 0 ? (wins / exited.length * 100) : 0;
    const kpis = [
      { l: 'Total Invested',  v: PmsUI.currency(totals.invested), c: '' },
      { l: 'Total Profit',    v: PmsUI.currency(totals.profit),   c: totals.profit >= 0 ? 'profit-card' : 'loss-card' },
      { l: 'Portfolio ROI',   v: PmsUI.pct(roi),                  c: roi >= 0 ? 'profit-card' : 'loss-card' },
      { l: 'Win Rate',        v: `${winRate.toFixed(1)}%`,         c: winRate >= 50 ? 'profit-card' : 'loss-card' },
      { l: 'Total Trades',    v: String(exited.length),            c: '' },
      { l: 'Win / Loss',      v: `${wins} / ${losses}`,             c: '' },
    ];

    container.querySelector('#analytics-kpis').innerHTML = kpis.map(k => `
      <div class="stat-card ${k.c}">
        <div class="stat-label">${k.l}</div>
        <div class="stat-value">${k.v}</div>
      </div>
    `).join('');
  }

  function renderMainChart(container, exited) {
    if (mainChart) { mainChart.destroy(); mainChart = null; }
    const canvas    = container.querySelector('#analytics-main-chart');
    if (!exited.length) return;
    if (!window.Chart || !canvas) return;

    const profits   = [0, ...exited.map(r => PmsUI.round2(r.profit))];
    const invested  = [0, ...exited.map(r => PmsUI.round2(r.invested))];
    const labels    = profits.map((_, i) => i);
    const equityCurve   = computeCumulative(profits);
    const investedCurve = computeCumulative(invested);

    const usePerTrade  = container.querySelector('#tog-pertrade')?.checked;
    const showInvested = container.querySelector('#tog-invested')?.checked;
    const showMA       = container.querySelector('#tog-ma')?.checked;
    const maWindow     = Number(container.querySelector('#ma-window')?.value || MA_DEFAULT);
    const primary      = usePerTrade ? profits : equityCurve;
    const movingAvg    = computeMovingAvg(primary, maWindow);
    const zeroCross    = computeZeroCrossings(primary);

    const lastVal = primary[primary.length - 1] || 0;
    const lineColor = lastVal >= 0 ? '#22c55e' : '#ef4444';

    const datasets = [{
      label: usePerTrade ? 'Per Trade P&L' : 'Cumulative P&L',
      data: primary, borderColor: lineColor, borderWidth: 2.5,
      fill: false, tension: 0.22, pointRadius: 2, pointBackgroundColor: '#fff',
      pointBorderWidth: 0, pointHoverRadius: 5, pointHitRadius: 10,
    }];

    if (showInvested) datasets.push({
      label: 'Invested', data: investedCurve,
      borderColor: '#f59e0b', borderWidth: 1.8, fill: false, tension: 0.16,
      pointRadius: 1.5, pointHoverRadius: 4, pointHitRadius: 8,
    });

    if (zeroCross.length) datasets.push({
      label: 'Zero Cross', data: zeroCross, parsing: false,
      showLine: false, pointRadius: 4, pointBackgroundColor: '#fff',
      pointBorderColor: '#fff', pointHoverRadius: 0, pointHitRadius: 0,
    });

    if (showMA && maWindow >= 2) datasets.push({
      label: `MA(${maWindow})`, data: movingAvg,
      borderColor: '#60a5fa', borderWidth: 1.8, fill: false,
      borderDash: [6, 5], pointRadius: 0, pointHoverRadius: 0,
      pointHitRadius: 0, tension: 0.2,
    });

    mainChart = new Chart(canvas, {
      type: 'line',
      data: { labels, datasets },
      plugins: [hoverGuidePlugin],
      options: {
        animation: false, normalized: true, responsive: true, maintainAspectRatio: false,
        interaction: { mode: 'nearest', intersect: false },
        plugins: {
          legend: { display: false },
          tooltip: {
            displayColors: false,
            callbacks: {
              title: (items) => `Trade ${items[0]?.label ?? ''}`,
              label: (ctx) => `${ctx.dataset.label}: ${PmsUI.currency(ctx.parsed.y)}`,
            },
          },
          zoom: {
            pan: { enabled: false },
            zoom: {
              wheel: { enabled: true }, pinch: { enabled: true },
              drag: { enabled: false }, mode: 'x',
            },
          },
        },
        scales: {
          x: {
            ticks: { color: '#4a5568', font: { size: 10 }, callback: v => Number.isInteger(v) ? v : '' },
            grid:  { color: 'rgba(255,255,255,0.05)' }, border: { display: false },
          },
          y: {
            ticks: { color: '#4a5568', font: { size: 10 }, callback: v => PmsUI.currencyRound(v) },
            grid: {
              color: ctx => ctx.tick?.value === 0 ? 'rgba(255,255,255,0.6)' : 'rgba(255,255,255,0.05)',
              lineWidth: ctx => ctx.tick?.value === 0 ? 2 : 1,
            },
            border: { display: false },
          },
        },
      },
    });
  }

  function renderDistribution(container, exited) {
    if (distChart) { distChart.destroy(); distChart = null; }
    const canvas = container.querySelector('#analytics-dist-chart');
    if (!canvas || !exited.length || !window.Chart) return;

    // Bucket profits
    const profits = exited.map(r => r.profit);
    const min = Math.min(...profits), max = Math.max(...profits);
    const buckets = 10;
    const step = (max - min) / buckets || 1000;
    const labels = [], data = [], colors = [];
    for (let i = 0; i < buckets; i++) {
      const lo = min + i * step, hi = lo + step;
      labels.push(`${Math.round(lo/1000)}k`);
      const count = profits.filter(p => p >= lo && (i === buckets - 1 ? p <= hi : p < hi)).length;
      data.push(count);
      colors.push(lo >= 0 ? 'rgba(34,197,94,0.7)' : 'rgba(239,68,68,0.7)');
    }

    distChart = new Chart(canvas, {
      type: 'bar',
      data: { labels, datasets: [{ data, backgroundColor: colors, borderRadius: 3 }] },
      options: {
        animation: false, responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false }, tooltip: { callbacks: { title: items => `P&L ${items[0].label}`, label: ctx => `${ctx.parsed.y} trades` } } },
        scales: {
          x: { ticks: { color: '#4a5568', font: { size: 10 } }, grid: { display: false }, border: { display: false } },
          y: { ticks: { color: '#4a5568', font: { size: 10 } }, grid: { color: 'rgba(255,255,255,0.05)' }, border: { display: false } },
        },
      },
    });
  }

  function renderInsights(container, exited) {
    const el = container.querySelector('#analytics-insights');
    if (!exited.length) { el.innerHTML = `<div class="empty-state"><div class="empty-state-text">No data yet</div></div>`; return; }

    const profits    = exited.map(r => r.profit);
    const wins       = profits.filter(p => p > 0);
    const losses     = profits.filter(p => p < 0);
    const avgWin     = wins.length   > 0 ? wins.reduce((s,v) => s+v,0)   / wins.length   : 0;
    const avgLoss    = losses.length > 0 ? losses.reduce((s,v) => s+v,0) / losses.length : 0;
    const profitFactor = Math.abs(avgLoss) > 0 ? Math.abs(avgWin / avgLoss) : Infinity;
    const maxWin     = wins.length   > 0 ? Math.max(...wins)   : 0;
    const maxLoss    = losses.length > 0 ? Math.min(...losses) : 0;
    const avgDays    = exited.reduce((s,r) => s + Number(r.holdingDays || 0), 0) / exited.length;

    const items = [
      { l: 'Avg Win',       v: PmsUI.currency(avgWin),   c: 'val-profit' },
      { l: 'Avg Loss',      v: PmsUI.currency(avgLoss),  c: 'val-loss' },
      { l: 'Profit Factor', v: isFinite(profitFactor) ? profitFactor.toFixed(2) : '∞', c: profitFactor >= 1 ? 'val-profit' : 'val-loss' },
      { l: 'Best Trade',    v: PmsUI.currency(maxWin),   c: 'val-profit' },
      { l: 'Worst Trade',   v: PmsUI.currency(maxLoss),  c: 'val-loss' },
      { l: 'Avg Hold Days', v: `${avgDays.toFixed(1)}d`, c: '' },
    ];

    el.innerHTML = items.map(i => `
      <div style="display:flex;justify-content:space-between;align-items:center;padding:7px 0;border-bottom:1px solid var(--border);">
        <span style="font-size:12px;color:var(--text-muted);">${i.l}</span>
        <span style="font-family:var(--font-mono);font-size:12px;font-weight:600;" class="${i.c}">${i.v}</span>
      </div>
    `).join('');
  }

  function renderTradeLog(container, exited) {
    const tbody = container.querySelector('#analytics-trade-log');
    if (!exited.length) {
      tbody.innerHTML = `<tr><td colspan="11" style="padding:24px;text-align:center;color:var(--text-muted);">No trades yet.</td></tr>`;
      return;
    }
    tbody.innerHTML = exited.map((r, i) => {
      const roi = r.invested > 0 ? (r.profit / r.invested * 100) : 0;
      return `<tr>
        <td style="color:var(--text-muted);">${i + 1}</td>
        <td style="font-weight:600;">${PmsUI.esc(r.name || '')}</td>
        <td><span class="badge badge-blue">${PmsUI.esc(r.type || '')}</span></td>
        <td>${PmsUI.fmtQty(r.qty)}</td>
        <td>${PmsUI.currency(r.buyPrice)}</td>
        <td>${PmsUI.currency(r.soldPrice)}</td>
        <td style="color:var(--text-muted);">${Number(r.holdingDays || 0)}d</td>
        <td class="${PmsUI.plClass(r.grossProfit)}">${PmsUI.currency(r.grossProfit)}</td>
        <td class="val-loss">${PmsUI.currency(r.capitalGainTax)}</td>
        <td class="${PmsUI.plClass(r.profit)}" style="font-weight:700;">${PmsUI.currency(r.profit)}</td>
        <td class="${PmsUI.plClass(roi)}">${PmsUI.pct(roi)}</td>
      </tr>`;
    }).join('');
  }

  // ── Math helpers (preserved from original analytics.js) ───
  function normalizeExited(row) {
    const calc = PmsTradeMath.calculateRoundTrip({
      buyPrice:   row.buyPrice,
      soldPrice:  row.soldPrice || row.currentPrice || 0,
      qty:        row.qty,
      holdingDays: row.holdingDays,
    });
    return {
      ...row,
      name:         row.name || '',
      type:         row.type || '',
      qty:          row.qty,
      buyPrice:     Number(row.buyPrice || 0),
      soldPrice:    Number(row.soldPrice || 0),
      holdingDays:  Math.floor(Number(row.holdingDays || 0)),
      profit:       Number(calc.netProfit),
      grossProfit:  Number(calc.grossProfit),
      capitalGainTax: Number(calc.capitalGainTax),
      invested:     Number(calc.invested),
    };
  }

  function computeCumulative(series) {
    let running = 0;
    return series.map(v => { running += Number(v || 0); return PmsUI.round2(running); });
  }

  function computeMovingAvg(series, w) {
    return series.map((_, i) => {
      if (i === 0 || i < w - 1) return null;
      const set = series.slice(i - w + 1, i + 1);
      return PmsUI.round2(set.reduce((s, n) => s + Number(n || 0), 0) / set.length);
    });
  }

  function computeZeroCrossings(series) {
    const pts = [];
    for (let i = 1; i < series.length; i++) {
      const prev = Number(series[i-1] || 0), curr = Number(series[i] || 0);
      if (prev === 0) pts.push({ x: i-1, y: 0 });
      if ((prev < 0 && curr > 0) || (prev > 0 && curr < 0)) {
        const t = Math.abs(prev) / (Math.abs(prev) + Math.abs(curr));
        pts.push({ x: PmsUI.round2((i-1) + t), y: 0 });
      }
      if (curr === 0) pts.push({ x: i, y: 0 });
    }
    return pts;
  }

  function computeMaxDrawdown(profits) {
    let peak = 0, maxDD = 0, cum = 0;
    for (const p of profits) {
      cum += Number(p || 0);
      if (cum > peak) peak = cum;
      const dd = peak - cum;
      if (dd > maxDD) maxDD = dd;
    }
    return maxDD;
  }

  return { render };
})();
