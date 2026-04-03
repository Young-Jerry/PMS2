/**
 * Dashboard View
 * Overview: portfolio totals, allocation pie, profit curve, market status
 */
const DashboardView = (() => {
  let pieChart = null;
  let profitChart = null;

  function render(container) {
    container.innerHTML = `
      <div class="view-enter">
        <div class="view-header">
          <div>
            <div class="view-title">Dashboard</div>
            <div class="view-subtitle">Portfolio overview &amp; performance summary</div>
          </div>
          <div style="display:flex;gap:8px;align-items:center;">
            <button class="pms-btn pms-btn-ghost" id="dash-backup-btn">⬇ Backup</button>
            <label class="pms-btn pms-btn-ghost" style="cursor:pointer;">
              ⬆ Restore
              <input type="file" id="dash-restore-input" accept=".json" style="display:none">
            </label>
          </div>
        </div>

        <!-- KPI Row -->
        <div class="stat-grid" id="dash-kpis"></div>

        <div class="section-gap grid-2" style="margin-top:20px;">
          <!-- Allocation Chart -->
          <div class="pms-card">
            <div class="pms-card-header">
              <span class="pms-card-title">Portfolio Allocation</span>
            </div>
            <div class="pms-card-body" style="display:flex;flex-direction:column;align-items:center;gap:16px;">
              <div class="chart-wrap" style="height:200px;display:flex;align-items:center;justify-content:center;">
                <canvas id="dash-pie-chart" height="200"></canvas>
              </div>
              <div id="dash-pie-legend" style="width:100%;"></div>
            </div>
          </div>

          <!-- Profit Curve -->
          <div class="pms-card">
            <div class="pms-card-header">
              <span class="pms-card-title">Realized Profit Curve</span>
              <span id="dash-trade-count" style="font-family:var(--font-mono);font-size:11px;color:var(--text-muted);"></span>
            </div>
            <div class="pms-card-body" style="padding:12px 16px;">
              <div class="chart-wrap" style="height:200px;">
                <canvas id="dash-profit-chart"></canvas>
              </div>
            </div>
          </div>
        </div>

        <!-- Asset Breakdown -->
        <div class="section-gap pms-card" style="margin-top:20px;">
          <div class="pms-card-header">
            <span class="pms-card-title">Asset Breakdown</span>
          </div>
          <div class="pms-card-body">
            <div id="dash-breakdown"></div>
          </div>
        </div>

        <!-- Backup status -->
        <div id="dash-backup-status" style="text-align:right;margin-top:8px;font-size:11px;color:var(--text-muted);"></div>
      </div>
    `;

    bindEvents(container);
    refresh(container);
  }

  function bindEvents(container) {
    container.querySelector('#dash-backup-btn').onclick = () => downloadBackup();
    container.querySelector('#dash-restore-input').onchange = (e) => restoreBackup(e, container);
  }

  function refresh(container) {
    if (!container) return;
    renderKPIs(container);
    renderPieChart(container);
    renderProfitChart(container);
    renderBreakdown(container);
  }

  function renderKPIs(container) {
    const trades    = PmsState.readTrades();
    const longterm  = PmsState.readLongterm();
    const exited    = PmsState.readExited();
    const cash      = PmsCapital.readCash();

    const tradeValue   = trades.reduce((s,r) => s + r.ltp * r.qty, 0);
    const tradeCost    = trades.reduce((s,r) => s + r.wacc * r.qty, 0);
    const ltValue      = longterm.reduce((s,r) => s + r.ltp * r.qty, 0);
    const ltCost       = longterm.reduce((s,r) => s + r.wacc * r.qty, 0);
    const sipValue     = computeSipValue();
    const sipCost      = computeSipCost();

    const totalInvested = tradeCost + ltCost + sipCost;
    const totalCurrent  = tradeValue + ltValue + sipValue;
    const unrealizedPL  = totalCurrent - totalInvested;
    const realizedPL    = exited.reduce((s,r) => s + Number(r.profit || 0), 0);
    const totalPortfolio = totalCurrent + cash;
    const roi = totalInvested > 0 ? (unrealizedPL / totalInvested) * 100 : 0;

    const kpis = [
      { label: 'Portfolio Value', value: PmsUI.currency(totalCurrent), sub: `Cash: ${PmsUI.currencyRound(cash)}`, card: '' },
      { label: 'Total Invested',  value: PmsUI.currency(totalInvested), sub: `${trades.length+longterm.length} positions`, card: '' },
      { label: 'Unrealized P&L',  value: PmsUI.currency(unrealizedPL),  sub: `ROI ${PmsUI.pct(roi)}`, card: unrealizedPL >= 0 ? 'profit-card' : 'loss-card' },
      { label: 'Realized Profit', value: PmsUI.currency(realizedPL),    sub: `${exited.length} closed trades`, card: realizedPL >= 0 ? 'profit-card' : 'loss-card' },
      { label: 'Cash Balance',    value: PmsUI.currencyRound(cash),      sub: 'Available', card: '' },
      { label: 'Net Worth',       value: PmsUI.currency(totalPortfolio), sub: 'Portfolio + Cash', card: '' },
    ];

    const el = container.querySelector('#dash-kpis');
    el.innerHTML = kpis.map(k => `
      <div class="stat-card ${k.card}">
        <div class="stat-label">${k.label}</div>
        <div class="stat-value ${k.card === 'profit-card' ? 'val-profit' : k.card === 'loss-card' ? 'val-loss' : ''}">${k.value}</div>
        <div class="stat-sub">${k.sub}</div>
      </div>
    `).join('');
  }

  function renderPieChart(container) {
    const trades   = PmsState.readTrades();
    const longterm = PmsState.readLongterm();
    const sip      = computeSipValue();

    const tradeV = trades.reduce((s,r) => s + r.ltp * r.qty, 0);
    const ltV    = longterm.reduce((s,r) => s + r.ltp * r.qty, 0);
    const total  = tradeV + ltV + sip;

    const segments = [
      { label: 'Active Trades', value: tradeV,  color: '#3b82f6' },
      { label: 'Long Term',     value: ltV,     color: '#22c55e' },
      { label: 'Mutual Funds',  value: sip,     color: '#f59e0b' },
    ].filter(s => s.value > 0);

    if (pieChart) { pieChart.destroy(); pieChart = null; }
    const canvas = container.querySelector('#dash-pie-chart');
    if (!canvas || !segments.length) return;

    if (window.Chart) {
      pieChart = new Chart(canvas, {
        type: 'doughnut',
        data: {
          labels: segments.map(s => s.label),
          datasets: [{
            data: segments.map(s => s.value),
            backgroundColor: segments.map(s => s.color),
            borderColor: 'rgba(0,0,0,0)',
            borderWidth: 2,
            hoverOffset: 6,
          }],
        },
        options: {
          animation: false,
          responsive: false,
          cutout: '68%',
          plugins: {
            legend: { display: false },
            tooltip: {
              callbacks: {
                label: (ctx) => `${ctx.label}: ${PmsUI.currency(ctx.parsed)}`,
              },
            },
          },
        },
      });
    }

    // Legend
    const legend = container.querySelector('#dash-pie-legend');
    legend.innerHTML = segments.map(s => {
      const pct = total > 0 ? (s.value / total * 100).toFixed(1) : '0.0';
      return `
        <div style="display:flex;align-items:center;justify-content:space-between;padding:4px 0;border-bottom:1px solid var(--border);">
          <div style="display:flex;align-items:center;gap:8px;">
            <span style="width:8px;height:8px;border-radius:50%;background:${s.color};display:inline-block;"></span>
            <span style="font-size:12px;color:var(--text-secondary);">${s.label}</span>
          </div>
          <div style="font-family:var(--font-mono);font-size:12px;color:var(--text-primary);">${PmsUI.currency(s.value)} <span style="color:var(--text-muted);">${pct}%</span></div>
        </div>
      `;
    }).join('');
  }

  function renderProfitChart(container) {
    const exited = PmsState.readExited();
    const tradeCount = container.querySelector('#dash-trade-count');
    if (tradeCount) tradeCount.textContent = `${exited.length} trades`;

    if (profitChart) { profitChart.destroy(); profitChart = null; }
    const canvas = container.querySelector('#dash-profit-chart');
    if (!canvas || !exited.length || !window.Chart) return;

    let cum = 0;
    const points = [0, ...exited.map(r => { cum += Number(r.profit || 0); return PmsUI.round2(cum); })];
    const labels = points.map((_, i) => i);
    const color  = cum >= 0 ? '#22c55e' : '#ef4444';

    profitChart = new Chart(canvas, {
      type: 'line',
      data: {
        labels,
        datasets: [{
          data: points, borderColor: color, borderWidth: 2, fill: true,
          backgroundColor: `${color}14`, tension: 0.3, pointRadius: 0,
          pointHoverRadius: 4,
        }],
      },
      options: {
        animation: false, responsive: true, maintainAspectRatio: false,
        interaction: { mode: 'nearest', intersect: false },
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (ctx) => `Profit: ${PmsUI.currency(ctx.parsed.y)}`,
              title: (items) => `Trade ${items[0]?.label}`,
            },
          },
        },
        scales: {
          x: { display: false },
          y: {
            ticks: { color: '#4a5568', callback: v => PmsUI.currencyRound(v), font: { size: 10 } },
            grid: { color: 'rgba(255,255,255,0.05)' },
            border: { display: false },
          },
        },
      },
    });
  }

  function renderBreakdown(container) {
    const trades    = PmsState.readTrades();
    const longterm  = PmsState.readLongterm();
    const sipCost   = computeSipCost();
    const sipValue  = computeSipValue();

    const groups = [
      { name: 'Active Trades', cost: trades.reduce((s,r)=>s+r.wacc*r.qty,0), value: trades.reduce((s,r)=>s+r.ltp*r.qty,0), count: trades.length },
      { name: 'Long Term',     cost: longterm.reduce((s,r)=>s+r.wacc*r.qty,0), value: longterm.reduce((s,r)=>s+r.ltp*r.qty,0), count: longterm.length },
      { name: 'Mutual Funds',  cost: sipCost, value: sipValue, count: computeSipCount() },
    ];

    const el = container.querySelector('#dash-breakdown');
    el.innerHTML = `
      <table class="pms-table" style="width:100%;">
        <thead><tr>
          <th>Category</th><th>Positions</th><th>Invested</th><th>Current Value</th><th>P&amp;L</th><th>ROI</th>
        </tr></thead>
        <tbody>
          ${groups.map(g => {
            const pl  = g.value - g.cost;
            const roi = g.cost > 0 ? (pl / g.cost * 100) : 0;
            return `<tr>
              <td>${g.name}</td>
              <td style="color:var(--text-secondary);">${g.count}</td>
              <td>${PmsUI.currency(g.cost)}</td>
              <td>${PmsUI.currency(g.value)}</td>
              <td class="${PmsUI.plClass(pl)}">${PmsUI.currency(pl)}</td>
              <td class="${PmsUI.plClass(roi)}">${PmsUI.pct(roi)}</td>
            </tr>`;
          }).join('')}
        </tbody>
      </table>
    `;
  }

  function downloadBackup() {
    const snap  = PmsState.createSnapshot();
    const json  = JSON.stringify(snap, null, 2);
    const blob  = new Blob([json], { type: 'application/json' });
    const url   = URL.createObjectURL(blob);
    const a     = document.createElement('a');
    a.href = url;
    a.download = `NEPSE_Backup_${new Date().toISOString().slice(0,10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    PmsUI.toast('Backup downloaded ✓', 'success');
  }

  async function restoreBackup(e, container) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      PmsState.restoreSnapshot(data);
      PmsUI.toast('Portfolio restored ✓', 'success');
      refresh(container);
    } catch {
      PmsUI.toast('Invalid backup file', 'error');
    }
    e.target.value = '';
  }

  // ── SIP helpers ───────────────────────────────────────────
  function computeSipValue() {
    const sip = PmsState.readSip();
    return sip.sips.reduce((sum, name) => {
      const rows = sip.records[name] || [];
      const nav  = Number(sip.currentNav[name] || 0);
      const units = rows.reduce((s,r) => s + Number(r.units || 0), 0);
      return sum + units * nav;
    }, 0);
  }
  function computeSipCost() {
    const sip = PmsState.readSip();
    return sip.sips.reduce((sum, name) => {
      return sum + (sip.records[name] || []).reduce((s,r) => s + Number(r.amount || 0), 0);
    }, 0);
  }
  function computeSipCount() {
    return PmsState.readSip().sips.length;
  }

  return { render, refresh };
})();
