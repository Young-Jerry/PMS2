/**
 * Portfolio View
 * Manages Active Trades & Long-Term Holdings tabs.
 * All WACC, P/L, cost logic preserved exactly from original portfolio.js
 */
const PortfolioView = (() => {
  let activeTab = 'trades';   // 'trades' | 'longterm' | 'sip'

  const CONFIGS = {
    trades:   { key: 'trades',   title: 'Active Trades',  showRanges: true,  showInvested: true  },
    longterm: { key: 'longterm', title: 'Long-Term Hold',  showRanges: false, showInvested: true  },
    sip:      { key: 'sip',      title: 'SIP System',      showRanges: false, showInvested: false },
  };

  let sortKey = 'script', sortDir = 1;
  let filterText = '';
  let saveTimer = null;

  function render(container) {
    container.innerHTML = `
      <div class="view-enter">
        <div class="view-header">
          <div>
            <div class="view-title">Portfolio</div>
            <div class="view-subtitle">Manage positions, WACC and sell targets</div>
          </div>
          <div style="display:flex;gap:8px;align-items:center;">
            <span class="save-indicator" id="port-save-ind"></span>
            <div class="pms-tabs">
              <button class="pms-tab active" data-tab="trades">Active Trades</button>
              <button class="pms-tab" data-tab="longterm">Long Term</button>
              <button class="pms-tab" data-tab="sip">SIP System</button>
            </div>
          </div>
        </div>

        <!-- Add Form -->
        <div class="pms-card section-gap" id="port-add-card">
          <div class="pms-card-header">
            <span class="pms-card-title" id="port-form-title">Add Position</span>
          </div>
          <div class="pms-card-body">
            <form id="port-add-form" autocomplete="off">
              <div class="pms-form-grid">
                <div class="pms-field">
                  <label class="pms-label">Script</label>
                  <input class="pms-input" name="script" type="text" placeholder="NABIL" required>
                </div>
                <div class="pms-field">
                  <label class="pms-label">Quantity</label>
                  <input class="pms-input" name="qty" type="number" min="1" step="1" placeholder="100" required>
                </div>
                <div class="pms-field">
                  <label class="pms-label">LTP</label>
                  <input class="pms-input" name="ltp" type="number" min="0.01" step="0.01" placeholder="1050.00" required>
                </div>
                <div class="pms-field">
                  <label class="pms-label">WACC</label>
                  <input class="pms-input" name="wacc" type="number" min="0.01" step="0.01" placeholder="980.00" required>
                </div>
                <div class="pms-field" id="port-sell1-field">
                  <label class="pms-label">Target (Low)</label>
                  <input class="pms-input" name="sell1" type="number" min="0" step="0.01" placeholder="1100.00">
                </div>
                <div class="pms-field" style="align-self:end;">
                  <button class="pms-btn pms-btn-primary" type="submit">Add Position</button>
                </div>
              </div>
            </form>
          </div>
        </div>

        <!-- Positions Table -->
        <div class="table-section section-gap" id="port-table-section">
          <div class="filter-bar">
            <input class="filter-input" id="port-filter" placeholder="Filter by script…" autocomplete="off">
            <button class="pms-btn pms-btn-ghost" id="port-mass-btn">⟳ Mass Edit</button>
          </div>
          <div class="pms-table-wrap">
            <table class="pms-table">
              <thead id="port-thead"></thead>
              <tbody id="port-tbody"></tbody>
            </table>
          </div>
          <!-- Summary -->
          <div id="port-summary" style="display:flex;gap:0;border-top:1px solid var(--border);"></div>
        </div>
      </div>
    `;

    bindTabEvents(container);
    bindFormEvents(container);
    renderTab(container);
  }

  function bindTabEvents(container) {
    container.querySelectorAll('.pms-tab').forEach(btn => {
      btn.onclick = () => {
        container.querySelectorAll('.pms-tab').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        activeTab = btn.dataset.tab;
        sortKey = 'script'; sortDir = 1; filterText = '';
        const fi = container.querySelector('#port-filter');
        if (fi) fi.value = '';
        renderTab(container);
      };
    });
  }

  function bindFormEvents(container) {
    container.querySelector('#port-filter').addEventListener('input', e => {
      filterText = e.target.value.trim().toLowerCase();
      renderRows(container);
    });
    container.querySelector('#port-add-form').addEventListener('submit', e => {
      e.preventDefault();
      addPosition(container, new FormData(e.target));
      e.target.reset();
    });
    container.querySelector('#port-mass-btn').onclick = () => openMassEdit(container);
  }

  function renderTab(container) {
    const cfg = CONFIGS[activeTab];
    const addCard = container.querySelector('#port-add-card');
    const tableSection = container.querySelector('#port-table-section');
    if (activeTab === 'sip') {
      if (addCard) addCard.style.display = 'none';
      if (tableSection) tableSection.style.display = 'none';
      renderSipTab(container);
      return;
    }
    if (addCard) addCard.style.display = '';
    if (tableSection) tableSection.style.display = '';
    container.querySelector('#sip-tab-root')?.remove();
    // Update form label
    container.querySelector('#port-form-title').textContent = `Add to ${cfg.title}`;
    // Show/hide sell target field
    const sell1Field = container.querySelector('#port-sell1-field');
    if (sell1Field) sell1Field.style.display = cfg.showRanges ? '' : 'none';

    renderHeaders(container, cfg);
    renderRows(container, cfg);
  }

  function renderHeaders(container, cfg) {
    const thead = container.querySelector('#port-thead');
    const cols = [
      { key: 'script', label: 'Script' },
      { key: 'qty', label: 'Qty' },
      { key: 'ltp', label: 'LTP' },
      { key: 'wacc', label: 'WACC' },
      ...(cfg.showRanges ? [{ key: 'sell1', label: 'L.Target' }, { key: 'sell2', label: 'H.Target' }] : []),
      ...(cfg.showInvested ? [{ key: 'invested', label: 'Invested' }] : []),
      { key: 'current', label: 'Current Val' },
      { key: 'pl', label: 'P&L' },
      { key: 'plpct', label: 'ROI%' },
      { key: 'actions', label: '' },
    ];
    thead.innerHTML = `<tr>${cols.map(c => {
      if (c.key === 'actions') return `<th style="width:90px;"></th>`;
      const cls = sortKey === c.key ? (sortDir === 1 ? 'sort-asc' : 'sort-desc') : '';
      return `<th data-sort="${c.key}" class="${cls}">${c.label}</th>`;
    }).join('')}</tr>`;

    thead.querySelectorAll('th[data-sort]').forEach(th => {
      th.onclick = () => {
        if (sortKey === th.dataset.sort) sortDir *= -1;
        else { sortKey = th.dataset.sort; sortDir = th.dataset.sort === 'script' ? 1 : -1; }
        renderRows(container);
      };
    });
  }

  function renderRows(container) {
    const cfg   = CONFIGS[activeTab];
    const rows  = getRows(cfg.key);
    const tbody = container.querySelector('#port-tbody');

    const filtered = rows
      .filter(r => !filterText || r.script.toLowerCase().includes(filterText))
      .sort(makeSorter());

    tbody.innerHTML = '';
    if (!filtered.length) {
      tbody.innerHTML = `<tr><td colspan="12" style="padding:32px;text-align:center;color:var(--text-muted);">
        No positions yet. Add your first position above.
      </td></tr>`;
      renderSummary(container, []);
      return;
    }

    filtered.forEach(row => {
      const current = row.ltp * row.qty;
      const pl      = (row.ltp - row.wacc) * row.qty;
      const plPct   = row.wacc > 0 ? ((row.ltp - row.wacc) / row.wacc * 100) : 0;
      const invested = investedCost(row.wacc, row.qty);

      const tr = document.createElement('tr');

      // Script (editable)
      tr.appendChild(editableCell(row, cfg.key, 'script', row.script, 'text'));
      // Qty
      tr.appendChild(editableCell(row, cfg.key, 'qty', row.qty, 'number'));
      // LTP
      tr.appendChild(editableCell(row, cfg.key, 'ltp', row.ltp, 'number'));
      // WACC
      tr.appendChild(editableCell(row, cfg.key, 'wacc', row.wacc, 'number'));
      // Targets (trades only)
      if (cfg.showRanges) {
        tr.appendChild(editableCell(row, cfg.key, 'sell1', row.sell1, 'number'));
        const tdS2 = document.createElement('td');
        tdS2.innerHTML = `<input class="inline-input" type="number" value="${PmsUI.fmt2(row.sell2 || row.sell1 * 1.1)}" readonly tabindex="-1">`;
        tr.appendChild(tdS2);
      }
      // Invested
      if (cfg.showInvested) tr.appendChild(PmsUI.td(PmsUI.currency(invested)));
      // Current
      tr.appendChild(PmsUI.td(PmsUI.currency(current)));
      // P&L
      tr.appendChild(PmsUI.td(PmsUI.currency(pl), PmsUI.plClass(pl)));
      // ROI%
      tr.appendChild(PmsUI.td(PmsUI.pct(plPct), PmsUI.plClass(plPct)));
      // Actions
      const actTd = document.createElement('td');
      actTd.className = 'actions-cell';
      actTd.appendChild(makeBtn('✎', 'pms-btn-icon', () => openExitDialog(row, cfg)));
      actTd.appendChild(makeBtn('✕', 'pms-btn-icon pms-btn-danger', () => confirmDelete(row, cfg)));
      tr.appendChild(actTd);

      tbody.appendChild(tr);
    });

    renderSummary(container, filtered);
  }

  function renderSummary(container, rows) {
    const invested = rows.reduce((s,r) => s + r.wacc * r.qty, 0);
    const current  = rows.reduce((s,r) => s + r.ltp * r.qty, 0);
    const pl       = rows.reduce((s,r) => s + (r.ltp - r.wacc) * r.qty, 0);
    const el = container.querySelector('#port-summary');
    el.innerHTML = [
      ['Invested', PmsUI.currency(invested), ''],
      ['Current',  PmsUI.currency(current),  ''],
      ['P&L',      PmsUI.currency(pl),        PmsUI.plClass(pl)],
    ].map(([l,v,c]) => `
      <div style="flex:1;padding:12px 20px;border-right:1px solid var(--border);">
        <div class="stat-label">${l}</div>
        <div class="stat-value ${c}" style="font-size:14px;">${v}</div>
      </div>
    `).join('');
  }

  function editableCell(row, storageKey, field, value, type) {
    const td = document.createElement('td');
    const input = document.createElement('input');
    input.className = 'inline-input';
    input.type = type === 'number' ? 'number' : 'text';
    input.value = type === 'number' ? (field === 'qty' ? Math.floor(value) : PmsUI.fmt2(value)) : value;
    if (type === 'number') { input.min = '0'; input.step = field === 'qty' ? '1' : '0.01'; }

    const applyEdit = () => {
      const rawValue = String(input.value ?? '');
      const dedupeKey = `${field}:${rawValue}`;
      if (input.dataset.lastApplied === dedupeKey) return;
      input.dataset.lastApplied = dedupeKey;

      let newVal = type === 'number'
        ? (field === 'qty' ? Math.floor(PmsUI.num(input.value)) : PmsUI.num(input.value))
        : input.value.trim().toUpperCase();
      if (type === 'number' && !Number.isFinite(newVal)) {
        input.value = type === 'number' ? (field === 'qty' ? Math.floor(row[field]) : PmsUI.fmt2(row[field])) : row[field];
        return;
      }
      if (type === 'number' && newVal < 0) {
        input.value = type === 'number' ? (field === 'qty' ? Math.floor(row[field]) : PmsUI.fmt2(row[field])) : row[field];
        return;
      }
      if (field === 'qty' && newVal <= 0) {
        input.value = Math.floor(row[field]);
        return;
      }
      if (newVal === row[field]) return;

      row[field] = newVal;
      if (field === 'sell1') row.sell2 = newVal * 1.1;
      persistRow(storageKey, row);
      renderRows(document.getElementById('pms-view'));
    };

    input.addEventListener('blur', applyEdit);
    input.addEventListener('change', applyEdit);
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        input.blur();
      }
    });

    td.appendChild(input);
    return td;
  }

  function addPosition(container, fd) {
    const cfg    = CONFIGS[activeTab];
    const script = (fd.get('script') || '').trim().toUpperCase();
    const qty    = Math.floor(PmsUI.num(fd.get('qty')));
    const ltp    = PmsUI.num(fd.get('ltp'));
    const wacc   = PmsUI.num(fd.get('wacc'));
    const sell1  = cfg.showRanges ? (PmsUI.num(fd.get('sell1')) || 0) : 0;

    if (!script || !Number.isFinite(qty) || qty <= 0 || !Number.isFinite(ltp) || !Number.isFinite(wacc)) {
      PmsUI.toast('Please fill all required fields', 'error'); return;
    }

    const cost = investedCost(wacc, qty);
    if (PmsCapital.readCash() < cost) {
      PmsCapital.showCashAlert('Not enough cash to add this position.');
      return;
    }

    const rows = getRows(cfg.key);
    rows.push({ id: crypto.randomUUID(), script, ltp, qty, wacc, sell1, sell2: sell1 * 1.1 });
    saveRows(cfg.key, rows);
    PmsCapital.adjustCash(-cost);
    persist(cfg.key);
    PmsUI.toast(`${script} added ✓`, 'success');
    renderTab(container);
  }

  function openExitDialog(row, cfg) {
    const { backdrop, card, close } = PmsUI.modal({
      title: `Exit ${row.script}`,
      subtitle: 'Move this position to Past Trades with P&L calculation.',
      body: `
        <div class="pms-form-grid" style="grid-template-columns:1fr 1fr;">
          <div class="pms-field">
            <label class="pms-label">Sell Price</label>
            <input class="pms-input" data-f="soldPrice" type="number" min="0.01" step="0.01" placeholder="1200.00">
          </div>
          <div class="pms-field">
            <label class="pms-label">Holding Days</label>
            <input class="pms-input" data-f="holdingDays" type="number" min="0" step="1" placeholder="30">
          </div>
        </div>
        <div id="exit-preview" style="margin-top:16px;padding:12px;background:var(--bg-elevated);border-radius:var(--r-md);font-family:var(--font-mono);font-size:12px;"></div>
      `,
      actions: `
        <button class="pms-btn pms-btn-ghost" data-cancel="true">Cancel</button>
        <button class="pms-btn pms-btn-success" data-confirm="true">Exit Position</button>
      `,
    });

    card.querySelector('[data-cancel]').onclick = close;

    // Live P&L preview
    const preview = card.querySelector('#exit-preview');
    const updatePreview = () => {
      const sp  = PmsUI.num(card.querySelector('[data-f="soldPrice"]').value);
      const hd  = Math.floor(PmsUI.num(card.querySelector('[data-f="holdingDays"]').value)) || 0;
      if (!Number.isFinite(sp) || sp <= 0) { preview.innerHTML = '<span style="color:var(--text-muted);">Enter sell price to see P&L preview</span>'; return; }
      const calc = PmsTradeMath.calculateRoundTrip({ buyPrice: row.wacc, soldPrice: sp, qty: row.qty, holdingDays: hd });
      const taxPct = hd > 365 ? '5%' : '7.5%';
      preview.innerHTML = `
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
          <span style="color:var(--text-muted);">Gross P&L:</span> <span class="${PmsUI.plClass(calc.grossProfit)}">${PmsUI.currency(calc.grossProfit)}</span>
          <span style="color:var(--text-muted);">Capital Gain Tax (${taxPct}):</span> <span style="color:var(--loss);">${PmsUI.currency(calc.capitalGainTax)}</span>
          <span style="color:var(--text-muted);">Net Profit:</span> <span class="${PmsUI.plClass(calc.netProfit)}" style="font-weight:600;">${PmsUI.currency(calc.netProfit)}</span>
          <span style="color:var(--text-muted);">You Receive:</span> <span style="color:var(--text-primary);">${PmsUI.currency(calc.netRealizedAmount)}</span>
        </div>
      `;
    };
    card.querySelector('[data-f="soldPrice"]').addEventListener('input', updatePreview);
    card.querySelector('[data-f="holdingDays"]').addEventListener('input', updatePreview);

    card.querySelector('[data-confirm]').onclick = () => {
      const soldPrice   = PmsUI.num(card.querySelector('[data-f="soldPrice"]').value);
      const holdingDays = Math.floor(PmsUI.num(card.querySelector('[data-f="holdingDays"]').value)) || 0;
      if (!Number.isFinite(soldPrice) || soldPrice <= 0) { PmsUI.toast('Enter a valid sell price', 'error'); return; }
      exitPosition(row, cfg, soldPrice, holdingDays);
      close();
    };
  }

  function exitPosition(row, cfg, soldPrice, holdingDays) {
    const calc = PmsTradeMath.calculateRoundTrip({ buyPrice: row.wacc, soldPrice, qty: row.qty, holdingDays });
    const exited = PmsState.readExited();
    exited.push({
      id:          crypto.randomUUID(),
      exitedAt:    new Date().toISOString(),
      type:        cfg.key === 'longterm' ? 'Long Term' : 'Trade',
      name:        row.script,
      qty:         row.qty,
      buyPrice:    row.wacc,
      soldPrice,
      total:       soldPrice * row.qty,
      buyTotal:    calc.invested,
      soldTotal:   calc.realizedAmount,
      netSoldTotal: Number(calc.netRealizedAmount),
      grossProfit:  Number(calc.grossProfit),
      capitalGainTax: Number(calc.capitalGainTax),
      profit:       Number(calc.netProfit),
      perDayProfit: holdingDays > 0 ? Number(calc.netProfit) / holdingDays : Number(calc.netProfit),
      holdingDays,
    });
    PmsState.persistExited(exited);
    PmsCapital.adjustCash(Number(calc.netRealizedAmount));

    const rows = getRows(cfg.key).filter(r => r.id !== row.id);
    saveRows(cfg.key, rows);
    persist(cfg.key);
    PmsUI.toast(`${row.script} exited. Net: ${PmsUI.currency(calc.netProfit)}`, 'success');
    renderTab(document.getElementById('pms-view'));
  }

  function confirmDelete(row, cfg) {
    PmsUI.confirm({
      title: `Delete ${row.script}?`,
      message: 'This will remove the position and refund invested capital.',
      confirmText: 'Delete Position',
      danger: true,
      onConfirm: () => {
        const refund = investedCost(row.wacc, row.qty);
        PmsCapital.adjustCash(refund);
        const rows = getRows(cfg.key).filter(r => r.id !== row.id);
        saveRows(cfg.key, rows);
        persist(cfg.key);
        PmsUI.toast(`${row.script} deleted, Rs ${Math.round(refund)} refunded`, 'info');
        renderTab(document.getElementById('pms-view'));
      },
    });
  }

  function openMassEdit(container) {
    const cfg  = CONFIGS[activeTab];
    const rows = getRows(cfg.key);
    const { card, close } = PmsUI.modal({
      title: `Mass Edit — ${cfg.title}`,
      subtitle: 'Update all fields in one place.',
      wide: true,
      body: `
        <div class="pms-table-wrap">
          <table class="pms-table">
            <thead><tr>
              <th>Script</th><th>Qty</th><th>LTP</th><th>WACC</th>
              ${cfg.showRanges ? '<th>L.Target</th>' : ''}
            </tr></thead>
            <tbody id="mass-tbody">
              ${rows.map(r => `<tr>
                <td><input class="inline-input" data-k="script" data-id="${r.id}" value="${PmsUI.esc(r.script)}"></td>
                <td><input class="inline-input" type="number" data-k="qty" data-id="${r.id}" value="${Math.floor(r.qty)}" min="0" step="1"></td>
                <td><input class="inline-input" type="number" data-k="ltp" data-id="${r.id}" value="${PmsUI.fmt2(r.ltp)}" min="0" step="0.01"></td>
                <td><input class="inline-input" type="number" data-k="wacc" data-id="${r.id}" value="${PmsUI.fmt2(r.wacc)}" min="0" step="0.01"></td>
                ${cfg.showRanges ? `<td><input class="inline-input" type="number" data-k="sell1" data-id="${r.id}" value="${PmsUI.fmt2(r.sell1)}" min="0" step="0.01"></td>` : ''}
              </tr>`).join('')}
            </tbody>
          </table>
        </div>
      `,
      actions: `
        <button class="pms-btn pms-btn-ghost" data-cancel="true">Cancel</button>
        <button class="pms-btn pms-btn-primary" data-save="true">Save All Changes</button>
      `,
    });
    card.querySelector('[data-cancel]').onclick = close;
    card.querySelector('[data-save]').onclick = () => {
      card.querySelectorAll('input[data-id]').forEach(inp => {
        const row = rows.find(r => r.id === inp.dataset.id);
        if (!row) return;
        const k = inp.dataset.k;
        if (k === 'script') row.script = inp.value.trim().toUpperCase();
        else if (k === 'qty')   row.qty   = Math.max(0, Math.floor(PmsUI.num(inp.value) || 0));
        else if (k === 'ltp')   row.ltp   = Math.max(0, PmsUI.num(inp.value) || 0);
        else if (k === 'wacc')  row.wacc  = Math.max(0, PmsUI.num(inp.value) || 0);
        else if (k === 'sell1') { row.sell1 = Math.max(0, PmsUI.num(inp.value) || 0); row.sell2 = row.sell1 * 1.1; }
      });
      saveRows(cfg.key, rows);
      persist(cfg.key);
      PmsUI.toast('Mass edit saved ✓', 'success');
      close();
      renderTab(container);
    };
  }

  function renderSipTab(container) {
    const root = document.createElement('div');
    root.id = 'sip-tab-root';
    root.className = 'section-gap';
    root.innerHTML = `
      <div class="pms-card">
        <div class="pms-card-body">
          <div class="stat-grid">
            <div class="stat-card"><div class="stat-label">Total Units</div><div class="stat-value" id="sipTotalUnits">0</div></div>
            <div class="stat-card"><div class="stat-label">Current NAV</div><div class="stat-value" id="sipCurrentNav">Rs 0</div></div>
            <div class="stat-card"><div class="stat-label">Total Value</div><div class="stat-value" id="sipTotalValue">Rs 0</div></div>
          </div>
          <div style="margin-top:12px;" class="pms-tabs" id="sipTabs"></div>
        </div>
      </div>
      <div class="grid-2 section-gap">
        <div class="pms-card"><div class="pms-card-header"><span class="pms-card-title">Update NAV</span></div><div class="pms-card-body">
          <form id="sip-nav-form" class="pms-form-grid"><div class="pms-field"><label class="pms-label">SIP</label><select class="pms-select" name="sipName" required></select></div><div class="pms-field"><label class="pms-label">New NAV</label><input class="pms-input" name="nav" type="number" min="0.01" step="0.0001" required></div><button class="pms-btn pms-btn-ghost" type="submit">Update NAV</button></form>
        </div></div>
        <div class="pms-card"><div class="pms-card-header"><span class="pms-card-title">Manage SIPs</span></div><div class="pms-card-body">
          <form id="sip-manual-form" class="pms-form-grid"><div class="pms-field"><label class="pms-label">New SIP Name</label><input class="pms-input" name="newSipName" type="text" placeholder="e.g. NABIL" required></div><button class="pms-btn pms-btn-primary" type="submit">Add SIP</button><button class="pms-btn pms-btn-danger" type="button" id="sip-del-btn">Remove Active SIP</button></form>
        </div></div>
      </div>
      <div class="pms-card section-gap"><div class="pms-card-header"><span class="pms-card-title">Add Installment</span></div><div class="pms-card-body">
        <form id="sip-installment-form" class="pms-form-grid"><div class="pms-field"><label class="pms-label">SIP</label><select class="pms-select" name="sipName" required></select></div><div class="pms-field"><label class="pms-label">Date</label><input class="pms-input" name="date" type="date" required></div><div class="pms-field"><label class="pms-label">Units</label><input class="pms-input" name="units" type="number" min="1" step="1" required></div><div class="pms-field"><label class="pms-label">NAV</label><input class="pms-input" name="nav" type="number" min="0.01" step="0.0001" required></div><button class="pms-btn pms-btn-primary" type="submit">Add Installment</button></form>
      </div></div>
      <div class="table-section section-gap"><div class="filter-bar"><strong>SIP History</strong><select class="pms-select" id="sip-history" style="max-width:180px;"></select></div><div class="pms-table-wrap"><table class="pms-table"><thead id="sip-thead"></thead><tbody id="sip-tbody"></tbody></table></div></div>
      <div class="pms-card section-gap"><div class="pms-card-header"><span class="pms-card-title">Allocation Breakdown</span></div><div class="pms-card-body" id="sip-allocation"></div></div>
    `;
    container.querySelector('.view-enter').appendChild(root);
    bindSipEvents(root);
  }

  function bindSipEvents(root) {
    const state = sipReadState();
    let activeSip = state.activeSip && (state.activeSip === 'ALL_SIP' || state.sips.includes(state.activeSip)) ? state.activeSip : 'ALL_SIP';
    let historySip = 'ALL';
    const tabs = root.querySelector('#sipTabs');
    const navForm = root.querySelector('#sip-nav-form');
    const addForm = root.querySelector('#sip-installment-form');
    const manualForm = root.querySelector('#sip-manual-form');
    const history = root.querySelector('#sip-history');

    const rerender = () => {
      const st = sipReadState();
      tabs.innerHTML = '';
      [['ALL_SIP', 'All SIP'], ...st.sips.map(s => [s, s])].forEach(([v, l]) => {
        const b = document.createElement('button');
        b.type = 'button'; b.className = `pms-tab ${activeSip === v ? 'active' : ''}`; b.textContent = l;
        b.onclick = () => { activeSip = v; st.activeSip = v; PmsState.persistSip(st); rerender(); };
        tabs.appendChild(b);
      });
      [navForm, addForm].forEach(form => {
        const select = form.elements.sipName;
        select.innerHTML = st.sips.map(s => `<option value="${s}">${s}</option>`).join('');
        select.value = activeSip === 'ALL_SIP' ? (st.sips[0] || '') : activeSip;
      });
      history.innerHTML = `<option value="ALL">All SIPs</option>${st.sips.map(s => `<option value="${s}">${s}</option>`).join('')}`;
      history.value = historySip;
      renderSipStats(root, st, activeSip);
      renderSipHistory(root, st, historySip);
      renderSipAllocation(root, st);
    };

    manualForm.onsubmit = (e) => {
      e.preventDefault();
      const st = sipReadState();
      const name = String(manualForm.elements.newSipName.value || '').trim().toUpperCase();
      if (!name || st.sips.includes(name)) return;
      st.sips.push(name); st.records[name] = []; st.currentNav[name] = 0; st.registeredAt[name] = new Date().toISOString().slice(0,10); activeSip = name;
      PmsState.persistSip(st); manualForm.reset(); rerender();
    };
    root.querySelector('#sip-del-btn').onclick = () => {
      const st = sipReadState();
      if (!activeSip || activeSip === 'ALL_SIP' || ['SSIS','KSLY'].includes(activeSip)) return;
      const refund = (st.records[activeSip] || []).reduce((s, r) => s + Number(r.amount || 0), 0);
      if (refund) PmsCapital.adjustCash(refund);
      st.sips = st.sips.filter(s => s !== activeSip); delete st.records[activeSip]; delete st.currentNav[activeSip]; delete st.registeredAt[activeSip];
      activeSip = 'ALL_SIP'; historySip = 'ALL'; PmsState.persistSip(st); rerender();
    };
    navForm.onsubmit = (e) => {
      e.preventDefault();
      const st = sipReadState(); const nav = Number(navForm.elements.nav.value); const sip = navForm.elements.sipName.value;
      if (!Number.isFinite(nav) || nav <= 0) return;
      st.currentNav[sip] = nav; PmsState.persistSip(st); rerender();
    };
    addForm.onsubmit = (e) => {
      e.preventDefault();
      const st = sipReadState();
      const sip = addForm.elements.sipName.value;
      const date = String(addForm.elements.date.value || '');
      const units = Math.floor(Number(addForm.elements.units.value));
      const nav = Number(addForm.elements.nav.value);
      if (!sip || !/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(units) || units <= 0 || !Number.isFinite(nav) || nav <= 0) return;
      st.records[sip] = st.records[sip] || [];
      if (st.records[sip].some(r => String(r.date).slice(0,7) === date.slice(0,7))) return;
      const amount = units * nav;
      st.records[sip].push({ id: crypto.randomUUID(), date, units, nav, amount });
      st.records[sip].sort((a,b) => a.date.localeCompare(b.date));
      st.currentNav[sip] = nav; activeSip = sip; PmsCapital.adjustCash(-amount); PmsState.persistSip(st); addForm.reset(); rerender();
    };
    history.onchange = () => { historySip = history.value; rerender(); };
    rerender();
  }

  function renderSipStats(root, state, activeSip) {
    const names = activeSip === 'ALL_SIP' ? state.sips : [activeSip];
    const totalUnits = names.reduce((sum, sip) => sum + (state.records[sip] || []).reduce((s, row) => s + Number(row.units || 0), 0), 0);
    const totalValue = names.reduce((sum, sip) => {
      const units = (state.records[sip] || []).reduce((s, r) => s + Number(r.units || 0), 0);
      const nav = Number(state.currentNav[sip] || (state.records[sip] || []).slice(-1)[0]?.nav || 0);
      return sum + units * nav;
    }, 0);
    root.querySelector('#sipTotalUnits').textContent = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(totalUnits);
    root.querySelector('#sipTotalValue').textContent = PmsUI.currency(totalValue);
    const navEl = root.querySelector('#sipCurrentNav');
    navEl.textContent = activeSip === 'ALL_SIP' ? '—' : PmsUI.currency(state.currentNav[activeSip] || 0);
  }

  function renderSipHistory(root, state, historySip) {
    const thead = root.querySelector('#sip-thead');
    const tbody = root.querySelector('#sip-tbody');
    if (historySip === 'ALL') {
      thead.innerHTML = '<tr><th>SIP</th><th>Units</th><th>Avg</th><th>Invested Amt</th><th>Total Current Value</th></tr>';
      const rows = state.sips.map((sip) => {
        const units = (state.records[sip] || []).reduce((s, r) => s + Number(r.units || 0), 0);
        const amount = (state.records[sip] || []).reduce((s, r) => s + Number(r.amount || 0), 0);
        const nav = Number(state.currentNav[sip] || 0);
        return { sip, units, amount, value: units * nav, avg: units ? amount / units : 0 };
      }).filter(r => r.units > 0);
      tbody.innerHTML = rows.length ? rows.map(r => `<tr><td>${r.sip}</td><td>${r.units}</td><td>${PmsUI.fmt2(r.avg)}</td><td>${PmsUI.currency(r.amount)}</td><td>${PmsUI.currency(r.value)}</td></tr>`).join('') : '<tr><td colspan="5" style="padding:18px;">No SIP history found for this selection.</td></tr>';
      return;
    }
    thead.innerHTML = '<tr><th>Date</th><th>SIP</th><th>Units</th><th>Avg</th><th>Invested Amt</th><th>Total Current Value</th><th>Actions</th></tr>';
    const rows = (state.records[historySip] || []).map(r => ({ ...r, sip: historySip, currentValue: Number(r.units || 0) * Number(state.currentNav[historySip] || r.nav || 0) }));
    tbody.innerHTML = rows.length ? rows.map(r => `<tr><td>${r.date}</td><td>${r.sip}</td><td>${r.units}</td><td>${PmsUI.fmt2(r.nav)}</td><td>${PmsUI.currency(r.amount)}</td><td>${PmsUI.currency(r.currentValue)}</td><td><button class="pms-btn pms-btn-icon pms-btn-danger" data-sip-del="${r.id}">✕</button></td></tr>`).join('') : '<tr><td colspan="7" style="padding:18px;">No SIP history found for this selection.</td></tr>';
    tbody.querySelectorAll('[data-sip-del]').forEach((btn) => btn.onclick = () => {
      const st = sipReadState();
      const removed = (st.records[historySip] || []).find((row) => row.id === btn.dataset.sipDel);
      st.records[historySip] = (st.records[historySip] || []).filter((row) => row.id !== btn.dataset.sipDel);
      if (removed) PmsCapital.adjustCash(Number(removed.amount || 0));
      if (!st.records[historySip].length) st.currentNav[historySip] = 0;
      PmsState.persistSip(st);
      renderSipHistory(root, st, historySip);
      renderSipStats(root, st, historySip);
      renderSipAllocation(root, st);
    });
  }

  function renderSipAllocation(root, state) {
    const host = root.querySelector('#sip-allocation');
    const total = state.sips.reduce((s, sip) => {
      const units = (state.records[sip] || []).reduce((a, r) => a + Number(r.units || 0), 0);
      return s + (units * Number(state.currentNav[sip] || 0));
    }, 0);
    host.innerHTML = state.sips.map((sip) => {
      const units = (state.records[sip] || []).reduce((a, r) => a + Number(r.units || 0), 0);
      const value = units * Number(state.currentNav[sip] || 0);
      const pct = total > 0 ? (value / total) * 100 : 0;
      return `<div style="margin-bottom:10px;"><div style="display:flex;justify-content:space-between;"><span>${sip}</span><span>${PmsUI.currency(value)} (${pct.toFixed(1)}%)</span></div><div class="alloc-bar-track"><div class="alloc-bar-fill" style="width:${pct.toFixed(1)}%;"></div></div></div>`;
    }).join('') || '<span class="val-muted">No SIP allocation data yet.</span>';
  }

  function sipReadState() {
    const forced = { SSIS: '2025-07-15', KSLY: '2026-02-15' };
    const input = PmsState.readSip();
    const sips = Array.from(new Set([...(input.sips || []), 'SSIS', 'KSLY']));
    const records = {};
    const currentNav = { ...(input.currentNav || {}) };
    const registeredAt = { ...(input.registeredAt || {}) };
    sips.forEach((sip) => {
      records[sip] = Array.isArray((input.records || {})[sip]) ? input.records[sip].map(r => ({
        id: r.id || crypto.randomUUID(),
        date: String(r.date || forced[sip] || new Date().toISOString().slice(0,10)),
        units: Math.floor(Number(r.units || 0)),
        nav: Number(r.nav || 0),
        amount: Number(r.amount || (Number(r.units || 0) * Number(r.nav || 0))),
      })) : [];
      records[sip].sort((a,b) => a.date.localeCompare(b.date));
      if (!registeredAt[sip]) registeredAt[sip] = forced[sip] || records[sip][0]?.date || new Date().toISOString().slice(0,10);
      if (!Number.isFinite(currentNav[sip])) currentNav[sip] = records[sip].slice(-1)[0]?.nav || 0;
    });
    return { sips, records, currentNav, registeredAt, activeSip: input.activeSip || 'ALL_SIP' };
  }

  // ── Helpers ───────────────────────────────────────────────
  function getRows(key) {
    try {
      const raw = JSON.parse(localStorage.getItem(key) || '[]');
      return raw.map(r => ({
        id:     r.id || crypto.randomUUID(),
        script: String(r.script || '').trim().toUpperCase(),
        ltp:    Number(r.ltp)  || 0,
        qty:    Number(r.qty)  || 0,
        wacc:   Number(r.wacc) || 0,
        sell1:  Number(r.sell1) || 0,
        sell2:  Number(r.sell2) || ((Number(r.sell1) || 0) * 1.1),
      }));
    } catch { return []; }
  }
  function saveRows(key, rows) { localStorage.setItem(key, JSON.stringify(rows)); }
  function persist(key) {
    flashSave();
    PmsCapital.updateWidgets();
    window.dispatchEvent(new CustomEvent('pms-portfolio-updated'));
  }

  function persistRow(key, updatedRow) {
    const rows = getRows(key);
    const idx = rows.findIndex(r => r.id === updatedRow.id);
    if (idx < 0) return;
    rows[idx] = { ...rows[idx], ...updatedRow };
    saveRows(key, rows);
    persist(key);
  }
  function flashSave() {
    const ind = document.getElementById('port-save-ind');
    if (!ind) return;
    ind.textContent = 'Saved ✓';
    ind.classList.add('show');
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => ind.classList.remove('show'), 1800);
  }
  function investedCost(wacc, qty) { return Number(wacc || 0) * Number(qty || 0); }
  function makeBtn(label, cls, onclick) {
    const b = document.createElement('button');
    b.className = `pms-btn ${cls}`;
    b.textContent = label;
    b.onclick = onclick;
    return b;
  }
  function makeSorter() {
    return (a, b) => {
      let av, bv;
      switch (sortKey) {
        case 'script':   av = a.script.toLowerCase(); bv = b.script.toLowerCase(); break;
        case 'qty':      av = a.qty;   bv = b.qty;   break;
        case 'ltp':      av = a.ltp;   bv = b.ltp;   break;
        case 'wacc':     av = a.wacc;  bv = b.wacc;  break;
        case 'sell1':    av = a.sell1; bv = b.sell1; break;
        case 'invested': av = a.wacc * a.qty; bv = b.wacc * b.qty; break;
        case 'current':  av = a.ltp  * a.qty; bv = b.ltp  * b.qty; break;
        case 'pl':       av = (a.ltp - a.wacc) * a.qty; bv = (b.ltp - b.wacc) * b.qty; break;
        case 'plpct':    av = a.wacc > 0 ? (a.ltp - a.wacc) / a.wacc : 0;
                         bv = b.wacc > 0 ? (b.ltp - b.wacc) / b.wacc : 0; break;
        default:         av = a.script.toLowerCase(); bv = b.script.toLowerCase();
      }
      if (typeof av === 'string') return av.localeCompare(bv) * sortDir;
      return (av - bv) * sortDir;
    };
  }

  return { render };
})();
