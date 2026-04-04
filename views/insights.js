/**
 * Insights View
 * Concentration and reserve metrics split from risk page.
 */
const InsightsView = (() => {
  let tradeChart = null;
  let longtermChart = null;

  function render(container) {
    container.innerHTML = `
      <div class="view-enter">
        <div class="view-header">
          <div>
            <div class="view-title">Insights</div>
            <div class="view-subtitle">Portfolio concentration and reserve health</div>
          </div>
        </div>

        <div class="stat-grid risk-kpis-line" id="insights-kpis"></div>

        <div class="grid-2 section-gap">
          <div class="pms-card">
            <div class="pms-card-header"><span class="pms-card-title">Position Concentration — Active Trades</span></div>
            <div class="pms-card-body" style="padding:12px 16px;">
              <div class="chart-wrap" style="height:220px;"><canvas id="insights-trades-chart"></canvas></div>
            </div>
          </div>
          <div class="pms-card">
            <div class="pms-card-header"><span class="pms-card-title">Position Concentration — Long Term</span></div>
            <div class="pms-card-body" style="padding:12px 16px;">
              <div class="chart-wrap" style="height:220px;"><canvas id="insights-longterm-chart"></canvas></div>
            </div>
          </div>
        </div>
      </div>
    `;

    refresh(container);
  }

  function refresh(container) {
    const trades = PmsState.readTrades();
    const longterm = PmsState.readLongterm();
    const allPos = [...trades, ...longterm];

    const totalInvested = allPos.reduce((s, r) => s + (Number(r.wacc || 0) * Number(r.qty || 0)), 0);
    const totalCurrent = allPos.reduce((s, r) => s + (Number(r.ltp || 0) * Number(r.qty || 0)), 0);
    const cash = PmsCapital.readCash();
    const totalPortfolio = totalCurrent + cash;
    const unrealizedPL = totalCurrent - totalInvested;
    const investedPct = totalPortfolio > 0 ? (totalCurrent / totalPortfolio * 100) : 0;
    const losses = allPos.filter(r => Number(r.ltp || 0) < Number(r.wacc || 0)).length;

    const kpi = container.querySelector('#insights-kpis');
    if (kpi) {
      kpi.innerHTML = [
        { l: 'Total Invested', v: PmsUI.currency(totalInvested), c: '' },
        { l: 'Cash Reserve', v: PmsUI.currency(cash), c: '' },
        { l: 'Invested %', v: `${investedPct.toFixed(1)}%`, c: '' },
        { l: 'Unrealized P/L', v: PmsUI.currency(unrealizedPL), c: unrealizedPL >= 0 ? 'profit-card' : 'loss-card' },
        { l: 'Position at Loss', v: String(losses), c: '' },
      ].map(s => `
        <div class="stat-card ${s.c}">
          <div class="stat-label">${s.l}</div>
          <div class="stat-value">${s.v}</div>
        </div>
      `).join('');
    }

    renderConcChart(container.querySelector('#insights-trades-chart'), trades, tradeChart, (instance) => { tradeChart = instance; });
    renderConcChart(container.querySelector('#insights-longterm-chart'), longterm, longtermChart, (instance) => { longtermChart = instance; });
  }

  function renderConcChart(canvas, rows, existingChart, setChart) {
    if (existingChart) { existingChart.destroy(); setChart(null); }
    if (!canvas || !window.Chart) return;

    const totalCurrent = rows.reduce((s, r) => s + (Number(r.ltp || 0) * Number(r.qty || 0)), 0);
    const sorted = [...rows]
      .map(r => ({ label: r.script, value: Number(r.ltp || 0) * Number(r.qty || 0) }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8);

    if (!sorted.length || totalCurrent <= 0) {
      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = '#8892a4';
      ctx.font = '12px Inter';
      ctx.fillText('No positions', 12, 20);
      return;
    }

    const pcts = sorted.map(r => +(r.value / totalCurrent * 100).toFixed(1));
    const chart = new Chart(canvas, {
      type: 'bar',
      data: {
        labels: sorted.map(r => r.label),
        datasets: [{ data: pcts, borderRadius: 4, borderSkipped: false, backgroundColor: '#3b82f6' }],
      },
      options: {
        animation: false, responsive: true, maintainAspectRatio: false, indexAxis: 'y',
        plugins: {
          legend: { display: false },
          tooltip: { callbacks: { label: ctx => `${ctx.parsed.x.toFixed(1)}% of bucket` } },
        },
        scales: {
          x: { ticks: { color: '#4a5568', callback: v => `${v}%`, font: { size: 10 } }, grid: { color: 'rgba(255,255,255,0.05)' }, border: { display: false } },
          y: { ticks: { color: '#8892a4', font: { size: 11 } }, grid: { display: false }, border: { display: false } },
        },
      },
    });

    setChart(chart);
  }

  return { render, refresh };
})();
