/**
 * Finance Calculator View
 * Dedicated large trade calculator panel.
 */
const CalculatorView = (() => {
  function render(container) {
    container.innerHTML = `
      <div class="view-enter">
        <div class="view-header">
          <div>
            <div class="view-title">Trade Calculator</div>
            <div class="view-subtitle">Estimate buy/sell costs, fees and net receivable before placing trades</div>
          </div>
        </div>

        <div class="pms-card">
          <div class="pms-card-header"><span class="pms-card-title">NEPSE Trade Estimator</span></div>
          <div class="pms-card-body" style="padding:22px;">
            <div class="pms-form-grid" style="grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:16px;">
              <div class="pms-field">
                <label class="pms-label">Trade Side</label>
                <select class="pms-select" id="calc-side">
                  <option value="buy">Buy</option>
                  <option value="sell">Sell</option>
                </select>
              </div>
              <div class="pms-field">
                <label class="pms-label">Unit Price (Rs)</label>
                <input class="pms-input" id="calc-price" type="number" min="0.01" step="0.01" placeholder="1050.00">
              </div>
              <div class="pms-field">
                <label class="pms-label">Quantity</label>
                <input class="pms-input" id="calc-qty" type="number" min="1" step="1" placeholder="100">
              </div>
              <div class="pms-field">
                <label class="pms-label">Buy as WACC?</label>
                <select class="pms-select" id="calc-wacc">
                  <option value="yes">Yes (no fees on buy)</option>
                  <option value="no">No (add broker fees)</option>
                </select>
              </div>
            </div>
            <div id="calc-result" style="margin-top:18px;display:none;"></div>
          </div>
        </div>
      </div>
    `;

    ['#calc-side','#calc-price','#calc-qty','#calc-wacc'].forEach(sel => {
      container.querySelector(sel)?.addEventListener('input', () => runCalc(container));
    });
  }

  function runCalc(container) {
    const side  = container.querySelector('#calc-side').value;
    const price = PmsUI.num(container.querySelector('#calc-price').value);
    const qty   = Math.floor(PmsUI.num(container.querySelector('#calc-qty').value));
    const wacc  = container.querySelector('#calc-wacc').value === 'yes';
    const result = container.querySelector('#calc-result');

    if (!Number.isFinite(price) || price <= 0 || !Number.isFinite(qty) || qty <= 0) {
      result.style.display = 'none'; return;
    }

    const tx = PmsTradeMath.calculateTransaction(side, price, qty, { buyIsWacc: wacc });
    result.style.display = '';
    result.innerHTML = `
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:14px;padding:18px;background:var(--bg-elevated);border-radius:var(--r-md);">
        <div><div class="stat-label">Total Amount</div><div style="font-family:var(--font-mono);font-size:17px;">${PmsUI.currency(tx.totalAmount)}</div></div>
        ${!wacc || side === 'sell' ? `
          <div><div class="stat-label">Broker Commission</div><div style="font-family:var(--font-mono);font-size:17px;">${PmsUI.currency(tx.commission)}</div></div>
          <div><div class="stat-label">SEBON Fee</div><div style="font-family:var(--font-mono);font-size:17px;">${PmsUI.currency(tx.sebonFee)}</div></div>
          <div><div class="stat-label">DP Charge</div><div style="font-family:var(--font-mono);font-size:17px;">Rs ${tx.dpCharge}</div></div>
        ` : ''}
        <div><div class="stat-label">${side === 'sell' ? 'You Receive' : 'Total Payable'}</div><div style="font-family:var(--font-mono);font-size:19px;font-weight:700;">${PmsUI.currency(tx.totalPayable)}</div></div>
        <div><div class="stat-label">Cost Per Share</div><div style="font-family:var(--font-mono);font-size:17px;">${PmsUI.currency(tx.costPerShare)}</div></div>
      </div>
    `;
  }

  return { render };
})();
