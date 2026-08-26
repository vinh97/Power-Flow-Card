class PowerFlowCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  setConfig(config) {
    if (!config || !config.entities) {
      throw new Error("Vui lòng cấu hình danh sách entities!");
    }
    this.config = config;
    this.render();
  }

  connectedCallback() {}
  disconnectedCallback() {}

  set hass(hass) {
    this._hass = hass;
    this.updateData();
  }

  // Kiểm tra sensor có hợp lệ không
  hasEntity(entityId) {
    if (!entityId || !this._hass || !this._hass.states[entityId]) return false;
    const st = this._hass.states[entityId].state;
    return st !== undefined && st !== 'unavailable' && st !== 'unknown';
  }

  // Lấy giá trị sensor (trả về null nếu ko có sensor)
  getState(entityId) {
    if (!this.hasEntity(entityId)) return null;
    const val = parseFloat(this._hass.states[entityId].state);
    return isNaN(val) ? null : val;
  }

  setFlowVisible(id, visible) {
    const el = this.shadowRoot.getElementById(id);
    if (el) el.style.display = visible ? 'inline' : 'none';
  }

  setText(id, text) {
    const el = this.shadowRoot.getElementById(id);
    if (el) el.textContent = text;
  }

  // Hàm tự động ẨN dòng nếu giá trị = 0, null, hoặc ko có sensor
  updateMetric(groupId, textId, val, formattedVal) {
    const groupEl = this.shadowRoot.getElementById(groupId);
    if (!groupEl) return;

    if (val === null || val === undefined || Math.abs(val) === 0) {
      groupEl.style.display = 'none';
    } else {
      groupEl.style.display = 'inline';
      if (textId) {
        this.setText(textId, formattedVal !== undefined ? formattedVal : val);
      }
    }
  }

  updateData() {
    if (!this._hass || !this.config) return;

    const ent = this.config.entities;
    const isTrue = (val) => val === true || String(val).toLowerCase() === 'true';

    // 1. Đồng hồ LCD Inverter
    const mainEntityId = ent.load_power || ent.grid_power || ent.pv1_power;
    if (this.hasEntity(mainEntityId)) {
      const lastUpdatedStr = this._hass.states[mainEntityId].last_updated;
      const updatedDate = new Date(lastUpdatedStr);
      const timeFormatted = [
        updatedDate.getHours(),
        updatedDate.getMinutes(),
        updatedDate.getSeconds()
      ].map(n => String(n).padStart(2, '0')).join(':');

      this.setText('inv-lcd-time', timeFormatted);
    }

    // 2. PV1 & PV2
    const rawPv1P = this.getState(ent.pv1_power);
    const pv1P = rawPv1P !== null ? Math.abs(Math.round(rawPv1P)) : null;
    const pv1V = this.getState(ent.pv1_voltage);

    const rawPv2P = this.getState(ent.pv2_power);
    const pv2P = rawPv2P !== null ? Math.abs(Math.round(rawPv2P)) : null;
    const pv2V = this.getState(ent.pv2_voltage);

    this.updateMetric('line-pv1-p', 'txt-pv1-p', pv1P, pv1P);
    this.updateMetric('line-pv1-v', 'txt-pv1-v', pv1V, pv1V !== null ? pv1V.toFixed(1) : '');

    this.updateMetric('line-pv2-p', 'txt-pv2-p', pv2P, pv2P);
    this.updateMetric('line-pv2-v', 'txt-pv2-v', pv2V, pv2V !== null ? pv2V.toFixed(1) : '');

    // 3. AC PV
    const rawAcPvP = this.getState(ent.ac_pv_power);
    const acPvP = rawAcPvP !== null ? Math.abs(Math.round(rawAcPvP)) : null;
    const acPvV = this.getState(ent.ac_pv_voltage);
    const acPvF = this.getState(ent.ac_pv_frequency);

    const alwaysShowAcPv = isTrue(this.config?.always_show_ac_pv) || isTrue(ent?.always_show_ac_pv);
    const grpAcPv = this.shadowRoot.getElementById('grp-pv-ac');
    if (grpAcPv) {
      const hasAnyAcPv = (acPvP && acPvP > 0) || (acPvV && acPvV > 0) || alwaysShowAcPv;
      grpAcPv.style.display = hasAnyAcPv ? 'inline' : 'none';
    }

    this.updateMetric('line-ac-pv-p', 'txt-ac-pv-p', acPvP, acPvP);
    this.updateMetric('line-ac-pv-v', 'txt-ac-pv-v', acPvV, acPvV !== null ? acPvV.toFixed(1) : '');
    this.updateMetric('line-ac-pv-f', 'txt-ac-pv-f', acPvF, acPvF !== null ? acPvF.toFixed(2) : '');

    // 4. Pin Lưu Trữ
    let rawBatP = this.getState(ent.battery_power);
    if (rawBatP !== null && (isTrue(this.config?.invert_battery_power) || isTrue(ent?.invert_battery_power))) {
      rawBatP = -rawBatP;
    }
    const batP = rawBatP !== null ? Math.round(rawBatP) : null;
    const batV = this.getState(ent.battery_voltage);
    const soc = this.getState(ent.battery_soc);

    this.updateMetric('line-bat-p', 'txt-bat-p', batP !== null ? Math.abs(batP) : null, batP !== null ? Math.abs(batP) : '');
    this.updateMetric('line-bat-v', 'txt-bat-v', batV, batV !== null ? batV.toFixed(1) : '');
    this.updateMetric('line-bat-soc', 'txt-soc-val', soc, soc !== null ? Math.round(soc) : '');

    const isCharging = batP !== null && batP > 5;
    const isDischarging = batP !== null && batP < -5;

    const lblBatMode = this.shadowRoot.getElementById('lbl-bat-mode');
    if (lblBatMode) {
      if (soc === null) {
        lblBatMode.style.display = 'none';
      } else {
        lblBatMode.style.display = 'inline';
        if (isCharging) lblBatMode.textContent = "Đang sạc";
        else if (isDischarging) lblBatMode.textContent = "Đang xả";
        else {
          if (soc >= 100) lblBatMode.textContent = "Pin đầy";
          else if (soc >= 20) lblBatMode.textContent = "Chờ sạc / xả";
          else lblBatMode.textContent = "Pin yếu";
        }
      }
    }

    const batFill = this.shadowRoot.getElementById('bat-fill');
    if (batFill && soc !== null) {
      const maxH = 39.0;
      const h = Math.max(1, (soc / 100) * maxH);
      batFill.setAttribute('height', h);
      batFill.setAttribute('y', 8 + (maxH - h));

      let batColor = '#16a34a';
      if (soc <= 20) batColor = '#dc2626';
      else if (soc <= 40) batColor = '#ea580c';

      const txtSoc = this.shadowRoot.getElementById('txt-soc-val');
      if (txtSoc) txtSoc.setAttribute('fill', batColor);
      batFill.setAttribute('fill', batColor);
    }

    // 5. Tải tiêu thụ
    const rawLoadP = this.getState(ent.load_power);
    const loadP = rawLoadP !== null ? Math.abs(Math.round(rawLoadP)) : null;
    this.updateMetric('line-load-p', 'txt-load-p', loadP, loadP);

    // 6. Lưới
    const rawGridV = this.getState(ent.grid_voltage);
    const rawGridF = this.getState(ent.grid_frequency);
    let rawGridP = this.getState(ent.grid_power);

    if (rawGridP !== null && (isTrue(this.config?.invert_grid_power) || isTrue(ent?.invert_grid_power))) {
      rawGridP = -rawGridP;
    }
    const gridP = rawGridP !== null ? Math.round(rawGridP) : null;

    const isGridConnected = rawGridV !== null && rawGridV > 50;
    const gridV = isGridConnected ? rawGridV : null;
    const gridF = isGridConnected ? rawGridF : null;

    this.updateMetric('line-grid-p', 'txt-grid-p', gridP !== null ? Math.abs(gridP) : null, gridP !== null ? Math.abs(gridP) : '');
    this.updateMetric('line-grid-v', 'txt-grid-v', gridV, gridV !== null ? gridV.toFixed(1) : '');
    this.updateMetric('line-grid-f', 'txt-grid-f', gridF, gridF !== null ? gridF.toFixed(2) : '');

    // 7. EPS
    const rawEpsP = this.getState(ent.eps_power);
    const epsP = rawEpsP !== null ? Math.abs(Math.round(rawEpsP)) : null;
    const epsV = this.getState(ent.eps_voltage);
    const epsF = this.getState(ent.eps_frequency);

    this.updateMetric('line-eps-p', 'txt-eps-p', epsP, epsP);
    this.updateMetric('line-eps-v', 'txt-eps-v', epsV, epsV !== null ? epsV.toFixed(1) : '');
    this.updateMetric('line-eps-f', 'txt-eps-f', epsF, epsF !== null ? epsF.toFixed(2) : '');

    const lblEpsStandby = this.shadowRoot.getElementById('lbl-eps-standby');
    if (lblEpsStandby) {
      const showStandby = isGridConnected && (epsP === 0 || epsP === null);
      lblEpsStandby.style.display = showStandby ? 'inline' : 'none';
    }

    // 8. Trạng thái Hệ thống (Status Pill & Grid Mode)
    const isImporting = isGridConnected && gridP !== null && gridP < -5;
    const isExporting = isGridConnected && gridP !== null && gridP > 5;

    const lblGridMode = this.shadowRoot.getElementById('lbl-grid-mode');
    const pill = this.shadowRoot.getElementById('sys-status-pill');
    const pillTxt = this.shadowRoot.getElementById('sys-status-text');

    if (pill) pill.className = 'status-pill';

    if (!isGridConnected) {
      if (lblGridMode) { lblGridMode.textContent = "Mất lưới"; lblGridMode.style.fill = "#dc2626"; }
      if (pill) pill.classList.add('offline');
      if (pillTxt) pillTxt.textContent = "Mất Lưới";
    } else if (isExporting) {
      if (lblGridMode) { lblGridMode.textContent = "Đẩy Lưới"; lblGridMode.style.fill = "#0284c7"; }
      if (pill) pill.classList.add('exporting');
      if (pillTxt) pillTxt.textContent = "Đẩy Lưới";
    } else if (isImporting) {
      if (lblGridMode) { lblGridMode.textContent = "Lấy Lưới"; lblGridMode.style.fill = "#d97706"; }
      if (pill) pill.classList.add('importing');
      if (pillTxt) pillTxt.textContent = "Lấy Lưới";
    } else {
      if (lblGridMode) { lblGridMode.textContent = "Hòa Lưới"; lblGridMode.style.fill = "#16a34a"; }
      if (pill) pill.classList.add('ongrid');
      if (pillTxt) pillTxt.textContent = "Hòa Lưới";
    }

    // 9. Luồng hiệu ứng Động (Flow animation)
    const totalPvP = (pv1P || 0) + (pv2P || 0);
    this.setFlowVisible('flow-pv', totalPvP > 5);
    this.setFlowVisible('flow-ac-pv', alwaysShowAcPv && acPvP && acPvP > 5);
    this.setFlowVisible('flow-eps', epsP && epsP > 5);
    this.setFlowVisible('flow-bus-to-load', loadP && loadP > 5);

    this.setFlowVisible('flow-bat-charge', isCharging);
    this.setFlowVisible('flow-bat-discharge', isDischarging);

    this.setFlowVisible('flow-grid-import', isImporting);
    this.setFlowVisible('flow-grid-export', isExporting);

    const invGeneratingPower = totalPvP + (isDischarging ? Math.abs(batP) : 0);
    if (!isGridConnected) {
      this.setFlowVisible('flow-inv-to-bus', invGeneratingPower > 5);
      this.setFlowVisible('flow-bus-to-inv', acPvP && acPvP > 5);
    } else {
      this.setFlowVisible('flow-inv-to-bus', invGeneratingPower > 5);
      this.setFlowVisible('flow-bus-to-inv', isImporting && isCharging);
    }

    // Thống kê Thẻ Đầu (Energy Stats)
    this.setText('stat-pv-today', (this.getState(ent.pv_daily) || 0).toFixed(2));
    this.setText('stat-pv-total', (this.getState(ent.pv_total) || 0).toFixed(2));
    this.setText('stat-load-today', (this.getState(ent.load_daily) || 0).toFixed(2));
    this.setText('stat-load-total', (this.getState(ent.load_total) || 0).toFixed(2));

    this.setText('stat-bat-c-today', (this.getState(ent.battery_charge_daily) || 0).toFixed(2));
    this.setText('stat-bat-c-total', (this.getState(ent.battery_charge_total) || 0).toFixed(2));
    this.setText('stat-bat-d-today', (this.getState(ent.battery_discharge_daily) || 0).toFixed(2));
    this.setText('stat-bat-d-total', (this.getState(ent.battery_discharge_total) || 0).toFixed(2));

    this.setText('stat-grid-b-today', (this.getState(ent.grid_buy_daily) || 0).toFixed(2));
    this.setText('stat-grid-b-total', (this.getState(ent.grid_buy_total) || 0).toFixed(2));
    this.setText('stat-grid-s-today', (this.getState(ent.grid_sell_daily) || 0).toFixed(2));
    this.setText('stat-grid-s-total', (this.getState(ent.grid_sell_total) || 0).toFixed(2));
  }

  render() {
    this.shadowRoot.innerHTML = `
      <style>
        :host { display: block; width: 100%; box-sizing: border-box; -webkit-text-size-adjust: 100%; -webkit-font-smoothing: antialiased; }
        * { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
        .app-card { width: 100%; background: #ffffff; border-radius: 14px; border: 1px solid #e2e8f0; padding: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.02); }
        .stats-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; margin-bottom: 8px; }
        .stat-card { background: #ffffff; border-radius: 8px; border: 1px solid #e2e8f0; overflow: hidden; }
        .card-header { padding: 4px 6px; font-size: 11px; color: #ffffff; font-weight: 800; white-space: nowrap; letter-spacing: 0.2px; }
        .bg-pv { background: #0284c7; } .bg-bat { background: #16a34a; } .bg-grid { background: #d97706; } .bg-load { background: #e11d48; } 
        .card-body { display: flex; justify-content: space-between; align-items: center; padding: 6px 4px; gap: 2px; }
        .stat-dual-wrap { display: flex; gap: 2px; flex: 1; min-width: 0; }
        .stat-dual-wrap > div { flex: 1; min-width: 0; }
        .stat-val { font-size: 11px; font-weight: 800; color: #0f172a; line-height: 1.1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .unit { font-size: 8px; font-weight: 600; color: #475569; }
        .stat-lbl { font-size: 7.5px; color: #64748b; margin-bottom: 2px; text-transform: uppercase; font-weight: 700; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .stat-icon { flex-shrink: 0; width: 28px; height: 28px; display: flex; align-items: center; justify-content: center; }
        .diagram-card { background: #ffffff; padding: 8px 4px 6px 4px; border-radius: 10px; border: 1px solid #e2e8f0; position: relative; }
        .status-pill { position: absolute; right: 8px; top: 8px; width: fit-content; white-space: nowrap; background: #f8fafc; color: #334155; font-size: 9px; padding: 3px 8px; border-radius: 12px; font-weight: 800; display: inline-flex; align-items: center; gap: 4px; z-index: 10; pointer-events: none; border: 1px solid #e2e8f0; }
        .status-dot { width: 6px; height: 6px; border-radius: 50%; }
        .status-pill.ongrid { background: #f0fdf4; color: #15803d; border-color: #bbf7d0; } .status-pill.ongrid .status-dot { background: #16a34a; }
        .status-pill.offline { background: #fef2f2; color: #b91c1c; border-color: #fecaca; } .status-pill.offline .status-dot { background: #dc2626; }
        .status-pill.exporting { background: #f0f9ff; color: #0369a1; border-color: #bae6fd; } .status-pill.exporting .status-dot { background: #0284c7; }
        .status-pill.importing { background: #fffbe6; color: #b45309; border-color: #fde68a; } .status-pill.importing .status-dot { background: #d97706; }
        .diagram-svg { width: 100%; height: auto; display: block; overflow: visible; }
        .svg-txt-bold { font-size: 12.5px; font-weight: 800; fill: #0f172a; }
        .svg-txt-sub  { font-size: 9.5px; fill: #475569; font-weight: 700; }
        .highlight-val { font-size: 11.5px; font-weight: 800; fill: #0f172a; }
        .highlight-freq { font-size: 11.5px; font-weight: 800; fill: #0f172a; }
        .unit-lbl { font-size: 9.5px; font-weight: 700; fill: #64748b; }
        .chv-block { fill: #eab308; stroke: #fef08a; stroke-width: 0.5; animation: block-wave 1.4s infinite ease-in-out; }
        @keyframes block-wave { 0% { fill: #fef08a; opacity: 0.25; } 50% { fill: #eab308; opacity: 1; } 100% { fill: #fef08a; opacity: 0.25; } }
      </style>

      <ha-card>
        <div class="app-card">
          <div class="stats-grid">
            <div class="stat-card">
              <div class="card-header bg-pv">Sản lượng PV</div>
              <div class="card-body">
                <div style="flex:1; min-width:0;">
                  <div class="stat-val"><span id="stat-pv-today">0.00</span> <span class="unit">kWh</span></div>
                  <div class="stat-lbl">Hôm nay</div>
                  <div class="stat-val" style="margin-top:2px;"><span id="stat-pv-total">0.00</span> <span class="unit">kWh</span></div>
                  <div class="stat-lbl">Tổng cộng</div>
                </div>
                <div class="stat-icon">
                  <svg width="28" height="28" viewBox="0 0 100 100">
                    <g stroke="#22c55e" stroke-width="4.5" stroke-linecap="round" fill="none">
                      <circle cx="30" cy="30" r="13" />
                      <line x1="30" y1="11" x2="30" y2="5" /><line x1="16" y1="16" x2="11" y2="11" />
                      <line x1="11" y1="30" x2="5" y2="30" /><line x1="16" y1="44" x2="11" y2="49" />
                      <line x1="44" y1="16" x2="49" y2="11" /><line x1="49" y1="30" x2="55" y2="30" />
                    </g>
                    <polygon points="32,42 80,42 94,86 18,86" fill="#16a34a" stroke="#22c55e" stroke-width="4" stroke-linejoin="round"/>
                    <g stroke="#ffffff" stroke-width="2.5" stroke-linecap="round" opacity="0.9">
                      <line x1="28.5" y1="53" x2="83.5" y2="53" /><line x1="25" y1="64" x2="87" y2="64" />
                      <line x1="21.5" y1="75" x2="90.5" y2="75" /><line x1="44" y1="42" x2="37" y2="86" />
                      <line x1="56" y1="42" x2="56" y2="86" /><line x1="68" y1="42" x2="75" y2="86" />
                    </g>
                  </svg>
                </div>
              </div>
            </div>

            <div class="stat-card">
              <div class="card-header bg-load">Tải tiêu thụ</div>
              <div class="card-body">
                <div style="flex:1; min-width:0;">
                  <div class="stat-val"><span id="stat-load-today">0.00</span> <span class="unit">kWh</span></div>
                  <div class="stat-lbl">Hôm nay</div>
                  <div class="stat-val" style="margin-top:2px;"><span id="stat-load-total">0.00</span> <span class="unit">kWh</span></div>
                  <div class="stat-lbl">Tổng cộng</div>
                </div>
                <div class="stat-icon">
                  <svg width="26" height="26" viewBox="0 0 30 30">
                    <rect x="7" y="5" width="2.5" height="5" class="load-icon-color" fill="#16a34a"/>
                    <path d="M 3 13 L 15 3 L 27 13 V 26 C 27 26.8 26.3 27.5 25.5 27.5 H 4.5 C 3.7 27.5 3 26.8 3 26 Z" class="load-icon-color" fill="#16a34a"/>
                    <polygon points="16,8 11.5,15 15,15 14,22 18.5,15 15,15" fill="#ffffff"/>
                  </svg>
                </div>
              </div>
            </div>

            <div class="stat-card">
              <div class="card-header bg-bat">Pin Lưu Trữ</div>
              <div class="card-body">
                <div class="stat-dual-wrap">
                  <div>
                    <div class="stat-val"><span id="stat-bat-c-today">0.00</span> <span class="unit">kWh</span></div>
                    <div class="stat-lbl">Sạc hôm nay</div>
                    <div class="stat-val" style="margin-top:2px;"><span id="stat-bat-c-total">0.00</span> <span class="unit">kWh</span></div>
                    <div class="stat-lbl">Tổng sạc</div>
                  </div>
                  <div>
                    <div class="stat-val"><span id="stat-bat-d-today">0.00</span> <span class="unit">kWh</span></div>
                    <div class="stat-lbl">Xả hôm nay</div>
                    <div class="stat-val" style="margin-top:2px;"><span id="stat-bat-d-total">0.00</span> <span class="unit">kWh</span></div>
                    <div class="stat-lbl">Tổng xả</div>
                  </div>
                </div>
                <div class="stat-icon">
                  <svg width="24" height="28" viewBox="0 0 30 40">
                    <rect x="5" y="6" width="20" height="30" rx="3" fill="#16a34a"/>
                    <rect x="11" y="2" width="8" height="4" rx="1" fill="#16a34a"/>
                    <path d="M16 12L10 21H15L14 28L20 19H15Z" fill="#ffffff"/>
                  </svg>
                </div>
              </div>
            </div>

            <div class="stat-card">
              <div class="card-header bg-grid">Lưới</div>
              <div class="card-body">
                <div class="stat-dual-wrap">
                  <div>
                    <div class="stat-val"><span id="stat-grid-b-today">0.00</span> <span class="unit">kWh</span></div>
                    <div class="stat-lbl">Mua hôm nay</div>
                    <div class="stat-val" style="margin-top:2px;"><span id="stat-grid-b-total">0.00</span> <span class="unit">kWh</span></div>
                    <div class="stat-lbl">Tổng mua</div>
                  </div>
                  <div>
                    <div class="stat-val"><span id="stat-grid-s-today">0.00</span> <span class="unit">kWh</span></div>
                    <div class="stat-lbl">Bán hôm nay</div>
                    <div class="stat-val" style="margin-top:2px;"><span id="stat-grid-s-total">0.00</span> <span class="unit">kWh</span></div>
                    <div class="stat-lbl">Tổng bán</div>
                  </div>
                </div>
                <div class="stat-icon">
                  <svg width="24" height="28" viewBox="0 0 30 40">
                    <path d="M15 2L5 38M15 2L25 38M2 12H28M5 22H25" stroke="#16a34a" stroke-width="3.5" fill="none" stroke-linecap="round"/>
                    <circle cx="15" cy="2" r="2.5" fill="#16a34a"/>
                  </svg>
                </div>
              </div>
            </div>
          </div>

          <div class="diagram-card">
            <div class="status-pill ongrid" id="sys-status-pill">
              <span class="status-dot"></span> <span id="sys-status-text">Hòa Lưới</span>
            </div>

            <svg class="diagram-svg" viewBox="0 0 420 245">
              <defs>
                <path id="chv-block-r" d="M 0,0 L 8,0 L 12,5 L 8,10 L 0,10 L 3.5,5 Z"/>
                <path id="chv-block-l" d="M 12,0 L 4,0 L 0,5 L 4,10 L 12,10 L 8.5,5 Z"/>
                <path id="chv-block-d" d="M 0,0 L 5,3.5 L 10,0 L 10,8 L 5,12 L 0,8 Z"/>
                <path id="chv-block-u" d="M 5,0 L 10,4 L 10,12 L 5,8.5 L 0,12 L 0,4 Z"/>
              </defs>

              <g id="flow-pv">
                <use href="#chv-block-d" x="175" y="40" class="chv-block" style="animation-delay: 0.00s;" />
                <use href="#chv-block-d" x="175" y="52" class="chv-block" style="animation-delay: 0.35s;" />
                <use href="#chv-block-d" x="175" y="64" class="chv-block" style="animation-delay: 0.70s;" />
              </g>

              <g id="flow-ac-pv">
                <use href="#chv-block-d" x="285" y="38" class="chv-block" style="animation-delay: 0.00s;" />
                <use href="#chv-block-d" x="285" y="54" class="chv-block" style="animation-delay: 0.25s;" />
                <use href="#chv-block-d" x="285" y="70" class="chv-block" style="animation-delay: 0.50s;" />
                <use href="#chv-block-d" x="285" y="86" class="chv-block" style="animation-delay: 0.75s;" />
              </g>

              <g id="flow-eps">
                <use href="#chv-block-d" x="175" y="136" class="chv-block" style="animation-delay: 0.00s;" />
                <use href="#chv-block-d" x="175" y="149" class="chv-block" style="animation-delay: 0.35s;" />
                <use href="#chv-block-d" x="175" y="162" class="chv-block" style="animation-delay: 0.70s;" />
              </g>

              <g id="flow-bus-to-load">
                <use href="#chv-block-d" x="285" y="110" class="chv-block" style="animation-delay: 0.00s;" />
                <use href="#chv-block-d" x="285" y="123" class="chv-block" style="animation-delay: 0.20s;" />
                <use href="#chv-block-d" x="285" y="136" class="chv-block" style="animation-delay: 0.40s;" />
                <use href="#chv-block-d" x="285" y="149" class="chv-block" style="animation-delay: 0.60s;" />
                <use href="#chv-block-d" x="285" y="162" class="chv-block" style="animation-delay: 0.80s;" />
              </g>

              <g id="flow-bat-discharge">
                <use href="#chv-block-r" x="93"  y="100" class="chv-block" style="animation-delay: 0.00s;" />
                <use href="#chv-block-r" x="108" y="100" class="chv-block" style="animation-delay: 0.25s;" />
                <use href="#chv-block-r" x="123" y="100" class="chv-block" style="animation-delay: 0.50s;" />
                <use href="#chv-block-r" x="138" y="100" class="chv-block" style="animation-delay: 0.75s;" />
              </g>

              <g id="flow-bat-charge">
                <use href="#chv-block-l" x="138" y="100" class="chv-block" style="animation-delay: 0.00s;" />
                <use href="#chv-block-l" x="123" y="100" class="chv-block" style="animation-delay: 0.25s;" />
                <use href="#chv-block-l" x="108" y="100" class="chv-block" style="animation-delay: 0.25s;" />
                <use href="#chv-block-l" x="93"  y="100" class="chv-block" style="animation-delay: 0.75s;" />
              </g>

              <g id="flow-inv-to-bus">
                <use href="#chv-block-r" x="210" y="100" class="chv-block" style="animation-delay: 0.00s;" />
                <use href="#chv-block-r" x="225" y="100" class="chv-block" style="animation-delay: 0.25s;" />
                <use href="#chv-block-r" x="240" y="100" class="chv-block" style="animation-delay: 0.50s;" />
                <use href="#chv-block-r" x="255" y="100" class="chv-block" style="animation-delay: 0.75s;" />
                <use href="#chv-block-r" x="270" y="100" class="chv-block" style="animation-delay: 1.00s;" />
              </g>

              <g id="flow-bus-to-inv">
                <use href="#chv-block-l" x="270" y="100" class="chv-block" style="animation-delay: 0.00s;" />
                <use href="#chv-block-l" x="255" y="100" class="chv-block" style="animation-delay: 0.75s;" />
                <use href="#chv-block-l" x="240" y="100" class="chv-block" style="animation-delay: 0.50s;" />
                <use href="#chv-block-l" x="225" y="100" class="chv-block" style="animation-delay: 0.25s;" />
                <use href="#chv-block-l" x="210" y="100" class="chv-block" style="animation-delay: 0.00s;" />
              </g>

              <g id="flow-grid-import">
                <use href="#chv-block-l" x="328" y="100" class="chv-block" style="animation-delay: 0.00s;" />
                <use href="#chv-block-l" x="313" y="100" class="chv-block" style="animation-delay: 0.30s;" />
                <use href="#chv-block-l" x="298" y="100" class="chv-block" style="animation-delay: 0.60s;" />
              </g>

              <g id="flow-grid-export">
                <use href="#chv-block-r" x="298" y="100" class="chv-block" style="animation-delay: 0.00s;" />
                <use href="#chv-block-r" x="313" y="100" class="chv-block" style="animation-delay: 0.30s;" />
                <use href="#chv-block-r" x="328" y="100" class="chv-block" style="animation-delay: 0.30s;" />
              </g>

              <circle id="ac-bus-node" cx="290" cy="105" r="6" fill="#16a34a" stroke="#ffffff" stroke-width="1.5"/>

              <g id="grp-pv" transform="translate(48, 2)">
                <g id="line-pv1-p">
                  <text x="0" y="14" font-size="13" font-weight="800" fill="#0f172a" id="txt-pv1-p">0</text>
                  <text x="30" y="14" class="unit-lbl">W</text>
                </g>
                <g id="line-pv1-v">
                  <text x="48" y="14" font-size="13" font-weight="800" fill="#0f172a" id="txt-pv1-v">0.0</text>
                  <text x="86" y="14" class="unit-lbl">V</text>
                </g>

                <g id="line-pv2-p">
                  <text x="0" y="32" font-size="13" font-weight="800" fill="#0f172a" id="txt-pv2-p">0</text>
                  <text x="30" y="32" class="unit-lbl">W</text>
                </g>
                <g id="line-pv2-v">
                  <text x="48" y="32" font-size="13" font-weight="800" fill="#0f172a" id="txt-pv2-v">0.0</text>
                  <text x="86" y="32" class="unit-lbl">V</text>
                </g>

                <g transform="translate(108, -8) scale(0.48)">
                  <g stroke="#22c55e" stroke-width="4.5" stroke-linecap="round" fill="none">
                    <circle cx="30" cy="30" r="13" />
                    <line x1="30" y1="11" x2="30" y2="5" /><line x1="16" y1="16" x2="11" y2="11" />
                    <line x1="11" y1="30" x2="5" y2="30" /><line x1="16" y1="44" x2="11" y2="49" />
                    <line x1="44" y1="16" x2="49" y2="11" /><line x1="49" y1="30" x2="55" y2="30" />
                  </g>
                  <polygon points="32,42 80,42 94,86 18,86" fill="#16a34a" stroke="#22c55e" stroke-width="4" stroke-linejoin="round"/>
                  <g stroke="#ffffff" stroke-width="2.5" stroke-linecap="round" opacity="0.9">
                    <line x1="28.5" y1="53" x2="83.5" y2="53" /><line x1="25" y1="64" x2="87" y2="64" />
                    <line x1="21.5" y1="75" x2="90.5" y2="75" /><line x1="44" y1="42" x2="37" y2="86" />
                    <line x1="56" y1="42" x2="56" y2="86" /><line x1="68" y1="42" x2="75" y2="86" />
                  </g>
                </g>
              </g>

              <g id="grp-pv-ac">
                <g id="line-ac-pv-p">
                  <text x="265" y="12" text-anchor="end">
                    <tspan id="txt-ac-pv-p" class="svg-txt-bold">0</tspan><tspan class="unit-lbl" dx="1.5">W</tspan>
                  </text>
                </g>
                <g id="line-ac-pv-v">
                  <text x="265" y="23" text-anchor="end">
                    <tspan id="txt-ac-pv-v" class="highlight-val">0.0</tspan><tspan class="unit-lbl" dx="1.5">V</tspan>
                  </text>
                </g>
                <g id="line-ac-pv-f">
                  <text x="265" y="34" text-anchor="end">
                    <tspan id="txt-ac-pv-f" class="highlight-freq">0.00</tspan><tspan class="unit-lbl" dx="1.5">Hz</tspan>
                  </text>
                </g>
                <g transform="translate(271, 0)">
                  <rect x="0" y="0" width="44" height="36" rx="6" fill="#ffffff" stroke="#cbd5e1" stroke-width="1.5" stroke-dasharray="3,3"/>
                  <g fill="#10b981">
                    <polygon points="14,4 28,4 23,8 9,8"/>
                    <polygon points="12,8 26,8 21,12 7,12"/>
                  </g>
                  <g transform="translate(7, 13)">
                    <rect x="0" y="0" width="30" height="17" rx="2" fill="#ffffff" stroke="#10b981" stroke-width="1.5"/>
                    <line x1="1" y1="16" x2="29" y2="1" stroke="#10b981" stroke-width="1.3"/>
                    <line x1="3" y1="4.5" x2="10" y2="4.5" stroke="#0f172a" stroke-width="1.2" stroke-linecap="round"/>
                    <line x1="3" y1="7.5" x2="10" y2="7.5" stroke="#0f172a" stroke-width="1.2" stroke-linecap="round"/>
                    <path d="M 17 9.5 Q 19 7.5, 21 9.5 T 25 9.5" fill="none" stroke="#0f172a" stroke-width="1.2" stroke-linecap="round"/>
                    <path d="M 17 12 Q 19 10, 21 12 T 25 12" fill="none" stroke="#0f172a" stroke-width="1.2" stroke-linecap="round"/>
                  </g>
                </g>
              </g>

              <g transform="translate(64, 76)">
                <rect x="10" y="1" width="10" height="4" rx="1.5" fill="#16a34a"/>
                <rect x="2" y="5" width="26" height="44" rx="4" fill="#ffffff" stroke="#16a34a" stroke-width="2"/>
                <rect id="bat-fill" x="4" y="8" width="22" height="39" rx="1.5" fill="#16a34a"/>

                <g id="line-bat-p">
                  <text x="-6" y="8" text-anchor="end">
                    <tspan id="txt-bat-p" class="svg-txt-bold">0</tspan><tspan class="unit-lbl" dx="1.5">W</tspan>
                  </text>
                </g>

                <text x="-6" y="19" class="svg-txt-sub" id="lbl-bat-mode" text-anchor="end">Chờ sạc / xả</text>

                <g id="line-bat-v">
                  <text x="-6" y="31" text-anchor="end">
                    <tspan id="txt-bat-v" class="highlight-val">0.0</tspan><tspan class="unit-lbl" dx="1.5">V</tspan>
                  </text>
                </g>

                <g id="line-bat-soc">
                  <text x="-6" y="44" text-anchor="end">
                    <tspan id="txt-soc-val" font-size="13px" font-weight="bold" fill="#16a34a">0</tspan><tspan class="unit-lbl" dx="1" fill="#16a34a">%</tspan>
                  </text>
                </g>
              </g>

              <g transform="translate(154, 76)">
                <rect x="0" y="0" width="54" height="56" rx="6" fill="#ffffff" stroke="#334155" stroke-width="2"/>
                <circle cx="9" cy="9" r="3.5" fill="#16a34a" id="inv-led"/>
                <rect x="10" y="17" width="34" height="21" rx="2" fill="#0f172a"/>
                <rect x="12" y="19" width="30" height="17" rx="1" fill="#020617"/>
                <text id="inv-lcd-time" x="27" y="30.5" font-size="7" font-weight="bold" fill="#16a34a" font-family="monospace" text-anchor="middle">00:00:00</text>
                <path d="M 0 50 L 54 50 L 54 54 C 54 55.5 52.5 57 51 57 L 3 57 C 1.5 57 0 55.5 0 54 Z" fill="#64748b"/>
              </g>

              <g transform="translate(338, 70)">
                <svg x="0" y="0" width="34" height="44" viewBox="0 0 30 40">
                  <path d="M15 2L5 38M15 2L25 38M2 12H28M5 22H25" stroke="#16a34a" stroke-width="3" fill="none" stroke-linecap="round"/>
                </svg>
                <g id="line-grid-p">
                  <text x="36" y="10">
                    <tspan id="txt-grid-p" class="svg-txt-bold">0</tspan><tspan class="unit-lbl" dx="1.5">W</tspan>
                  </text>
                </g>
                <text x="36" y="21" class="svg-txt-sub" id="lbl-grid-mode" font-weight="bold" fill="#dc2626">Mất lưới</text>
                <g id="line-grid-v">
                  <text x="36" y="32">
                    <tspan id="txt-grid-v" class="highlight-val">0.0</tspan><tspan class="unit-lbl" dx="1.5">V</tspan>
                  </text>
                </g>
                <g id="line-grid-f">
                  <text x="36" y="43">
                    <tspan id="txt-grid-f" class="highlight-freq">0.00</tspan><tspan class="unit-lbl" dx="1.5">Hz</tspan>
                  </text>
                </g>
              </g>

              <g id="grp-eps" transform="translate(134, 172)">
                <svg width="32" height="32" viewBox="0 0 30 30">
                  <rect x="3" y="7" width="18" height="16" rx="2" fill="none" stroke="#16a34a" stroke-width="2.8"/>
                  <path d="M8 1V7 M16 1V7 M12 23V29" stroke="#16a34a" stroke-width="2.8"/>
                  <circle cx="24" cy="15" r="5" fill="none" stroke="#16a34a" stroke-width="2.2"/>
                  <path d="M22 15H26" stroke="#16a34a" stroke-width="2.2"/>
                </svg>

                <g id="line-eps-p">
                  <text x="38" y="12">
                    <tspan id="txt-eps-p" class="svg-txt-bold">0</tspan><tspan class="unit-lbl" dx="1.5">W</tspan>
                  </text>
                </g>

                <g id="line-eps-v">
                  <text x="38" y="23">
                    <tspan id="txt-eps-v" class="highlight-val">0.0</tspan><tspan class="unit-lbl" dx="1.5">V</tspan>
                  </text>
                </g>
                <g id="line-eps-f">
                  <text x="38" y="34">
                    <tspan id="txt-eps-f" class="highlight-freq">0.00</tspan><tspan class="unit-lbl" dx="1.5">Hz</tspan>
                  </text>
                </g>

                <text x="38" y="44" id="lbl-eps-sub" class="svg-txt-sub">Công suất EPS</text>
                <text x="38" y="54" id="lbl-eps-standby" style="font-size: 9px; fill: #16a34a; font-weight: 800; display: none;">Chế độ chờ</text>
              </g>

              <g transform="translate(273, 175)">
                <svg width="32" height="32" viewBox="0 0 30 30">
                  <rect x="7" y="5" width="2.5" height="5" class="load-icon-color" fill="#16a34a"/>
                  <path d="M 3 13 L 15 3 L 27 13 V 26 C 27 26.8 26.3 27.5 25.5 27.5 H 4.5 C 3.7 27.5 3 26.8 3 26 Z" class="load-icon-color" fill="#16a34a"/>
                  <polygon points="16,8 11.5,15 15,15 14,22 18.5,15 15,15" fill="#ffffff"/>
                </svg>
                <g id="line-load-p">
                  <text x="36" y="13">
                    <tspan id="txt-load-p" class="svg-txt-bold">0</tspan><tspan class="unit-lbl" dx="1.5">W</tspan>
                  </text>
                </g>
                <text x="36" y="26" class="svg-txt-sub">Tải Tiêu Thụ</text>
              </g>
            </svg>
          </div>
        </div>
      </ha-card>
    `;
  }

  getCardSize() {
    return 6;
  }
}

customElements.define('power-flow-card', PowerFlowCard);

window.customCards = window.customCards || [];
window.customCards.push({
  type: "power-flow-card",
  name: "Power Flow Card",
  description: "Sơ đồ luồng năng lượng cho Inverter Hybrid"
});
