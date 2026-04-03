/**
 * Past Trades View
 * Exited positions with full NEPSE round-trip P&L, tax, and commission breakdown.
 * All normalizeExited logic preserved from original pasttrades.js
 */
const TradesView = (() => {
  let sortKey = 'exitedAt', sortDir = -1;
  let filterText = '';

  function render(container) {
    container.innerHTML = `
      <div class="view-enter">
        <div class="view-header">
          <div>
            <div class="view-title">Trade History</div>
            <div class="view-subtitle">All closed positions with full P&L breakdown</div>
          </div>
        </div>

        <!-- Exit Form -->
        <div class="pms-card section-gap">
          <div class="pms-card-header">
            <span class="pms-card-title">Exit Position</span>
          </div>
          <div class="pms-card-body">
            <form id="exit-form" autocomplete="off">
              <div class="pms-form-grid">
                <div class="pms-field">
                  <label class="pms-label">Source</label>
                  <select class="pms-select" id="exit-type" name="type">
                    <option value="trades">Active Trades</option>
                    <option value="longterm">Long Term</option>
                  </select>
                </div>
                <div class="pms-field">
                  <label class="pms-label">Position</label>
                  <select class="pms-select" id="exit-record" name="record"></select>
                </div>
                <div class="pms-field">
                  <label class="pms-label">Available Qty</label>
                  <input class="pms-input" id="exit-available-qty" readonly placeholder="—">
                </div>
                <div class="pms-field">
                  <label class="pms-label">Sell Qty</label>
                  <input class="pms-input" id="exit-sell-qty" name="sellQty" type="number" min="1" step="1" placeholder="100">
                </div>
                <div class="pms-field">
                  <label class="pms-label">Sell Price</label>
                  <input class="pms-input" id="exit-sold-price" name="soldPrice" type="number" min="0.01" step="0.01" placeholder="1200.00">
                </div>
                <div class="pms-field">
                  <label class="pms-label">Holding Days</label>
                  <input class="pms-input" id="exit-holding-days" name="holdingDays" type="number" min="0" step="1" placeholder="30">
                </div>
                <div class="pms-field" style="align-self:end;">
                  <button class="pms-btn pms-btn-primary" type="submit">Record Exit</button>
                </div>
              </div>
            </form>
            <!-- P&L Preview -->
            <div id="exit-pl-preview" style="margin-top:16px;display:none;padding:12px 16px;background:var(--bg-elevated);border-radius:var(--r-md);font-size:12px;font-family:var(--font-mono);"></div>
          </div>
        </div>

        <!-- Metrics Strip -->
        <div id="trade-metrics" class="stat-grid" style="margin-top:20px;"></div>

        <!-- History Table -->
        <div class="table-section section-gap">
          <div class="filter-bar">
            <input class="filter-input" id="trade-filter" placeholder="Filter by script…" autocomplete="off">
          </div>
          <div class="pms-table-wrap">
            <table class="pms-table" id="trade-table">
              <thead>
                <tr>
                  <th data-sort="type">Type</th>
                  <th data-sort="name">Script</th>
                  <th data-sort="qty">Qty</th>
                  <th data-sort="buyPrice">Buy Price</th>
                  <th data-sort="soldPrice">Sell Price</th>
                  <th data-sort="buyTotal">Invested</th>
                  <th data-sort="soldTotal">Sell Total</th>
                  <th data-sort="totalTaxPaid" style="color:var(--loss);">Total Fees+Tax</th>
                  <th data-sort="profit">Net Profit</th>
                  <th data-sort="moneyReceivable">Net Receivable</th>
                  <th data-sort="holdingDays">Days</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody id="trade-tbody"></tbody>
            </table>
          </div>
        </div>
      </div>
    `;

    bindEvents(container);
    populateRecordSelect(container);
    renderHistory(container);
  }

  function bindEvents(container) {
    container.querySelector('#exit-type').onchange = () => populateRecordSelect(container);
    container.querySelector('#exit-record').onchange = () => updateRecordInfo(container);

    // Live P&L preview
    const liveInputs = ['#exit-sold-price', '#exit-holding-days', '#exit-sell-qty'];
    liveInputs.forEach(sel => {
      container.querySelector(sel)?.addEventListener('input', () => updatePlPreview(container));
    });

    container.querySelector('#exit-form').onsubmit = (e) => {
      e.preventDefault();
      submitExit(container);
    };

    container.querySelector('#trade-filter').addEventListener('input', e => {
      filterText = e.target.value.trim().toLowerCase();
      renderHistory(container);
    });

    // Sort headers
    container.querySelector('#trade-table').querySelectorAll('th[data-sort]').forEach(th => {
      th.onclick = () => {
        if (sortKey === th.dataset.sort) sortDir *= -1;
        else { sortKey = th.dataset.sort; sortDir = -1; }
        renderHistory(container);
      };
    });
  }

  function populateRecordSelect(container) {
    const type  = container.querySelector('#exit-type').value;
    const rows  = getActiveRecords(type);
    const sel   = container.querySelector('#exit-record');
    sel.innerHTML = rows.length
      ? rows.map(r => `<option value="${r.id}">${PmsUI.esc(r.name)} (${r.qty})</option>`).join('')
      : '<option value="">No positions available</option>';
    updateRecordInfo(container);
  }

  function updateRecordInfo(container) {
    const type   = container.querySelector('#exit-type').value;
    const id     = container.querySelector('#exit-record').value;
    const rows   = getActiveRecords(type);
    const record = rows.find(r => r.id === id);
    const qtyEl  = container.querySelector('#exit-available-qty');
    const sqEl   = container.querySelector('#exit-sell-qty');
    if (record) {
      const avail = Math.floor(Number(record.qty || 0));
      qtyEl.value = avail;
      sqEl.max    = avail;
      sqEl.value  = avail;
    } else {
      qtyEl.value = '';
      sqEl.value  = '';
    }
    updatePlPreview(container);
  }

  function updatePlPreview(container) {
    const preview = container.querySelector('#exit-pl-preview');
    const sp = PmsUI.num(container.querySelector('#exit-sold-price').value);
    const hd = Math.floor(PmsUI.num(container.querySelector('#exit-holding-days').value)) || 0;
    const sq = Math.floor(PmsUI.num(container.querySelector('#exit-sell-qty').value)) || 0;

    const type   = container.querySelector('#exit-type').value;
    const id     = container.querySelector('#exit-record').value;
    const rows   = getActiveRecords(type);
    const record = rows.find(r => r.id === id);

    if (!record || !Number.isFinite(sp) || sp <= 0 || sq <= 0) {
      preview.style.display = 'none'; return;
    }

    const calc   = PmsTradeMath.calculateRoundTrip({ buyPrice: record.buyPrice, soldPrice: sp, qty: sq, holdingDays: hd });
    const taxPct = hd > 365 ? '5% LT' : '7.5% ST';
    preview.style.display = '';
    preview.innerHTML = `
      <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px 16px;">
        <div><div style="color:var(--text-muted);font-size:10px;margin-bottom:2px;">INVESTED</div><div>${PmsUI.currency(calc.invested)}</div></div>
        <div><div style="color:var(--text-muted);font-size:10px;margin-bottom:2px;">GROSS P&L</div><div class="${PmsUI.plClass(calc.grossProfit)}">${PmsUI.currency(calc.grossProfit)}</div></div>
        <div><div style="color:var(--text-muted);font-size:10px;margin-bottom:2px;">TAX (${taxPct})</div><div style="color:var(--loss);">${PmsUI.currency(calc.capitalGainTax)}</div></div>
        <div><div style="color:var(--text-muted);font-size:10px;margin-bottom:2px;">NET PROFIT</div><div class="${PmsUI.plClass(calc.netProfit)}" style="font-weight:700;">${PmsUI.currency(calc.netProfit)}</div></div>
      </div>
    `;
  }

  function submitExit(container) {
    const type      = container.querySelector('#exit-type').value;
    const id        = container.querySelector('#exit-record').value;
    const soldPrice = PmsUI.num(container.querySelector('#exit-sold-price').value);
    const holdingDays = Math.floor(PmsUI.num(container.querySelector('#exit-holding-days').value)) || 0;
    const sellQty   = Math.floor(PmsUI.num(container.querySelector('#exit-sell-qty').value));
    const rows      = getActiveRecords(type);
    const record    = rows.find(r => r.id === id);

    if (!record || !Number.isFinite(soldPrice) || soldPrice <= 0 || sellQty <= 0 || sellQty > Math.floor(record.qty)) {
      PmsUI.toast('Invalid exit data — check all fields', 'error'); return;
    }

    const calc = PmsTradeMath.calculateRoundTrip({ buyPrice: record.buyPrice, soldPrice, qty: sellQty, holdingDays });
    const exited = PmsState.readExited();
    exited.push({
      id:           crypto.randomUUID(),
      exitedAt:     new Date().toISOString(),
      type:         record.source,
      name:         record.name,
      qty:          sellQty,
      buyPrice:     record.buyPrice,
      soldPrice,
      total:        soldPrice * sellQty,
      buyTotal:     calc.invested,
      soldTotal:    calc.realizedAmount,
      netSoldTotal: Number(calc.netRealizedAmount),
      grossProfit:  Number(calc.grossProfit),
      capitalGainTax: Number(calc.capitalGainTax),
      profit:       Number(calc.netProfit),
      perDayProfit: holdingDays > 0 ? Number(calc.netProfit) / holdingDays : Number(calc.netProfit),
      holdingDays,
    });
    PmsState.persistExited(exited);
    PmsCapital.adjustCash(Number(calc.netRealizedAmount));
    removeFromActive(record, type, sellQty);

    PmsUI.toast(`Exit recorded. Net profit: ${PmsUI.currency(calc.netProfit)}`, calc.netProfit >= 0 ? 'success' : 'info');
    populateRecordSelect(container);
    renderHistory(container);
    container.querySelector('#exit-pl-preview').style.display = 'none';
    container.querySelector('#exit-form').reset();
  }

  function renderHistory(container) {
    const exited   = PmsState.readExited();
    const filtered = exited
      .filter(r => !filterText || String(r.name || '').toLowerCase().includes(filterText))
      .map(normalizeExited)
      .sort(makeSorter());

    renderMetrics(container, filtered);

    const tbody = container.querySelector('#trade-tbody');
    tbody.innerHTML = '';

    if (!filtered.length) {
      tbody.innerHTML = `<tr><td colspan="12" style="padding:32px;text-align:center;color:var(--text-muted);">No exited trades yet.</td></tr>`;
      return;
    }

    filtered.forEach(row => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><span class="badge badge-blue">${PmsUI.esc(row.type)}</span></td>
        <td style="font-weight:600;">${PmsUI.esc(row.name)}</td>
        <td>${PmsUI.fmtQty(row.qty)}</td>
        <td>${PmsUI.currency(row.buyPrice)}</td>
        <td>${PmsUI.currency(row.soldPrice)}</td>
        <td>${PmsUI.currency(row.buyTotal)}</td>
        <td>${PmsUI.currency(row.soldTotal)}</td>
        <td class="val-loss">${PmsUI.currency(row.totalTaxPaid)}</td>
        <td class="${PmsUI.plClass(row.profit)}" style="font-weight:600;">${PmsUI.currency(row.profit)}</td>
        <td class="${PmsUI.plClass(row.moneyReceivable)}">${PmsUI.currency(row.moneyReceivable)}</td>
        <td style="color:var(--text-muted);">${row.holdingDays}d</td>
        <td class="actions-cell">
          <button class="pms-btn pms-btn-icon" data-edit="${row.id}">✎</button>
          <button class="pms-btn pms-btn-icon pms-btn-danger" data-del="${row.id}">✕</button>
        </td>
      `;
      tbody.appendChild(tr);
    });

    tbody.querySelectorAll('[data-edit]').forEach(btn => btn.onclick = () => editExited(btn.dataset.edit, container));
    tbody.querySelectorAll('[data-del]').forEach(btn => btn.onclick = () => deleteExited(btn.dataset.del, container));
  }

  function renderMetrics(container, rows) {
    const totals = rows.reduce((acc, r) => {
      acc.bought   += Number(r.buyTotal || 0);
      acc.sold     += Number(r.soldTotal || 0);
      acc.profit   += Number(r.profit || 0);
      acc.tax      += Number(r.totalTaxPaid || 0);
      acc.receivable += Number(r.moneyReceivable || 0);
      return acc;
    }, { bought: 0, sold: 0, profit: 0, tax: 0, receivable: 0 });

    const wins    = rows.filter(r => r.profit > 0).length;
    const winRate = rows.length > 0 ? (wins / rows.length * 100).toFixed(1) : '0.0';

    const el = container.querySelector('#trade-metrics');
    el.innerHTML = [
      { l: 'Buy Total',    v: PmsUI.currency(totals.bought),    c: '' },
      { l: 'Sell Total',   v: PmsUI.currency(totals.sold),      c: '' },
      { l: 'Total Profit', v: PmsUI.currency(totals.profit),    c: totals.profit >= 0 ? 'profit-card' : 'loss-card' },
      { l: 'Total Fees+Tax', v: PmsUI.currency(totals.tax),     c: 'loss-card' },
      { l: 'Win Rate',     v: `${winRate}%`,                     c: winRate >= 50 ? 'profit-card' : 'loss-card' },
      { l: 'Closed Trades', v: String(rows.length),             c: '' },
    ].map(k => `
      <div class="stat-card ${k.c}">
        <div class="stat-label">${k.l}</div>
        <div class="stat-value">${k.v}</div>
      </div>
    `).join('');
  }

  function editExited(id, container) {
    const exited = PmsState.readExited();
    const row    = exited.find(r => r.id === id);
    if (!row) return;
    const norm   = normalizeExited(row);
    const { card, close } = PmsUI.modal({
      title: `Edit ${norm.name}`,
      subtitle: 'Recalculate with updated sell price and holding period.',
      body: `
        <div class="pms-form-grid" style="grid-template-columns:1fr 1fr;">
          <div class="pms-field"><label class="pms-label">Sell Price</label>
            <input class="pms-input" data-f="soldPrice" type="number" min="0.01" step="0.01" value="${norm.soldPrice}">
          </div>
          <div class="pms-field"><label class="pms-label">Holding Days</label>
            <input class="pms-input" data-f="holdingDays" type="number" min="0" step="1" value="${norm.holdingDays}">
          </div>
        </div>
      `,
      actions: `
        <button class="pms-btn pms-btn-ghost" data-cancel="true">Cancel</button>
        <button class="pms-btn pms-btn-primary" data-save="true">Update</button>
      `,
    });
    card.querySelector('[data-cancel]').onclick = close;
    card.querySelector('[data-save]').onclick = () => {
      const soldPrice   = PmsUI.num(card.querySelector('[data-f="soldPrice"]').value);
      const holdingDays = Math.floor(PmsUI.num(card.querySelector('[data-f="holdingDays"]').value)) || 0;
      if (!Number.isFinite(soldPrice) || soldPrice <= 0) return;
      const recalc = PmsTradeMath.calculateRoundTrip({ buyPrice: Number(row.buyPrice || 0), soldPrice, qty: Number(row.qty || 0), holdingDays });
      const prevNet = Number(row.netSoldTotal || row.soldTotal || 0);
      row.soldPrice     = soldPrice;
      row.holdingDays   = holdingDays;
      row.profit        = Number(recalc.netProfit);
      row.capitalGainTax = Number(recalc.capitalGainTax);
      row.netSoldTotal  = Number(recalc.netRealizedAmount);
      row.perDayProfit  = holdingDays > 0 ? row.profit / holdingDays : row.profit;
      PmsCapital.adjustCash(row.netSoldTotal - prevNet);
      PmsState.persistExited(exited);
      PmsUI.toast('Trade updated ✓', 'success');
      close();
      renderHistory(container);
    };
  }

  function deleteExited(id, container) {
    PmsUI.confirm({
      title: 'Delete Exited Trade',
      message: 'This will remove the record and reverse the credited cash.',
      confirmText: 'Delete',
      danger: true,
      onConfirm: () => {
        const exited = PmsState.readExited();
        const target = exited.find(r => r.id === id);
        if (target) PmsCapital.adjustCash(-Number(target.netSoldTotal || target.soldTotal || 0));
        PmsState.persistExited(exited.filter(r => r.id !== id));
        PmsUI.toast('Trade deleted', 'info');
        renderHistory(container);
      },
    });
  }

  // ── Financial normalizer (preserved from original) ────────
  function normalizeExited(row) {
    const calc = PmsTradeMath.calculateRoundTrip({
      buyPrice:  row.buyPrice,
      soldPrice: row.soldPrice || row.currentPrice || 0,
      qty:       row.qty,
      holdingDays: row.holdingDays,
    });
    const profit        = Number(calc.netProfit || calc.profit || row.profit || 0);
    const capitalGainTax = Number(calc.capitalGainTax || row.capitalGainTax || 0);
    const holdingDays   = Math.floor(Number(row.holdingDays || 0));
    const buy  = calc.buy  || {};
    const sell = calc.sell || {};
    const totalTaxPaid  = capitalGainTax
      + Number(buy.commission  || 0) + Number(sell.commission  || 0)
      + Number(buy.sebonFee    || 0) + Number(sell.sebonFee    || 0)
      + Number(buy.dpCharge    || 0) + Number(sell.dpCharge    || 0);
    return {
      ...row,
      capitalGainTax,
      profit,
      soldTotal:     Number(calc.realizedAmount  || row.soldTotal || 0),
      total:         Number(row.total || (Number(row.soldPrice || 0) * Number(row.qty || 0))),
      totalTaxPaid,
      buyTotal:      Number(calc.invested        || row.buyTotal  || 0),
      netSoldTotal:  Number(calc.netRealizedAmount || row.netSoldTotal || row.soldTotal || 0),
      perDayProfit:  holdingDays > 0 ? profit / holdingDays : profit,
      moneyReceivable: Number(calc.invested || row.buyTotal || 0) + profit,
      holdingDays,
    };
  }

  function getActiveRecords(type) {
    if (type === 'trades') {
      return getRows('trades').map(r => ({
        id: `t-${r.id}`, rawId: r.id, source: 'Trade', name: r.script,
        qty: r.qty, buyPrice: r.wacc, currentPrice: r.ltp, ref: 'trades',
      }));
    }
    if (type === 'longterm') {
      return getRows('longterm').map(r => ({
        id: `l-${r.id}`, rawId: r.id, source: 'Long Term', name: r.script,
        qty: r.qty, buyPrice: r.wacc, currentPrice: r.ltp, ref: 'longterm',
      }));
    }
    return [];
  }

  function removeFromActive(record, type, soldQty) {
    const key  = type === 'trades' ? 'trades' : 'longterm';
    const rows = getRows(key);
    const idx  = rows.findIndex(r => r.id === record.rawId);
    if (idx < 0) return;
    const nextQty = Math.floor(rows[idx].qty) - Math.floor(soldQty);
    if (nextQty <= 0) rows.splice(idx, 1);
    else rows[idx].qty = nextQty;
    localStorage.setItem(key, JSON.stringify(rows));
  }

  function getRows(key) {
    try { return JSON.parse(localStorage.getItem(key) || '[]'); } catch { return []; }
  }

  function makeSorter() {
    return (a, b) => {
      const val = (r) => {
        switch (sortKey) {
          case 'type':          return String(r.type || '').toLowerCase();
          case 'name':          return String(r.name || '').toLowerCase();
          case 'qty':           return Number(r.qty || 0);
          case 'buyPrice':      return Number(r.buyPrice || 0);
          case 'soldPrice':     return Number(r.soldPrice || 0);
          case 'buyTotal':      return Number(r.buyTotal || 0);
          case 'soldTotal':     return Number(r.soldTotal || 0);
          case 'totalTaxPaid':  return Number(r.totalTaxPaid || 0);
          case 'profit':        return Number(r.profit || 0);
          case 'moneyReceivable': return Number(r.moneyReceivable || 0);
          case 'holdingDays':   return Number(r.holdingDays || 0);
          default:              return Number(r.profit || 0);
        }
      };
      const av = val(a), bv = val(b);
      if (typeof av === 'string') return av.localeCompare(bv) * sortDir;
      return (av - bv) * sortDir;
    };
  }

  return { render };
})();
