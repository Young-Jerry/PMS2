const DailyPLView = (() => {
  let chart = null;
  function render(container) {
    const history = PmsUI.readDailyPLHistory();
    const series = compute(history);
    container.innerHTML = `<div class="view-enter"><div class="view-header"><div><div class="view-title">Daily P/L</div><div class="view-subtitle">Snapshot-based day over day portfolio movement</div></div></div>
      <div class="dash-kpi-strip">${TerminalUI.kpiCard({label:'Today vs Yesterday', value:PmsUI.currencyRound(series.todayVsYesterday), trend:series.values, tone:series.todayVsYesterday>=0?'profit':'loss'})}${TerminalUI.kpiCard({label:'History Points', value:String(history.length), trend:series.values})}</div>
      ${TerminalUI.card('Daily P/L Line', '<div class="chart-wrap" style="height:260px"><canvas id="dpl-line"></canvas></div>')}
      ${TerminalUI.card('Snapshot History', `<div class="pms-table-wrap"><table class="pms-table"><thead><tr><th>Date</th><th>Total Value</th><th>Day P/L</th><th>Rows</th></tr></thead><tbody>${series.rowsHtml}</tbody></table></div>`)}
    </div>`;
    if (!window.Chart) return;
    chart?.destroy();
    chart = new Chart(container.querySelector('#dpl-line'), {type:'line', data:{labels:series.labels, datasets:[{label:'Daily P/L', data:series.values, borderColor:'#38bdf8', fill:true, backgroundColor:'rgba(56,189,248,0.16)'}]}, options:{animation:false,responsive:true,maintainAspectRatio:false}});
  }

  function compute(history) {
    const sorted = history.slice().sort((a,b)=>new Date(a.capturedAt)-new Date(b.capturedAt));
    const values=[]; const labels=[]; let prev=null; let todayVsYesterday=0;
    const rowsHtml = sorted.map((h, i) => {
      const pl = prev ? (Number(h.total||0)-Number(prev.total||0)) : 0;
      if (i===sorted.length-1) todayVsYesterday = pl;
      labels.push(h.date || h.capturedAt.slice(0,10)); values.push(pl); prev=h;
      return `<tr><td>${h.date || h.capturedAt.slice(0,10)}</td><td>${PmsUI.currencyRound(h.total)}</td><td class="${PmsUI.plClass(pl)}">${PmsUI.currencyRound(pl)}</td><td>${h.rows?.length||0}</td></tr>`;
    }).join('') || '<tr><td colspan="4">No daily snapshots yet. Upload CSV in Data Center and include in daily P/L.</td></tr>';
    return {labels, values, rowsHtml, todayVsYesterday};
  }
  return { render };
})();
