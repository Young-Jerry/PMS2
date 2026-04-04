const PerformanceView = (() => {
  let growthChart = null;
  let mixChart = null;

  function render(container) {
    const data = buildSeries();
    container.innerHTML = `<div class="view-enter"><div class="view-header"><div><div class="view-title">Performance</div><div class="view-subtitle">Growth curve, ROI trend, profit booked, and capital mix</div></div></div>
      <div class="dash-kpi-strip">${kpis(data).join('')}</div>
      <div class="grid-2 section-gap">${TerminalUI.card('Portfolio Growth Curve', '<div class="chart-wrap" style="height:240px"><canvas id="perf-growth"></canvas></div>')}${TerminalUI.card('Cash vs Invested vs Value', '<div class="chart-wrap" style="height:240px"><canvas id="perf-mix"></canvas></div>')}</div>
    </div>`;
    renderCharts(container, data);
  }

  function buildSeries() {
    const ledger = PmsCapital.readLedger().slice().sort((a,b)=>new Date(a.createdAt)-new Date(b.createdAt));
    const exited = PmsState.readExited();
    let cash = 0, invested = 0;
    const pts = [{label:'Start', cash:0, invested:0, value:0, roi:0, booked:0}];
    ledger.forEach((e, i) => {
      cash += Number(e.delta||0);
      if (e.entryCategory !== 'profit' && e.entryCategory !== 'profit_fee') invested += Math.max(0, Number(e.delta||0));
      const value = cash + invested;
      pts.push({ label: `T${i+1}`, cash, invested, value, roi: invested>0 ? ((value-invested)/invested*100):0, booked:Number(PmsCapital.readProfitCashedOut()||0)});
    });
    const wins = exited.filter(e=>Number(e.profit)>0).length;
    const losses = exited.filter(e=>Number(e.profit)<0).length;
    return { pts, wins, losses };
  }

  function kpis(data) {
    const last = data.pts[data.pts.length-1];
    const totalProfit = Number(PmsState.readExited().reduce((s,r)=>s+Number(r.profit||0),0));
    return [
      TerminalUI.kpiCard({label:'Total ROI', value:PmsUI.pct(last.roi), trend:data.pts.map(p=>p.roi), tone:last.roi>=0?'profit':'loss'}),
      TerminalUI.kpiCard({label:'Total Profit', value:PmsUI.currencyRound(totalProfit), trend:data.pts.map(p=>p.value-p.invested), tone:totalProfit>=0?'profit':'loss'}),
      TerminalUI.kpiCard({label:'Win/Loss', value:`${data.wins}/${data.losses}`, trend:[data.wins, data.losses], tone:data.wins>=data.losses?'profit':'loss'})
    ];
  }

  function renderCharts(container, data) {
    if (!window.Chart) return;
    growthChart?.destroy(); mixChart?.destroy();
    growthChart = new Chart(container.querySelector('#perf-growth'), {type:'line', data:{labels:data.pts.map(p=>p.label), datasets:[{label:'Portfolio Value', data:data.pts.map(p=>p.value), borderColor:'#38bdf8', fill:true, backgroundColor:'rgba(56,189,248,0.15)'},{label:'ROI %', data:data.pts.map(p=>p.roi), borderColor:'#34d399', yAxisID:'y1'}]}, options:{animation:false,responsive:true,maintainAspectRatio:false,scales:{y:{ticks:{callback:v=>PmsUI.currencyRound(v)}},y1:{position:'right',grid:{display:false}}}}});
    mixChart = new Chart(container.querySelector('#perf-mix'), {type:'bar', data:{labels:data.pts.map(p=>p.label), datasets:[{label:'Cash', data:data.pts.map(p=>p.cash), backgroundColor:'#a78bfa'},{label:'Invested', data:data.pts.map(p=>p.invested), backgroundColor:'#f59e0b'},{label:'Value', data:data.pts.map(p=>p.value), backgroundColor:'#22c55e'}]}, options:{animation:false,responsive:true,maintainAspectRatio:false,plugins:{legend:{labels:{color:'#cbd5e1'}}}}});
  }

  return { render };
})();
