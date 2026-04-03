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
            <label class="pms-btn pms-btn-primary" style="cursor:pointer;">
              ⬆ Update LTP
              <input type="file" id="dash-ltp-input" accept=".csv,.txt" style="display:none">
            </label>
            <button class="pms-btn pms-btn-ghost" id="dash-backup-btn">⬇ Backup</button>
            <label class="pms-btn pms-btn-ghost" style="cursor:pointer;">
              ⬆ Restore
              <input type="file" id="dash-restore-input" accept=".json" style="display:none">
            </label>
          </div>
        </div>

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
              <span class="pms-card-title">Profit Curves</span>
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
    container.querySelector('#dash-ltp-input').onchange = (e) => uploadLtpCsv(e, container);
    container.querySelector('#dash-backup-btn').onclick = () => downloadBackup();
    container.querySelector('#dash-restore-input').onchange = (e) => restoreBackup(e, container);
  }

  function refresh(container) {
    if (!container) return;
    renderPieChart(container);
    renderProfitChart(container);
    renderBreakdown(container);
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
    const profitLedger = PmsCapital.readLedger()
      .filter(r => r.entryCategory === 'profit')
      .sort((a, b) => new Date(a.createdAt || 0) - new Date(b.createdAt || 0));

    const tradeCount = container.querySelector('#dash-trade-count');
    if (tradeCount) tradeCount.textContent = `${exited.length} closed trades • ${profitLedger.length} profit booked entries`;

    if (profitChart) { profitChart.destroy(); profitChart = null; }
    const canvas = container.querySelector('#dash-profit-chart');
    if (!canvas || !window.Chart) return;

    let realizedCum = 0;
    const realizedPoints = [0, ...exited.map(r => {
      realizedCum += Number(r.profit || 0);
      return PmsUI.round2(realizedCum);
    })];

    let bookedCum = 0;
    const bookedPoints = [0, ...profitLedger.map(r => {
      bookedCum += Number(r.baseAmount || Math.abs(Number(r.delta || 0)));
      return PmsUI.round2(bookedCum);
    })];
    const maxLen = Math.max(realizedPoints.length, bookedPoints.length);
    const labels = Array.from({ length: maxLen }, (_, i) => i);
    const realizedSeries = Array.from({ length: maxLen }, (_, i) => realizedPoints[Math.min(i, realizedPoints.length - 1)] ?? 0);
    const bookedSeries = Array.from({ length: maxLen }, (_, i) => bookedPoints[Math.min(i, bookedPoints.length - 1)] ?? 0);

    profitChart = new Chart(canvas, {
      type: 'line',
      data: {
        labels,
        datasets: [
          {
            label: 'Realized Profit',
            data: realizedSeries,
            borderColor: '#22c55e',
            borderWidth: 2,
            fill: true,
            backgroundColor: '#22c55e14',
            tension: 0.3,
            pointRadius: 0,
            pointHoverRadius: 4,
          },
          {
            label: 'Profit Booked (Cashflow)',
            data: bookedSeries,
            borderColor: '#f59e0b',
            borderWidth: 2,
            fill: false,
            tension: 0.3,
            pointRadius: 0,
            pointHoverRadius: 4,
          },
        ],
      },
      options: {
        animation: false, responsive: true, maintainAspectRatio: false,
        interaction: { mode: 'nearest', intersect: false },
        plugins: {
          legend: { display: true, labels: { color: '#8892a4', boxWidth: 10 } },
          tooltip: {
            callbacks: {
              label: (ctx) => `${ctx.dataset.label}: ${PmsUI.currency(ctx.parsed.y)}`,
              title: (items) => `Point ${items[0]?.label}`,
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

  async function uploadLtpCsv(e, container) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const { updates, parsed, errors } = PmsUI.parseLtpCsv(await file.text());
      if (!parsed) { PmsUI.toast('No valid CSV rows found', 'error'); return; }
      const updated = PmsUI.applyLtpUpdates(updates);
      PmsUI.toast(`LTP updated: ${updated} positions`, 'success');
      container.querySelector('#dash-backup-status').textContent =
        `LTP update from ${file.name} → Parsed ${parsed}, Updated ${updated}${errors ? `, Errors ${errors}` : ''}`;
      refresh(container);
    } catch {
      PmsUI.toast('Unable to parse CSV file', 'error');
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
