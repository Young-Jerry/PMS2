/**
 * Risk Analysis View
 * Portfolio risk exposure, concentration, drawdown estimation,
 * position sizing guidelines based on NEPSE portfolio data.
 */
const RiskView = (() => {
  let riskChart = null;

  function render(container) {
    container.innerHTML = `
      <div class="view-enter">
        <div class="view-header">
          <div>
            <div class="view-title">Risk Analysis</div>
            <div class="view-subtitle">Exposure metrics, concentration risk &amp; drawdown estimation</div>
          </div>
        </div>

        <!-- Risk KPIs -->
        <div class="stat-grid risk-kpis-line" id="risk-kpis"></div>

        <div class="grid-2 section-gap">
          <!-- Concentration Chart -->
          <div class="pms-card">
            <div class="pms-card-header"><span class="pms-card-title">Position Concentration</span></div>
            <div class="pms-card-body" style="padding:12px 16px;">
              <div class="chart-wrap" style="height:200px;">
                <canvas id="risk-conc-chart"></canvas>
              </div>
            </div>
          </div>

          <!-- Risk Score Panel -->
          <div class="pms-card">
            <div class="pms-card-header"><span class="pms-card-title">Risk Indicators</span></div>
            <div class="pms-card-body" id="risk-indicators"></div>
          </div>
        </div>

        <!-- Position Risk Table -->
        <div class="table-section section-gap">
          <div class="pms-card-header" style="background:var(--bg-elevated);">
            <span class="pms-card-title">Position Risk Breakdown</span>
          </div>
          <div class="pms-table-wrap">
            <table class="pms-table">
              <thead><tr>
                <th>Script</th><th>Type</th><th>Qty</th><th>WACC</th><th>LTP</th>
                <th>Invested</th><th>% of Portfolio</th><th>Unrealized P&L</th><th>Risk Level</th>
              </tr></thead>
              <tbody id="risk-tbody"></tbody>
            </table>
          </div>
        </div>

      </div>
    `;
    refreshRisk(container);
  }

  function refreshRisk(container) {
    const trades    = PmsState.readTrades();
    const longterm  = PmsState.readLongterm();
    const allPos    = [
      ...trades.map(r => ({ ...r, source: 'Trade', sourceKey: 'trades' })),
      ...longterm.map(r => ({ ...r, source: 'Long Term', sourceKey: 'longterm' })),
    ];

    const totalInvested = allPos.reduce((s,r) => s + r.wacc * r.qty, 0);
    const totalCurrent  = allPos.reduce((s,r) => s + r.ltp  * r.qty, 0);
    const cash          = PmsCapital.readCash();
    const totalPortfolio = totalCurrent + cash;
    const unrealizedPL  = totalCurrent - totalInvested;

    renderKPIs(container, allPos, totalInvested, totalCurrent, totalPortfolio, cash);
    renderConcentrationChart(container, allPos, totalCurrent);
    renderIndicators(container, allPos, totalInvested, totalCurrent, totalPortfolio, cash);
    renderPositionTable(container, allPos, totalCurrent);
  }

  function renderKPIs(container, allPos, totalInvested, totalCurrent, totalPortfolio, cash) {
    const unrealizedPL = totalCurrent - totalInvested;
    const cashPct      = totalPortfolio > 0 ? (cash / totalPortfolio * 100) : 100;
    const investedPct  = totalPortfolio > 0 ? (totalCurrent / totalPortfolio * 100) : 0;
    const losses       = allPos.filter(r => r.ltp < r.wacc);

    container.querySelector('#risk-kpis').innerHTML = [
      { l: 'Total Invested',  v: PmsUI.currency(totalInvested),   c: '' },
      { l: 'Cash Reserve',    v: `${cashPct.toFixed(1)}%`,        c: '' },
      { l: 'Invested %',      v: `${investedPct.toFixed(1)}%`,     c: '' },
      { l: 'Unrealized P&L',  v: PmsUI.currency(unrealizedPL),    c: unrealizedPL >= 0 ? 'profit-card' : 'loss-card' },
      { l: 'Positions at Loss', v: String(losses.length),         c: '' },
    ].map(k => `
      <div class="stat-card ${k.c}">
        <div class="stat-label">${k.l}</div>
        <div class="stat-value">${k.v}</div>
      </div>
    `).join('');
  }

  function renderConcentrationChart(container, allPos, totalCurrent) {
    if (riskChart) { riskChart.destroy(); riskChart = null; }
    const canvas = container.querySelector('#risk-conc-chart');
    if (!canvas || !allPos.length || !window.Chart) return;

    const sorted = [...allPos]
      .map(r => ({ label: r.script, value: r.ltp * r.qty }))
      .sort((a,b) => b.value - a.value)
      .slice(0, 10);

    const pcts   = sorted.map(r => totalCurrent > 0 ? +(r.value / totalCurrent * 100).toFixed(1) : 0);
    const colors = sorted.map((_, i) => {
      const h = 200 + i * 22;
      return `hsl(${h},70%,55%)`;
    });

    riskChart = new Chart(canvas, {
      type: 'bar',
      data: {
        labels: sorted.map(r => r.label),
        datasets: [{ data: pcts, backgroundColor: colors, borderRadius: 4, borderSkipped: false }],
      },
      options: {
        animation: false, responsive: true, maintainAspectRatio: false, indexAxis: 'y',
        plugins: {
          legend: { display: false },
          tooltip: { callbacks: { label: ctx => `${ctx.parsed.x.toFixed(1)}% of portfolio` } },
        },
        scales: {
          x: { ticks: { color: '#4a5568', font: {size:10}, callback: v => `${v}%` }, grid: { color: 'rgba(255,255,255,0.05)' }, border: { display: false } },
          y: { ticks: { color: '#8892a4', font: {size:11} }, grid: { display: false }, border: { display: false } },
        },
      },
    });
  }

  function renderIndicators(container, allPos, totalInvested, totalCurrent, totalPortfolio, cash) {
    const cashPct     = totalPortfolio > 0 ? (cash / totalPortfolio * 100) : 100;
    const top5Value   = [...allPos].sort((a,b) => (b.ltp*b.qty)-(a.ltp*a.qty)).slice(0,5).reduce((s,r) => s+r.ltp*r.qty, 0);
    const top5Pct     = totalCurrent > 0 ? (top5Value / totalCurrent * 100) : 0;
    const lossCount   = allPos.filter(r => r.ltp < r.wacc).length;
    const concentration = top5Pct > 80 ? 'HIGH' : top5Pct > 60 ? 'MEDIUM' : 'LOW';
    const cashStatus  = cashPct < 10 ? 'LOW' : cashPct < 25 ? 'ADEQUATE' : 'HEALTHY';

    const indicators = [
      { l: 'Cash Reserve Status', v: cashStatus, c: cashPct < 10 ? 'val-loss' : cashPct < 25 ? 'val-amber' : 'val-profit' },
      { l: 'Top-5 Concentration', v: `${top5Pct.toFixed(1)}% — ${concentration}`, c: concentration === 'HIGH' ? 'val-loss' : concentration === 'MEDIUM' ? 'val-amber' : 'val-profit' },
      { l: 'Positions in Loss', v: `${lossCount} of ${allPos.length}`, c: lossCount > allPos.length / 2 ? 'val-loss' : lossCount > 0 ? 'val-amber' : 'val-profit' },
      { l: 'Portfolio Exposure', v: `${totalInvested > 0 ? ((totalCurrent / totalInvested)*100).toFixed(1) : '0.0'}%`, c: '' },
      { l: 'Diversification', v: allPos.length >= 10 ? 'GOOD' : allPos.length >= 5 ? 'MODERATE' : 'LOW', c: allPos.length >= 10 ? 'val-profit' : allPos.length >= 5 ? 'val-amber' : 'val-loss' },
    ];

    container.querySelector('#risk-indicators').innerHTML = indicators.map(i => `
      <div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--border);">
        <span style="font-size:12px;color:var(--text-muted);">${i.l}</span>
        <span style="font-family:var(--font-mono);font-size:12px;font-weight:700;" class="${i.c}">${i.v}</span>
      </div>
    `).join('');
  }

  function renderPositionTable(container, allPos, totalCurrent) {
    const tbody = container.querySelector('#risk-tbody');
    if (!allPos.length) {
      tbody.innerHTML = `<tr><td colspan="9" style="padding:28px;text-align:center;color:var(--text-muted);">No open positions</td></tr>`;
      return;
    }

    const sorted = [...allPos].sort((a,b) => (b.wacc*b.qty) - (a.wacc*a.qty));
    tbody.innerHTML = sorted.map(r => {
      const invested   = r.wacc * r.qty;
      const current    = r.ltp  * r.qty;
      const pl         = current - invested;
      const plPct      = r.wacc > 0 ? ((r.ltp - r.wacc) / r.wacc * 100) : 0;
      const portPct    = totalCurrent > 0 ? (current / totalCurrent * 100) : 0;
      const risk       = portPct > 20 ? 'HIGH' : portPct > 10 ? 'MEDIUM' : 'LOW';
      const riskClass  = risk === 'HIGH' ? 'badge-loss' : risk === 'MEDIUM' ? 'badge-amber' : 'badge-blue';
      return `<tr>
        <td style="font-weight:600;">${PmsUI.esc(r.script)}</td>
        <td><span class="badge badge-blue">${r.source}</span></td>
        <td>${PmsUI.fmtQty(r.qty)}</td>
        <td>${PmsUI.currency(r.wacc)}</td>
        <td>
          <input class="inline-input" data-ltp-id="${r.id}" data-ltp-source="${r.sourceKey}" type="number" min="0" step="0.01" value="${PmsUI.fmt2(r.ltp)}">
        </td>
        <td>${PmsUI.currency(invested)}</td>
        <td>
          <div style="display:flex;align-items:center;gap:8px;">
            <div style="flex:1;height:3px;background:var(--bg-elevated);border-radius:2px;min-width:60px;">
              <div style="height:100%;width:${Math.min(portPct,100).toFixed(1)}%;background:var(--accent);border-radius:2px;"></div>
            </div>
            <span style="font-family:var(--font-mono);font-size:11px;">${portPct.toFixed(1)}%</span>
          </div>
        </td>
        <td class="${PmsUI.plClass(pl)}">${PmsUI.currency(pl)} <span style="font-size:10px;">(${PmsUI.pct(plPct)})</span></td>
        <td><span class="badge ${riskClass}">${risk}</span></td>
      </tr>`;
    }).join('');

    tbody.querySelectorAll('[data-ltp-id]').forEach((input) => {
      input.addEventListener('blur', () => {
        const key = input.dataset.ltpSource;
        const id = input.dataset.ltpId;
        const value = Number(input.value);
        if (!Number.isFinite(value) || value < 0) return;
        const rows = key === 'trades' ? PmsState.readTrades() : PmsState.readLongterm();
        const row = rows.find(r => r.id === id);
        if (!row) return;
        row.ltp = value;
        if (key === 'trades') PmsState.persistTrades(rows);
        else PmsState.persistLongterm(rows);
        window.dispatchEvent(new CustomEvent('pms-portfolio-updated'));
      });
    });
  }

  return { render };
})();
