const DashboardView = (() => {
  let allocChart = null;
  let profitChart = null;
  let cashChart = null;

  function render(container) {
    const m = metrics();
    container.innerHTML = `<div class="view-enter"><div class="view-header"><div><div class="view-title">Dashboard</div><div class="view-subtitle">High-density portfolio command center</div></div></div>
      <div class="dash-kpi-strip">${kpiHtml(m)}</div>
      <div class="grid-2 section-gap">${TerminalUI.card('Portfolio Allocation', '<div class="chart-wrap" style="height:240px"><canvas id="d-alloc"></canvas></div>')}${TerminalUI.card('Profit Curve', '<div class="chart-wrap" style="height:240px"><canvas id="d-profit"></canvas></div>')}</div>
      <div class="grid-2 section-gap">${TerminalUI.card('Cash Trend', '<div class="chart-wrap" style="height:220px"><canvas id="d-cash"></canvas></div>')}${TerminalUI.card('ROI Sparkline + Recent Activity', `<div style="display:flex;align-items:center;justify-content:space-between;">${PmsUI.sparkline(m.roiSeries,220,60,m.totalProfit>=0?'#34d399':'#f87171')}<div class="stat-value ${PmsUI.plClass(m.roiNow)}">${PmsUI.pct(m.roiNow)}</div></div><div style="margin-top:10px;font-size:12px;color:var(--text-secondary);">${recentActivity()}</div>`)}</div>
    </div>`;
    charts(container, m);
  }

  function metrics() {
    const trades = PmsState.readTrades(); const long = PmsState.readLongterm();
    const invested = [...trades, ...long].reduce((s,r)=>s+Number(r.wacc||0)*Number(r.qty||0),0);
    const totalValue = [...trades, ...long].reduce((s,r)=>s+Number(r.ltp||0)*Number(r.qty||0),0);
    const totalProfit = totalValue - invested;
    const cash = PmsCapital.readCash();
    const daily = todayVsYesterday();
    const ledger = PmsCapital.readLedger().slice().sort((a,b)=>new Date(a.createdAt)-new Date(b.createdAt));
    let run = 0; const cashSeries=[0]; ledger.forEach(e=>{ run += Number(e.delta||0); cashSeries.push(run);});
    const roiSeries = [invested>0? totalProfit/invested*100:0, ...PmsState.readExited().slice(-6).map(e=>Number(e.profit||0))];
    return { invested,totalValue,totalProfit,cash,daily,cashSeries,roiSeries, roiNow: invested>0?totalProfit/invested*100:0,
      alloc:[trades.reduce((s,r)=>s+r.ltp*r.qty,0), long.reduce((s,r)=>s+r.ltp*r.qty,0), Math.max(cash,0)] };
  }

  function kpiHtml(m) {
    return [
      TerminalUI.kpiCard({label:'Total Value', value:PmsUI.currencyRound(m.totalValue), trend:[m.invested,m.totalValue], tone:m.totalProfit>=0?'profit':'loss'}),
      TerminalUI.kpiCard({label:'Total Invested', value:PmsUI.currencyRound(m.invested), trend:[m.invested*0.7,m.invested]}),
      TerminalUI.kpiCard({label:'Total Profit', value:PmsUI.currencyRound(m.totalProfit), trend:m.roiSeries, tone:m.totalProfit>=0?'profit':'loss'}),
      TerminalUI.kpiCard({label:'Cash Balance', value:PmsUI.currencyRound(m.cash), trend:m.cashSeries, tone:m.cash>=0?'profit':'loss'}),
      TerminalUI.kpiCard({label:'Daily P/L', value:PmsUI.currencyRound(m.daily), trend:[...m.roiSeries.slice(-4),m.daily], tone:m.daily>=0?'profit':'loss'})
    ].join('');
  }

  function charts(container,m){ if(!window.Chart) return; allocChart?.destroy(); profitChart?.destroy(); cashChart?.destroy();
    allocChart = new Chart(container.querySelector('#d-alloc'), {type:'doughnut', data:{labels:['Active','Long-term','Cash'], datasets:[{data:m.alloc, backgroundColor:['#38bdf8','#22c55e','#a78bfa']}]}, options:{animation:false,responsive:true,maintainAspectRatio:false}});
    profitChart = new Chart(container.querySelector('#d-profit'), {type:'line', data:{labels:m.roiSeries.map((_,i)=>i+1), datasets:[{label:'Profit', data:m.roiSeries, borderColor:'#34d399', fill:true, backgroundColor:'rgba(52,211,153,0.12)'}]}, options:{animation:false,responsive:true,maintainAspectRatio:false}});
    cashChart = new Chart(container.querySelector('#d-cash'), {type:'line', data:{labels:m.cashSeries.map((_,i)=>`E${i}`), datasets:[{label:'Cash', data:m.cashSeries, borderColor:'#a78bfa'}]}, options:{animation:false,responsive:true,maintainAspectRatio:false}});
  }

  function recentActivity() {
    return PmsCapital.readLedger().slice(-5).reverse().map(r=>`${new Date(r.createdAt||Date.now()).toLocaleDateString()} · ${r.note||r.entryCategory||'entry'} · ${PmsUI.currencyRound(r.delta)}`).join('<br>') || 'No recent activity.';
  }

  function todayVsYesterday() {
    const h = PmsUI.readDailyPLHistory().slice().sort((a,b)=>new Date(a.capturedAt)-new Date(b.capturedAt));
    if (h.length < 2) return 0;
    return Number(h[h.length-1].total||0) - Number(h[h.length-2].total||0);
  }

  return { render, refresh: render };
})();
