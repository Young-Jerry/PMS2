/**
 * PMS Capital Manager
 * FINANCIAL LOGIC - PRESERVED from original implementation.
 * Cash ledger, balance tracking, profit cashout - all calculations identical.
 */
(() => {
  const CASH_KEY    = 'cashBalanceV1';
  const LEDGER_KEY  = 'cashLedgerV1';
  const PROFIT_OUT_FEE = 8;

  function normalizeMoney(value) {
    const n = Number(value || 0);
    if (!Number.isFinite(n)) return 0;
    const rounded = Math.round(n);
    return Math.abs(rounded) < 1e-9 ? 0 : rounded;
  }

  function readCash() {
    const value = Number(localStorage.getItem(CASH_KEY) || 0);
    return normalizeMoney(value);
  }

  function readLedger() {
    try {
      const rows = JSON.parse(localStorage.getItem(LEDGER_KEY) || '[]');
      return Array.isArray(rows) ? rows : [];
    } catch { return []; }
  }

  function saveLedger(rows) {
    localStorage.setItem(LEDGER_KEY, JSON.stringify(rows));
  }

  function setCash(value) {
    const safe = normalizeMoney(value);
    localStorage.setItem(CASH_KEY, String(safe));
    updateWidgets();
    window.dispatchEvent(new CustomEvent('pms-cash-updated', { detail: { cash: readCash() } }));
  }

  function adjustCash(delta, meta = {}) {
    const change = Math.round(Number(delta || 0));
    if (!Number.isFinite(change) || change === 0) return readCash();
    const current = readCash();
    const next    = normalizeMoney(current + change);
    if (next < 0) { showCashAlert('Not enough cash balance.'); return current; }
    setCash(next);
    const ledger = readLedger();
    ledger.push({
      id:            crypto.randomUUID(),
      createdAt:     new Date().toISOString(),
      delta:         change,
      note:          String(meta.note || ''),
      type:          String(meta.type || (change >= 0 ? 'credit' : 'debit')),
      kind:          String(meta.kind || 'system'),
      entryCategory: String(meta.entryCategory || 'transaction'),
      baseAmount:    Math.round(Number(meta.baseAmount || Math.abs(change))),
      charges:       Number(meta.charges || 0),
      editable:      Boolean(meta.editable),
    });
    saveLedger(ledger);
    return next;
  }

  function updateLedgerEntry(id, patch = {}) {
    const ledger = readLedger();
    const index  = ledger.findIndex((row) => row.id === id);
    if (index < 0) return;
    const current      = ledger[index];
    const oldDelta     = Math.round(Number(current.delta || 0));
    const nextDelta    = Math.round(Number(patch.delta));
    const safeNextDelta = Number.isFinite(nextDelta) ? nextDelta : oldDelta;
    ledger[index] = { ...current, ...patch, delta: safeNextDelta, updatedAt: new Date().toISOString() };
    const nextCash = normalizeMoney(readCash() - oldDelta + safeNextDelta);
    if (nextCash < 0) { showCashAlert('Not enough cash balance.'); return; }
    saveLedger(ledger);
    setCash(nextCash);
  }

  function deleteLedgerEntry(id) {
    const ledger  = readLedger();
    const index   = ledger.findIndex((row) => row.id === id);
    if (index < 0) return;
    const [removed] = ledger.splice(index, 1);
    const nextCash = normalizeMoney(readCash() - Math.round(Number(removed.delta || 0)));
    if (nextCash < 0) { showCashAlert('Not enough cash balance.'); return; }
    saveLedger(ledger);
    setCash(nextCash);
  }

  function clearLedgerHistory() {
    saveLedger([]);
    window.dispatchEvent(new CustomEvent('pms-cash-updated', { detail: { cash: readCash() } }));
  }

  function investedCapital() {
    const trades   = readJson('trades');
    const longterm = readJson('longterm');
    const sip      = JSON.parse(localStorage.getItem('sipStateV4') || '{}');
    const sipInvested = Object.values(sip.records || {})
      .flat()
      .reduce((sum, row) => sum + Number(row.amount || (Number(row.units || 0) * Number(row.nav || 0))), 0);
    const tradeInvested = trades.reduce((sum, row) => sum + (Number(row.wacc || 0) * Number(row.qty || 0)), 0);
    const longInvested  = longterm.reduce((sum, row) => sum + (Number(row.wacc || 0) * Number(row.qty || 0)), 0);
    return tradeInvested + longInvested + sipInvested;
  }

  function computeProfitDelta(direction, amount) {
    const baseAmount = Math.round(Number(amount || 0));
    if (!Number.isFinite(baseAmount) || baseAmount <= 0) return 0;
    return direction === 'out' ? -baseAmount : 0;
  }

  function addProfitCashEntry(direction, amount, note = '') {
    const baseAmount = Math.round(Number(amount || 0));
    if (!Number.isFinite(baseAmount) || baseAmount <= 0) return readCash();
    const feeAmount    = Math.min(PROFIT_OUT_FEE, baseAmount);
    const payoutAmount = Math.max(0, baseAmount - feeAmount);
    const mainNote     = String(note || '').trim() || 'Profit Cashed Out';
    const afterPayout  = adjustCash(computeProfitDelta('out', payoutAmount), {
      note: `${mainNote} · Net ${payoutAmount}`,
      type: 'profit_out', kind: 'manual', entryCategory: 'profit',
      baseAmount: payoutAmount, charges: 0, editable: true,
    });
    if (feeAmount > 0) {
      adjustCash(-feeAmount, {
        note: `${mainNote} · Fee ${feeAmount}`,
        type: 'profit_fee', kind: 'manual', entryCategory: 'profit_fee',
        baseAmount: feeAmount, charges: 0, editable: true,
      });
    }
    return afterPayout;
  }

  function readProfitCashedOut() {
    return readLedger().reduce((sum, row) => {
      if (row.entryCategory !== 'profit') return sum;
      const amount = Number(row.baseAmount || Math.abs(Number(row.delta || 0)));
      return row.type === 'profit_out' ? sum + amount : sum;
    }, 0);
  }

  function updateWidgets() {
    const cash = readCash();
    // Update all cash display nodes in the SPA
    document.querySelectorAll('[data-cash-display]').forEach((el) => {
      el.textContent = money(cash);
    });
    document.querySelectorAll('[data-invested-display]').forEach((el) => {
      el.textContent = money(investedCapital());
    });
  }

  function showCashAlert(message) {
    const text = String(message || 'Not enough cash balance.');
    const existing = document.querySelector('.pms-cash-alert');
    if (existing) existing.remove();
    const modal = document.createElement('div');
    modal.className = 'pms-modal-backdrop pms-cash-alert';
    modal.innerHTML = `
      <div class="pms-modal-card">
        <div class="pms-modal-header">
          <span class="pms-modal-title">⚠ Cash Balance Alert</span>
        </div>
        <p class="pms-modal-body">${escHtml(text)}</p>
        <div class="pms-modal-footer">
          <button class="pms-btn pms-btn-primary" data-close="true">Understood</button>
        </div>
      </div>
    `;
    modal.querySelector('[data-close]').onclick = () => modal.remove();
    modal.onclick = (e) => { if (e.target === modal) modal.remove(); };
    document.body.appendChild(modal);
  }

  function readJson(key) {
    try { return JSON.parse(localStorage.getItem(key) || '[]'); } catch { return []; }
  }

  function money(value) {
    return `Rs ${new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(Math.round(Number(value || 0)))}`;
  }

  function escHtml(v) {
    return String(v || '').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#39;');
  }

  window.PmsCapital = {
    CASH_KEY, LEDGER_KEY,
    readCash, setCash, adjustCash,
    readLedger, updateLedgerEntry, deleteLedgerEntry, clearLedgerHistory,
    investedCapital, addProfitCashEntry, computeProfitDelta, readProfitCashedOut,
    updateWidgets, showCashAlert,
  };
})();
