const SettingsView = (() => {
  function render(container) {
    const compact = localStorage.getItem('prefDenseMode') === '1';
    const anim = localStorage.getItem('prefAnimations') !== '0';
    container.innerHTML = `<div class="view-enter"><div class="view-header"><div><div class="view-title">Settings</div><div class="view-subtitle">Terminal preferences only (data tools moved to Data Center)</div></div></div>
      <div class="grid-2">
        ${TerminalUI.card('Display Preferences', `<label class="pms-toggle"><input type="checkbox" id="set-dense" ${compact?'checked':''}> Dense mode</label><label class="pms-toggle"><input type="checkbox" id="set-anim" ${anim?'checked':''}> Animations</label>`)}
        ${TerminalUI.card('Workspace', `<button class="pms-btn pms-btn-ghost" id="set-reset-layout">Reset UI Layout</button><div style="margin-top:8px;font-size:12px;color:var(--text-muted);">Theme is fixed: dark quant terminal.</div>`)}
      </div>
    </div>`;
    container.querySelector('#set-dense').onchange = (e) => { localStorage.setItem('prefDenseMode', e.target.checked ? '1':'0'); document.body.classList.toggle('dense-mode', e.target.checked); };
    container.querySelector('#set-anim').onchange = (e) => { localStorage.setItem('prefAnimations', e.target.checked ? '1':'0'); document.body.classList.toggle('reduced-motion', !e.target.checked); };
    container.querySelector('#set-reset-layout').onclick = () => { localStorage.removeItem('prefDenseMode'); localStorage.removeItem('prefAnimations'); location.reload(); };
  }
  return { render };
})();
