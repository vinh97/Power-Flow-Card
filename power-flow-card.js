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

  getState(entityId, defaultVal = 0) {
    if (!entityId || !this._hass || !this._hass.states[entityId]) return defaultVal;
    const val = parseFloat(this._hass.states[entityId].state);
    return isNaN(val) ? defaultVal : val;
  }

  setFlowVisible(id, visible) {
    const el = this.shadowRoot.getElementById(id);
    if (el) el.style.display = visible ? 'inline' : 'none';
  }

  setText(id, text) {
    const el = this.shadowRoot.getElementById(id);
    if (el) el.textContent = text;
  }

  updateData() {
    if (!this._hass || !this.config) return;

    const ent = this.config.entities;
    const isTrue = (val) => val === true || String(val).toLowerCase() === 'true';
    const isThreePhase = isTrue(this.config?.three_phase) || isTrue(ent?.three_phase);

    // 1. Thời gian LCD
    const mainEntityId = ent.load_power || ent.grid_power || ent.pv1_power || ent.pv2_power;
    if (mainEntityId && this._hass.states[mainEntityId]) {
      const lastUpdatedStr = this._hass.states[mainEntityId].last_updated;
      const updatedDate = new Date(lastUpdatedStr);
      const timeFormatted = [
        updatedDate.getHours(),
        updatedDate.getMinutes(),
        updatedDate.getSeconds()
      ].map(n => String(n).padStart(2, '0')).join(':');

      this.setText('inv-lcd-time', timeFormatted);
    }

    // 2. Lấy dữ liệu PV
    let pvP = 0;
    let currentPvY = 14;
    const pvRowStep = 15;

    [1, 2, 3, 4].forEach(i => {
      const pEnt = ent[`pv${i}_power`];
      const vEnt = ent[`pv${i}_voltage`];

      const hasP = Boolean(pEnt && this._hass?.states[pEnt] !== undefined);
      const hasV = Boolean(vEnt && this._hass?.states[vEnt] !== undefined);

      const pVal = hasP ? Math.abs(Math.round(this.getState(pEnt))) : 0;
      const vVal = hasV ? this.getState(vEnt, 0) : 0;

      if (hasP) pvP += pVal;

      const showP = hasP && pVal > 0;
      const showV = hasV && vVal > 0;

      const lineP = this.shadowRoot.getElementById(`line-pv${i}-p`);
      const lineV = this.shadowRoot.getElementById(`line-pv${i}-v`);
      const grp = this.shadowRoot.getElementById(`grp-pv${i}`);

      if (lineP) lineP.style.display = showP ? 'inline' : 'none';
      if (lineV) lineV.style.display = showV ? 'inline' : 'none';

      if (showP) this.setText(`txt-pv${i}-p`, pVal);
      if (showV) this.setText(`txt-pv${i}-v`, vVal.toFixed(1));

      if (grp) {
        if (showP || showV) {
          grp.style.display = 'inline';
          grp.setAttribute('transform', `translate(0, ${currentPvY})`);
          currentPvY += pvRowStep;
        } else {
          grp.style.display = 'none';
        }
      }
    });

    // 3. Xử lý Tải tiêu thụ & EPS (Logic 1 pha vs 3 pha)
    let loadP = 0;
    let epsP = 0;

    const grpLoad1p = this.shadowRoot.getElementById('grp-load-1p');
    const grpLoad3p = this.shadowRoot.getElementById('grp-load-3p');
    const grpEps1p = this.shadowRoot.getElementById('grp-eps-1p');
    const grpEps3p = this.shadowRoot.getElementById('grp-eps-3p');

    if (isThreePhase) {
      if (grpLoad1p) grpLoad1p.style.display = 'none';
      if (grpLoad3p) grpLoad3p.style.display = 'inline';
      if (grpEps1p) grpEps1p.style.display = 'none';
      if (grpEps3p) grpEps3p.style.display = 'inline';

      const loadL1 = Math.abs(Math.round(this.getState(ent.load_power_l1)));
      const loadL2 = Math.abs(Math.round(this.getState(ent.load_power_l2)));
      const loadL3 = Math.abs(Math.round(this.getState(ent.load_power_l3)));
      loadP = ent.load_power ? Math.abs(Math.round(this.getState(ent.load_power))) : (loadL1 + loadL2 + loadL3);

      this.setText('txt-load-l1', loadL1);
      this.setText('txt-load-l2', loadL2);
      this.setText('txt-load-l3', loadL3);

      const epsL1 = Math.abs(Math.round(this.getState(ent.eps_power_l1)));
      const epsL2 = Math.abs(Math.round(this.getState(ent.eps_power_l2)));
      const epsL3 = Math.abs(Math.round(this.getState(ent.eps_power_l3)));
      epsP = ent.eps_power ? Math.abs(Math.round(this.getState(ent.eps_power))) : (epsL1 + epsL2 + epsL3);

      this.setText('txt-eps-l1', epsL1);
      this.setText('txt-eps-l2', epsL2);
      this.setText('txt-eps-l3', epsL3);
    } else {
      if (grpLoad1p) grpLoad1p.style.display = 'inline';
      if (grpLoad3p) grpLoad3p.style.display = 'none';
      if (grpEps1p) grpEps1p.style.display = 'inline';
      if (grpEps3p) grpEps3p.style.display = 'none';

      loadP = Math.abs(Math.round(this.getState(ent.load_power)));
      epsP = Math.abs(Math.round(this.getState(ent.eps_power)));

      this.setText('txt-load-p', loadP);
      this.setText('txt-eps-p', epsP);
    }

    // 4. Pin lưu trữ
    let batP = Math.round(this.getState(ent.battery_power));
    const batV = this.getState(ent.battery_voltage, 0);
    const soc = Math.round(this.getState(ent.battery_soc, 0));

    const invertBat = isTrue(this.config?.invert_battery_power) || isTrue(ent?.invert_battery_power);
    if (invertBat) batP = -batP;

    // 5. Điện Lưới
    const rawGridV = this.getState(ent.grid_voltage, 0.0);
    const rawGridF = this.getState(ent.grid_frequency, 0.0);
    let gridP = Math.round(this.getState(ent.grid_power, 0));

    const invertGrid = isTrue(this.config?.invert_grid_power) || isTrue(ent?.invert_grid_power);
    if (invertGrid) gridP = -gridP;

    const isGridConnected = rawGridV > 50; 
    const gridV = isGridConnected ? rawGridV : 0.0;
    const gridF = isGridConnected ? rawGridF : 0.0;

    // 6. Logic EPS Subtext / Standby
    const lineEpsV = this.shadowRoot.getElementById('line-eps-v');
    const lineEpsF = this.shadowRoot.getElementById('line-eps-f');
    const lblEpsSub = this.shadowRoot.getElementById('lbl-eps-sub');
    const lblEpsStandby = this.shadowRoot.getElementById('lbl-eps-standby');

    const hasEpsV = Boolean(ent.eps_voltage && this._hass?.states[ent.eps_voltage] !== undefined);
    const hasEpsF = hasEpsV && Boolean(ent.eps_frequency && this._hass?.states[ent.eps_frequency] !== undefined);

    if (lineEpsV) {
      lineEpsV.style.display = hasEpsV ? 'inline' : 'none';
      if (hasEpsV) this.setText('txt-eps-v', this.getState(ent.eps_voltage, 0.0).toFixed(1));
    }

    if (lineEpsF) {
      lineEpsF.style.display = hasEpsF ? 'inline' : 'none';
      if (hasEpsF) this.setText('txt-eps-f', this.getState(ent.eps_frequency, 0.0).toFixed(2));
    }

    const showStandby = isGridConnected && (epsP === 0);
    if (lblEpsStandby) lblEpsStandby.style.display = showStandby ? 'inline' : 'none';

    const baseEpsSubY = isThreePhase ? 48 : (hasEpsV ? (hasEpsF ? 44 : 34) : 28);
    if (lblEpsSub) lblEpsSub.setAttribute('y', baseEpsSubY);
    if (lblEpsStandby) lblEpsStandby.setAttribute('y', baseEpsSubY + 10);

    // 7. AC PV
    const alwaysShowAcPv = isTrue(this.config?.always_show_ac_pv) || isTrue(ent?.always_show_ac_pv);
    const grpAcPv = this.shadowRoot.getElementById('grp-pv-ac');
    if (grpAcPv) grpAcPv.style.display = alwaysShowAcPv ? 'inline' : 'none';

    const acPvP = Math.abs(Math.round(this.getState(ent.ac_pv_power, 0)));
    const acPvV = this.getState(ent.ac_pv_voltage, 0.0);
    const acPvF = this.getState(ent.ac_pv_frequency, 0.0);

    const hasAcPvP = Boolean(ent.ac_pv_power && this._hass?.states[ent.ac_pv_power] !== undefined) && acPvP > 0;
    const hasAcPvV = Boolean(ent.ac_pv_voltage && this._hass?.states[ent.ac_pv_voltage] !== undefined);
    const hasAcPvF = hasAcPvV && Boolean(ent.ac_pv_frequency && this._hass?.states[ent.ac_pv_frequency] !== undefined);

    const lineAcPvP = this.shadowRoot.getElementById('line-ac-pv-p');
    if (lineAcPvP) {
      lineAcPvP.style.display = hasAcPvP ? 'inline' : 'none';
      this.setText('txt-ac-pv-p', acPvP);
    }

    const lineAcPvV = this.shadowRoot.getElementById('line-ac-pv-v');
    if (lineAcPvV) {
      lineAcPvV.style.display = (hasAcPvV && acPvV > 0) ? 'inline' : 'none';
      if (hasAcPvV) this.setText('txt-ac-pv-v', acPvV.toFixed(1));
    }

    const lineAcPvF = this.shadowRoot.getElementById('line-ac-pv-f');
    if (lineAcPvF) {
      lineAcPvF.style.display = (hasAcPvF && acPvF > 0) ? 'inline' : 'none';
      if (hasAcPvF) this.setText('txt-ac-pv-f', acPvF.toFixed(2));
    }

    // 8. Thống kê
    this.setText('stat-pv-today', this.getState(ent.pv_daily).toFixed(2));
    this.setText('stat-pv-total', this.getState(ent.pv_total).toFixed(2));
    this.setText('stat-load-today', this.getState(ent.load_daily).toFixed(2));
    this.setText('stat-load-total', this.getState(ent.load_total).toFixed(2));
    
    this.setText('stat-bat-c-today', this.getState(ent.battery_charge_daily).toFixed(2));
    this.setText('stat-bat-c-total', this.getState(ent.battery_charge_total).toFixed(2));
    this.setText('stat-bat-d-today', this.getState(ent.battery_discharge_daily).toFixed(2));
    this.setText('stat-bat-d-total', this.getState(ent.battery_discharge_total).toFixed(2));

    this.setText('stat-grid-b-today', this.getState(ent.grid_buy_daily).toFixed(2));
    this.setText('stat-grid-b-total', this.getState(ent.grid_buy_total).toFixed(2));
    this.setText('stat-grid-s-today', this.getState(ent.grid_sell_daily).toFixed(2));
    this.setText('stat-grid-s-total', this.getState(ent.grid_sell_total).toFixed(2));

    // 9. Trạng thái Pin & Đồ họa
    const isCharging = batP > 5;
    const isDischarging = batP < -5;

    this.setText('txt-bat-p', Math.abs(batP));
    this.setText('txt-bat-v', batV.toFixed(1));

    const lblBatMode = this.shadowRoot.getElementById('lbl-bat-mode');
    if (lblBatMode) {
      if (isCharging) lblBatMode.textContent = "Đang sạc";
      else if (isDischarging) lblBatMode.textContent = "Đang xả";
      else {
        if (soc >= 100) lblBatMode.textContent = "Pin đầy";
        else if (soc >= 20) lblBatMode.textContent = "Chờ sạc / xả";
        else lblBatMode.textContent = "Pin yếu";
      }
    }

    const batFill = this.shadowRoot.getElementById('bat-fill');
    const maxH = 39.0;
    const h = Math.max(1, (soc / 100) * maxH);
    if (batFill) {
      batFill.setAttribute('height', h);
      batFill.setAttribute('y', 8 + (maxH - h));
    }

    let batColor = '#16a34a';
    if (soc <= 20) batColor = '#dc2626';
    else if (soc <= 40) batColor = '#ea580c';

    this.setText('txt-soc-val', soc);
    const txtSoc = this.shadowRoot.getElementById('txt-soc-val');
    if (txtSoc) txtSoc.setAttribute('fill', batColor);
    if (batFill) batFill.setAttribute('fill', batColor);

    // 10. Luồng điện
    const loadIconColor = isGridConnected ? '#16a34a' : (loadP > 0 ? '#e11d48' : '#94a3b8');
    const loadIcons = this.shadowRoot.querySelectorAll('.load-icon-color');
    loadIcons.forEach(icon => icon.setAttribute('fill', loadIconColor));

    this.setFlowVisible('flow-pv', pvP > 5);
    this.setFlowVisible('flow-ac-pv', alwaysShowAcPv && acPvP > 5);
    this.setFlowVisible('flow-eps', epsP > 5);
    this.setFlowVisible('flow-bus-to-load', isGridConnected && loadP > 5);

    this.setFlowVisible('flow-bat-charge', isCharging);
    this.setFlowVisible('flow-bat-discharge', isDischarging);

    const invLed = this.shadowRoot.getElementById('inv-led');
    if (invLed) invLed.setAttribute('fill', isGridConnected ? '#16a34a' : '#dc2626');

    const isImporting = isGridConnected && gridP < -5;
    const isExporting = isGridConnected && gridP > 5;

    this.setFlowVisible('flow-grid-import', isImporting);
    this.setFlowVisible('flow-grid-export', isExporting);

    const invGeneratingPower = pvP + (isDischarging ? Math.abs(batP) : 0);

    if (!isGridConnected) {
      this.setFlowVisible('flow-inv-to-bus', false);
      this.setFlowVisible('flow-bus-to-inv', false);
    } else {
      this.setFlowVisible('flow-inv-to-bus', invGeneratingPower > 5);
      this.setFlowVisible('flow-bus-to-inv', isImporting && isCharging);
    }

    const acNode = this.shadowRoot.getElementById('ac-bus-node');
    if (acNode) acNode.setAttribute('fill', isGridConnected ? '#16a34a' : '#0284c7');

    this.setText('txt-grid-p', Math.abs(gridP));
    this.setText('txt-grid-v', gridV.toFixed(1));
    this.setText('txt-grid-f', gridF.toFixed(2));

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

              <!-- Khối PV -->
              <g id="grp-pv" transform="translate(48, 2)">
                <g id="grp-pv1">
                  <g id="line-pv1-p">
                    <text x="0" y="0" font-size="12.5" font-weight="800" fill="#0f172a" id="txt-pv1-p">0</text>
                    <text x="28" y="0" class="unit-lbl">W</text>
                  </g>
                  <g id="line-pv1-v">
                    <text x="46" y="0" font-size="12.5" font-weight="800" fill="#0f172a" id="txt-pv1-v">0.0</text>
                    <text x="82" y="0" class="unit-lbl">V</text>
                  </g>
                </g>

                <g id="grp-pv2">
                  <g id="line-pv2-p">
                    <text x="0" y="0" font-size="12.5" font-weight="800" fill="#0f172a" id="txt-pv2-p">0</text>
                    <text x="28" y="0" class="unit-lbl">W</text>
                  </g>
                  <g id="line-pv2-v">
                    <text x="46" y="0" font-size="12.5" font-weight="800" fill="#0f172a" id="txt-pv2-v">0.0</text>
                    <text x="82" y="0" class="unit-lbl">V</text>
                  </g>
                </g>

                <g id="grp-pv3">
                  <g id="line-pv3-p">
                    <text x="0" y="0" font-size="12.5" font-weight="800" fill="#0f172a" id="txt-pv3-p">0</text>
                    <text x="28" y="0" class="unit-lbl">W</text>
                  </g>
                  <g id="line-pv3-v">
                    <text x="46" y="0" font-size="12.5" font-weight="800" fill="#0f172a" id="txt-pv3-v">0.0</text>
                    <text x="82" y="0" class="unit-lbl">V</text>
                  </g>
                </g>

                <g id="grp-pv4">
                  <g id="line-pv4-p">
                    <text x="0" y="0" font-size="12.5" font-weight="800" fill="#0f172a" id="txt-pv4-p">0</text>
                    <text x="28" y="0" class="unit-lbl">W</text>
                  </g>
                  <g id="line-pv4-v">
                    <text x="46" y="0" font-size="12.5" font-weight="800" fill="#0f172a" id="txt-pv4-v">0.0</text>
                    <text x="82" y="0" class="unit-lbl">V</text>
                  </g>
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

                <text x="-6" y="31" text-anchor="end">
                  <tspan id="txt-bat-v" class="highlight-val">0.0</tspan><tspan class="unit-lbl" dx="1.5">V</tspan>
                </text>
                <text x="-6" y="44" text-anchor="end">
                  <tspan id="txt-soc-val" font-size="13px" font-weight="bold" fill="#16a34a">0</tspan><tspan class="unit-lbl" dx="1" fill="#16a34a">%</tspan>
                </text>
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
                <text x="36" y="32">
                  <tspan id="txt-grid-v" class="highlight-val">0.0</tspan><tspan class="unit-lbl" dx="1.5">V</tspan>
                </text>
                <text x="36" y="43">
                  <tspan id="txt-grid-f" class="highlight-freq">0.00</tspan><tspan class="unit-lbl" dx="1.5">Hz</tspan>
                </text>
              </g>

              <g id="grp-eps" transform="translate(134, 172)">
                <svg width="32" height="32" viewBox="0 0 30 30">
                  <rect x="3" y="7" width="18" height="16" rx="2" fill="none" stroke="#16a34a" stroke-width="2.8"/>
                  <path d="M8 1V7 M16 1V7 M12 23V29" stroke="#16a34a" stroke-width="2.8"/>
                  <circle cx="24" cy="15" r="5" fill="none" stroke="#16a34a" stroke-width="2.2"/>
                  <path d="M22 15H26" stroke="#16a34a" stroke-width="2.2"/>
                </svg>

                <g id="grp-eps-1p">
                  <text x="38" y="12">
                    <tspan id="txt-eps-p" class="svg-txt-bold">0</tspan><tspan class="unit-lbl" dx="1.5">W</tspan>
                  </text>
                </g>

                <g id="grp-eps-3p" style="display:none;">
                  <text x="38" y="10"><tspan id="txt-eps-l1" class="svg-txt-bold">0</tspan><tspan class="unit-lbl" dx="1.5">W</tspan></text>
                  <text x="38" y="22"><tspan id="txt-eps-l2" class="svg-txt-bold">0</tspan><tspan class="unit-lbl" dx="1.5">W</tspan></text>
                  <text x="38" y="34"><tspan id="txt-eps-l3" class="svg-txt-bold">0</tspan><tspan class="unit-lbl" dx="1.5">W</tspan></text>
                </g>

                <text x="38" y="23" id="line-eps-v">
                  <tspan id="txt-eps-v" class="highlight-val">0.0</tspan><tspan class="unit-lbl" dx="1.5">V</tspan>
                </text>
                <text x="38" y="34" id="line-eps-f">
                  <tspan id="txt-eps-f" class="highlight-freq">0.00</tspan><tspan class="unit-lbl" dx="1.5">Hz</tspan>
                </text>

                <text x="38" y="44" id="lbl-eps-sub" class="svg-txt-sub">Công suất dự phòng</text>
                <text x="38" y="54" id="lbl-eps-standby" style="font-size: 9px; fill: #16a34a; font-weight: 800; display: none;">Chế độ chờ</text>
              </g>

              <g transform="translate(273, 175)">
                <svg width="32" height="32" viewBox="0 0 30 30">
                  <rect x="7" y="5" width="2.5" height="5" class="load-icon-color" fill="#16a34a"/>
                  <path d="M 3 13 L 15 3 L 27 13 V 26 C 27 26.8 26.3 27.5 25.5 27.5 H 4.5 C 3.7 27.5 3 26.8 3 26 Z" class="load-icon-color" fill="#16a34a"/>
                  <polygon points="16,8 11.5,15 15,15 14,22 18.5,15 15,15" fill="#ffffff"/>
                </svg>

                <g id="grp-load-1p">
                  <text x="36" y="13">
                    <tspan id="txt-load-p" class="svg-txt-bold">0</tspan><tspan class="unit-lbl" dx="1.5">W</tspan>
                  </text>
                  <text x="36" y="26" class="svg-txt-sub">Tiêu thụ</text>
                </g>

                <g id="grp-load-3p" style="display:none;">
                  <text x="36" y="10"><tspan id="txt-load-l1" class="svg-txt-bold">0</tspan><tspan class="unit-lbl" dx="1.5">W</tspan></text>
                  <text x="36" y="22"><tspan id="txt-load-l2" class="svg-txt-bold">0</tspan><tspan class="unit-lbl" dx="1.5">W</tspan></text>
                  <text x="36" y="34"><tspan id="txt-load-l3" class="svg-txt-bold">0</tspan><tspan class="unit-lbl" dx="1.5">W</tspan></text>
                  <text x="36" y="46" class="svg-txt-sub">Tiêu thụ</text>
                </g>
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
  description: "Sơ đồ luồng năng lượng cho Inverter Hybrid (Hỗ trợ 1 pha và 3 pha)"
});