const ComparisonView = (() => {
  let barChart = null;
  function render(container) {
    const rows = [...PmsState.readTrades(), ...PmsState.readLongterm()];
    const scripts = [...new Set(rows.map(r => String(r.script||'').toUpperCase()))];
    container.innerHTML = `<div class="view-enter"><div class="view-header"><div><div class="view-title">Comparison</div><div class="view-subtitle">Compare two or more scripts across position metrics</div></div></div>
      ${TerminalUI.card('Select Scripts', `<select id="cmp-select" class="pms-select" multiple size="8">${scripts.map(s=>`<option value="${s}">${s}</option>`).join('')}</select><div style="font-size:11px;color:var(--text-muted);margin-top:8px;">Use Ctrl/Cmd to select multiple scripts.</div>`)}
      <div class="grid-2 section-gap">${TerminalUI.card('Side-by-side ROI', '<div class="chart-wrap" style="height:220px"><canvas id="cmp-bar"></canvas></div>')}${TerminalUI.card('Metric Matrix', '<div id="cmp-table"></div>')}</div>
    </div>`;
    container.querySelector('#cmp-select').addEventListener('change', ()=>refresh(container));
    refresh(container);
  }

  function refresh(container) {
    const selected = [...container.querySelector('#cmp-select').selectedOptions].map(o=>o.value);
    const all = [...PmsState.readTrades(), ...PmsState.readLongterm()];
    const rows = all.filter(r => selected.includes(String(r.script||'').toUpperCase()));
    const grouped = Object.values(rows.reduce((acc,r)=>{const k=String(r.script).toUpperCase(); acc[k]=acc[k]||{script:k,qty:0,invested:0,value:0,ltp:Number(r.ltp||0)}; acc[k].qty+=Number(r.qty||0); acc[k].invested += Number(r.wacc||0)*Number(r.qty||0); acc[k].value += Number(r.ltp||0)*Number(r.qty||0); return acc;},{})).map(r=>({...r,roi:r.invested>0?((r.value-r.invested)/r.invested*100):0}));
    container.querySelector('#cmp-table').innerHTML = `<table class="pms-table"><thead><tr><th>Script</th><th>Qty</th><th>LTP</th><th>Invested</th><th>ROI</th><th>Trend</th></tr></thead><tbody>${grouped.map(r=>`<tr><td>${r.script}</td><td>${PmsUI.fmtQty(r.qty)}</td><td>${PmsUI.currency(r.ltp)}</td><td>${PmsUI.currencyRound(r.invested)}</td><td class="${PmsUI.plClass(r.roi)}">${PmsUI.pct(r.roi)}</td><td>${PmsUI.sparkline([r.invested, r.value, r.value*1.01],80,24,r.roi>=0?'#34d399':'#f87171')}</td></tr>`).join('') || '<tr><td colspan="6">Select scripts to compare.</td></tr>'}</tbody></table>`;
    if (!window.Chart) return;
    barChart?.destroy();
    barChart = new Chart(container.querySelector('#cmp-bar'), {type:'bar', data:{labels:grouped.map(g=>g.script), datasets:[{label:'ROI %', data:grouped.map(g=>g.roi), backgroundColor:grouped.map(g=>g.roi>=0?'#34d399':'#f87171')}]}, options:{animation:false,responsive:true,maintainAspectRatio:false}});
  }
  return { render };
})();
