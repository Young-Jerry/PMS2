/**
 * Cashflow Tracker View
 * Cash balance, ledger entries, profit cashout management.
 * All financial logic preserved from original capital-manager.js / cash_ledger.js
 */
const CashflowView = (() => {
  function render(container) {
    container.innerHTML = `
      <div class="view-enter">
        <div class="view-header">
          <div>
            <div class="view-title">Cashflow</div>
            <div class="view-subtitle">Cash balance, deposits, withdrawals &amp; profit tracking</div>
          </div>
        </div>

        <!-- Balance KPIs -->
        <div class="stat-grid" id="cashflow-kpis"></div>

        <div class="grid-2 section-gap cashflow-form-grid">
          <!-- Add Transaction Form -->
          <div class="pms-card cashflow-form-card">
            <div class="pms-card-header"><span class="pms-card-title">Add Transaction</span></div>
            <div class="pms-card-body">
              <form id="cashflow-add-form" autocomplete="off">
                <div class="cashflow-form-stack">
                  <div class="pms-field">
                    <label class="pms-label">Type</label>
                    <select class="pms-select" name="type">
                      <option value="credit">Cash In (Deposit)</option>
                      <option value="debit">Cash Out (Withdrawal)</option>
                    </select>
                  </div>
                  <div class="pms-field">
                    <label class="pms-label">Amount (Rs)</label>
                    <input class="pms-input" name="amount" type="number" min="1" step="1" placeholder="50000" required>
                  </div>
                  <div class="pms-field">
                    <label class="pms-label">Note</label>
                    <input class="pms-input" name="note" type="text" placeholder="e.g. Monthly investment">
                  </div>
                  <button class="pms-btn pms-btn-primary" type="submit">Add Entry</button>
                </div>
              </form>
            </div>
          </div>

          <!-- Profit Cashout Form -->
          <div class="pms-card cashflow-form-card">
            <div class="pms-card-header"><span class="pms-card-title">Cash Out Profit</span></div>
            <div class="pms-card-body">
              <form id="cashflow-profit-form" autocomplete="off">
                <div class="cashflow-form-stack">
                  <div style="padding:10px;background:var(--amber-dim);border-radius:var(--r-md);font-size:12px;color:var(--amber);">
                    ℹ A Rs 8 processing fee applies per cashout operation.
                  </div>
                  <div class="pms-field">
                    <label class="pms-label">Profit Amount (Rs)</label>
                    <input class="pms-input" name="amount" type="number" min="9" step="1" placeholder="10000" required>
                  </div>
                  <div class="pms-field">
                    <label class="pms-label">Note</label>
                    <input class="pms-input" name="note" type="text" value="Profit Cashed Out" placeholder="Profit Cashed Out">
                  </div>
                  <button class="pms-btn pms-btn-success" type="submit">Cash Out Profit</button>
                </div>
              </form>
            </div>
          </div>
        </div>

        <!-- Ledger Table -->
        <div class="table-section section-gap">
          <div class="pms-card-header" style="background:var(--bg-elevated);">
            <span class="pms-card-title">Transaction Ledger</span>
            <button class="pms-btn pms-btn-danger" id="cashflow-clear-btn" style="font-size:11px;padding:5px 10px;">Clear History</button>
          </div>
          <div class="pms-table-wrap">
            <table class="pms-table">
              <thead><tr>
                <th>Date &amp; Time</th>
                <th>Category</th>
                <th>Type</th>
                <th>Note</th>
                <th>Amount</th>
                <th>Actions</th>
              </tr></thead>
              <tbody id="cashflow-tbody"></tbody>
            </table>
          </div>
        </div>
      </div>
    `;

    bindEvents(container);
    refreshView(container);
  }

  function bindEvents(container) {
    container.querySelector('#cashflow-add-form').onsubmit = (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      const type   = String(fd.get('type'));
      const amount = Math.round(Number(fd.get('amount')));
      const note   = String(fd.get('note') || '').trim();
      if (!Number.isFinite(amount) || amount <= 0) { PmsUI.toast('Enter valid amount', 'error'); return; }
      const delta = type === 'credit' ? amount : -amount;
      PmsCapital.adjustCash(delta, { note, kind: 'manual', type, entryCategory: 'transaction', editable: true });
      e.target.reset();
      PmsUI.toast(`Entry added ✓`, 'success');
      refreshView(container);
    };

    container.querySelector('#cashflow-profit-form').onsubmit = (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      const amount = Math.round(Number(fd.get('amount')));
      const note   = String(fd.get('note') || '').trim();
      if (!Number.isFinite(amount) || amount <= 9) { PmsUI.toast('Minimum Rs 9 (covers Rs 8 fee)', 'error'); return; }
      PmsCapital.addProfitCashEntry('out', amount, note);
      e.target.reset();
      e.target.querySelector('input[name="note"]').value = 'Profit Cashed Out';
      PmsUI.toast(`Profit cashed out ✓`, 'success');
      refreshView(container);
    };

    container.querySelector('#cashflow-clear-btn').onclick = () => {
      PmsUI.confirm({
        title: 'Clear Ledger History',
        message: 'Remove all ledger history? Current cash balance will be preserved.',
        confirmText: 'Clear History',
        danger: true,
        onConfirm: () => {
          PmsCapital.clearLedgerHistory();
          PmsUI.toast('Ledger cleared', 'info');
          refreshView(container);
        },
      });
    };
  }

  function refreshView(container) {
    renderKPIs(container);
    renderLedger(container);
  }

  function renderKPIs(container) {
    const cash         = PmsCapital.readCash();
    const invested     = PmsCapital.investedCapital();
    const profitOut    = PmsCapital.readProfitCashedOut();
    const ledger       = PmsCapital.readLedger();
    const totalIn      = ledger.filter(r => Number(r.delta) > 0 && r.entryCategory !== 'profit').reduce((s,r) => s + Number(r.delta), 0);
    const totalOut     = ledger.filter(r => Number(r.delta) < 0 && r.entryCategory !== 'profit' && r.entryCategory !== 'profit_fee').reduce((s,r) => s + Math.abs(Number(r.delta)), 0);

    const el = container.querySelector('#cashflow-kpis');
    el.innerHTML = [
      { l: 'Cash Balance',      v: PmsUI.currencyRound(cash),        c: '' },
      { l: 'Invested Capital',  v: PmsUI.currencyRound(invested),    c: '' },
      { l: 'Total Cash In',     v: PmsUI.currencyRound(totalIn),     c: 'profit-card' },
      { l: 'Total Cash Out',    v: PmsUI.currencyRound(totalOut),    c: '' },
      { l: 'Profit Cashed Out', v: PmsUI.currencyRound(profitOut),   c: 'amber-card' },
      { l: 'Net Position',      v: PmsUI.currencyRound(cash + invested), c: '' },
    ].map(k => `
      <div class="stat-card ${k.c}">
        <div class="stat-label">${k.l}</div>
        <div class="stat-value">${k.v}</div>
      </div>
    `).join('');
  }

  function renderLedger(container) {
    const ledger = PmsCapital.readLedger()
      .slice()
      .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
    const tbody = container.querySelector('#cashflow-tbody');
    tbody.innerHTML = '';

    if (!ledger.length) {
      tbody.innerHTML = `<tr><td colspan="6" style="padding:32px;text-align:center;color:var(--text-muted);">No transactions yet.</td></tr>`;
      return;
    }

    ledger.forEach(entry => {
      const isCredit  = Number(entry.delta) >= 0;
      const isProfit  = entry.entryCategory === 'profit';
      const isFee     = entry.entryCategory === 'profit_fee';
      const typeLabel = isProfit ? 'Profit Out' : isFee ? 'Profit Fee' : (isCredit ? 'Cash In' : 'Cash Out');
      const catLabel  = isProfit || isFee ? 'Profit Entry' : (entry.kind === 'system' ? 'System' : 'Transaction');
      const dateStr   = entry.createdAt ? new Date(entry.createdAt).toLocaleString('en-IN', { dateStyle:'short', timeStyle:'short' }) : '—';

      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td style="color:var(--text-secondary);font-size:11px;">${dateStr}</td>
        <td><span class="badge ${isProfit||isFee ? 'badge-amber' : 'badge-blue'}">${catLabel}</span></td>
        <td style="color:${isCredit ? 'var(--profit)' : 'var(--loss)'};">${typeLabel}</td>
        <td style="color:var(--text-secondary);max-width:200px;overflow:hidden;text-overflow:ellipsis;">${PmsUI.esc(entry.note || '')}</td>
        <td class="${isCredit ? 'val-profit' : 'val-loss'}" style="font-weight:600;">${money(entry.delta)}</td>
        <td class="actions-cell">
          <button class="pms-btn pms-btn-icon" data-edit="${entry.id}">✎</button>
          <button class="pms-btn pms-btn-icon pms-btn-danger" data-del="${entry.id}">✕</button>
        </td>
      `;
      tbody.appendChild(tr);
    });

    tbody.querySelectorAll('[data-edit]').forEach(btn => btn.onclick = () => editEntry(btn.dataset.edit, container));
    tbody.querySelectorAll('[data-del]').forEach(btn => btn.onclick = () => {
      PmsCapital.deleteLedgerEntry(btn.dataset.del);
      PmsUI.toast('Entry deleted', 'info');
      refreshView(container);
    });
  }

  function editEntry(id, container) {
    const ledger = PmsCapital.readLedger();
    const entry  = ledger.find(r => r.id === id);
    if (!entry) return;
    const { card, close } = PmsUI.modal({
      title: 'Edit Ledger Entry',
      body: `
        <div style="display:flex;flex-direction:column;gap:12px;">
          <div class="pms-field">
            <label class="pms-label">Amount (Rs)</label>
            <input class="pms-input" data-f="amount" type="number" min="1" value="${Math.abs(Number(entry.baseAmount || entry.delta))}">
          </div>
          <div class="pms-field">
            <label class="pms-label">Note</label>
            <input class="pms-input" data-f="note" type="text" value="${PmsUI.esc(entry.note || '')}">
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
      const amount = Math.round(Number(card.querySelector('[data-f="amount"]').value));
      const note   = card.querySelector('[data-f="note"]').value.trim();
      if (!Number.isFinite(amount) || amount <= 0) return;
      let nextDelta = amount;
      if (entry.entryCategory === 'profit') {
        nextDelta = PmsCapital.computeProfitDelta('out', amount);
      } else {
        nextDelta = entry.delta >= 0 ? amount : -amount;
      }
      PmsCapital.updateLedgerEntry(id, { delta: nextDelta, baseAmount: amount, note, editable: true, type: entry.type });
      PmsUI.toast('Entry updated ✓', 'success');
      close();
      refreshView(container);
    };
  }

  function money(value) {
    const n = Number(value || 0);
    const abs = Math.abs(Math.round(n));
    const sign = n >= 0 ? '+' : '-';
    return `${sign} Rs ${new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(abs)}`;
  }

  return { render };
})();
