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

  getEl(id) {
    return this.shadowRoot.getElementById(id);
  }

  setDisplay(id, visible) {
    const el = typeof id === 'string' ? this.getEl(id) : id;
    if (el) el.style.display = visible ? 'inline' : 'none';
  }

  setText(id, text) {
    const el = this.getEl(id);
    if (el) el.textContent = text;
  }

  getState(entityId, defaultVal = 0) {
    if (!entityId || !this._hass || !this._hass.states[entityId]) return defaultVal;
    const val = parseFloat(this._hass.states[entityId].state);
    return isNaN(val) ? defaultVal : val;
  }

  setFlowVisible(id, visible) {
    this.setDisplay(id, visible);
  }

  alignTextStack(elements, centerY, lineHeight = 12, baselineOffset = 3.5) {
    const visible = elements.filter(el => el && el.style.display !== 'none');
    const numLines = visible.length;
    if (numLines === 0) return;

    const startY = centerY - ((numLines - 1) * lineHeight) / 2 + baselineOffset;
    visible.forEach((el, idx) => {
      el.setAttribute('y', startY + idx * lineHeight);
    });
  }

  updateData() {
    if (!this._hass || !this.config) return;

    const ent = this.config.entities;
    const isTrue = (val) => val === true || String(val).toLowerCase() === 'true';

    // 0. Chế độ 1 Pha hay 3 Pha
    const configThreePhase = this.config?.three_phase ?? ent?.three_phase;
    const isThreePhase = configThreePhase !== undefined
      ? isTrue(configThreePhase)
      : Boolean(ent?.load_power_l1 || ent?.grid_power_l1 || ent?.eps_power_l1 || ent?.ac_pv_power_l1);

    // 1. Thời gian LCD Inverter
    let latestDate = null;
    if (ent) {
      Object.values(ent).forEach(eId => {
        if (typeof eId === 'string' && this._hass?.states[eId]?.last_updated) {
          const d = new Date(this._hass.states[eId].last_updated);
          if (!latestDate || d > latestDate) latestDate = d;
        }
      });
    }

    if (latestDate) {
      const timeFormatted = [
        latestDate.getHours(),
        latestDate.getMinutes(),
        latestDate.getSeconds()
      ].map(n => String(n).padStart(2, '0')).join(':');
      this.setText('inv-lcd-time', timeFormatted);
    }

    // 2. Dữ liệu PV (DC)
    let pvP = 0;
    const activePvGroups = [];

    [1, 2, 3, 4].forEach(i => {
      const pId = ent[`pv${i}_power`];
      const vId = ent[`pv${i}_voltage`];

      const hasP = Boolean(pId && this._hass?.states[pId] !== undefined);
      const hasV = Boolean(vId && this._hass?.states[vId] !== undefined);

      const pVal = hasP ? Math.abs(Math.round(this.getState(pId))) : 0;
      const vVal = hasV ? this.getState(vId, 0) : 0;

      if (hasP) pvP += pVal;

      const showP = hasP && pVal > 0;
      const showV = hasV && vVal > 0;

      this.setDisplay(`line-pv${i}-p`, showP);
      this.setDisplay(`line-pv${i}-v`, showV);

      if (showP) this.setText(`txt-pv${i}-p`, pVal);
      if (showV) this.setText(`txt-pv${i}-v`, vVal.toFixed(1));

      const grp = this.getEl(`grp-pv${i}`);
      if (grp) {
        if (showP || showV) {
          grp.style.display = 'inline';
          activePvGroups.push(grp);
        } else {
          grp.style.display = 'none';
        }
      }
    });

    const pvNumLines = activePvGroups.length;
    if (pvNumLines > 0) {
      const startPvY = 8 - ((pvNumLines - 1) * 14) / 2;
      activePvGroups.forEach((grp, idx) => {
        grp.setAttribute('transform', `translate(0, ${startPvY + idx * 14})`);
      });
    }

    // 3. PV Hòa Lưới / AC PV
    const alwaysShowAcPv = isTrue(this.config?.always_show_ac_pv) || isTrue(ent?.always_show_ac_pv);
    let acPvP = 0;

    if (isThreePhase) {
      const acPvL1 = Math.abs(Math.round(this.getState(ent.ac_pv_power_l1, 0)));
      const acPvL2 = Math.abs(Math.round(this.getState(ent.ac_pv_power_l2, 0)));
      const acPvL3 = Math.abs(Math.round(this.getState(ent.ac_pv_power_l3, 0)));

      acPvP = (ent.ac_pv_power_l1 || ent.ac_pv_power_l2 || ent.ac_pv_power_l3)
        ? (acPvL1 + acPvL2 + acPvL3)
        : Math.abs(Math.round(this.getState(ent.ac_pv_power, 0)));

      this.setText('txt-ac-pv-l1', acPvL1);
      this.setText('txt-ac-pv-l2', acPvL2);
      this.setText('txt-ac-pv-l3', acPvL3);
    } else {
      acPvP = Math.abs(Math.round(this.getState(ent.ac_pv_power, 0)));
      this.setText('txt-ac-pv-p', acPvP);
    }

    const acPvV = this.getState(ent.ac_pv_voltage, 0.0);
    const acPvF = this.getState(ent.ac_pv_frequency, 0.0);

    const hasAcPvP = Boolean((ent.ac_pv_power || ent.ac_pv_power_l1 || ent.ac_pv_power_l2 || ent.ac_pv_power_l3) && acPvP > 0);
    const hasAcPvV = Boolean(ent.ac_pv_voltage && this._hass?.states[ent.ac_pv_voltage] !== undefined);
    const hasAcPvF = hasAcPvV && Boolean(ent.ac_pv_frequency && this._hass?.states[ent.ac_pv_frequency] !== undefined);

    this.setDisplay('grp-pv-ac', alwaysShowAcPv || hasAcPvP);

    const showAcPvV = hasAcPvV && acPvV > 0;
    const showAcPvF = hasAcPvF && acPvF > 0;

    if (showAcPvV) this.setText('txt-ac-pv-v', acPvV.toFixed(1));
    if (showAcPvF) this.setText('txt-ac-pv-f', acPvF.toFixed(2));

    const acPvElements = [];
    if (isThreePhase) {
      this.setDisplay('line-ac-pv-1p', false);
      this.setDisplay('line-ac-pv-l1', true);
      this.setDisplay('line-ac-pv-l2', true);
      this.setDisplay('line-ac-pv-l3', true);
      acPvElements.push(this.getEl('line-ac-pv-l1'), this.getEl('line-ac-pv-l2'), this.getEl('line-ac-pv-l3'));
    } else {
      this.setDisplay('line-ac-pv-1p', true);
      this.setDisplay('line-ac-pv-l1', false);
      this.setDisplay('line-ac-pv-l2', false);
      this.setDisplay('line-ac-pv-l3', false);
      acPvElements.push(this.getEl('line-ac-pv-1p'));
    }

    this.setDisplay('line-ac-pv-v', showAcPvV);
    if (showAcPvV) acPvElements.push(this.getEl('line-ac-pv-v'));

    this.setDisplay('line-ac-pv-f', showAcPvF);
    if (showAcPvF) acPvElements.push(this.getEl('line-ac-pv-f'));

    this.alignTextStack(acPvElements, 9.5, 12, 3.5);

    // 4. Điện Lưới
    let gridP = 0;
    let rawGridV = 0.0;
    let rawGridF = 0.0;

    if (isThreePhase) {
      const gridL1 = Math.round(this.getState(ent.grid_power_l1, 0));
      const gridL2 = Math.round(this.getState(ent.grid_power_l2, 0));
      const gridL3 = Math.round(this.getState(ent.grid_power_l3, 0));

      this.setText('txt-grid-l1', gridL1);
      this.setText('txt-grid-l2', gridL2);
      this.setText('txt-grid-l3', gridL3);

      gridP = (ent.grid_power_l1 || ent.grid_power_l2 || ent.grid_power_l3)
        ? (gridL1 + gridL2 + gridL3)
        : Math.round(this.getState(ent.grid_power, 0));

      rawGridV = this.getState(ent.grid_voltage_l1, this.getState(ent.grid_voltage, 0.0));
      rawGridF = this.getState(ent.grid_frequency_l1, this.getState(ent.grid_frequency, 0.0));
    } else {
      gridP = Math.round(this.getState(ent.grid_power, 0));
      rawGridV = this.getState(ent.grid_voltage, 0.0);
      rawGridF = this.getState(ent.grid_frequency, 0.0);
      this.setText('txt-grid-p', Math.abs(gridP));
    }

    const invertGrid = isTrue(this.config?.invert_grid_power) || isTrue(ent?.invert_grid_power);
    if (invertGrid) gridP = -gridP;

    const isGridConnected = rawGridV > 50;
    const gridV = isGridConnected ? rawGridV : 0.0;
    const gridF = isGridConnected ? rawGridF : 0.0;

    this.setText('txt-grid-v', gridV.toFixed(1));
    this.setText('txt-grid-f', gridF.toFixed(2));

    const showGridV = isGridConnected && gridV > 0;
    const showGridF = isGridConnected && gridF > 0;

    const gridElements = [];
    if (isThreePhase) {
      this.setDisplay('line-grid-1p', false);
      this.setDisplay('line-grid-l1', true);
      this.setDisplay('line-grid-l2', true);
      this.setDisplay('line-grid-l3', true);
      gridElements.push(this.getEl('line-grid-l1'), this.getEl('line-grid-l2'), this.getEl('line-grid-l3'));
    } else {
      this.setDisplay('line-grid-1p', true);
      this.setDisplay('line-grid-l1', false);
      this.setDisplay('line-grid-l2', false);
      this.setDisplay('line-grid-l3', false);
      gridElements.push(this.getEl('line-grid-1p'));
    }

    gridElements.push(this.getEl('lbl-grid-mode'));

    this.setDisplay('line-grid-v', showGridV);
    if (showGridV) gridElements.push(this.getEl('line-grid-v'));

    this.setDisplay('line-grid-f', showGridF);
    if (showGridF) gridElements.push(this.getEl('line-grid-f'));

    this.alignTextStack(gridElements, 20, 12, 3.5);

    // 5. Tải tiêu thụ
    let loadP = 0;
    if (isThreePhase) {
      const loadL1 = Math.abs(Math.round(this.getState(ent.load_power_l1, 0)));
      const loadL2 = Math.abs(Math.round(this.getState(ent.load_power_l2, 0)));
      const loadL3 = Math.abs(Math.round(this.getState(ent.load_power_l3, 0)));

      loadP = (ent.load_power_l1 || ent.load_power_l2 || ent.load_power_l3)
        ? (loadL1 + loadL2 + loadL3)
        : Math.abs(Math.round(this.getState(ent.load_power, 0)));

      this.setText('txt-load-l1', loadL1);
      this.setText('txt-load-l2', loadL2);
      this.setText('txt-load-l3', loadL3);
    } else {
      loadP = Math.abs(Math.round(this.getState(ent.load_power, 0)));
      this.setText('txt-load-p', loadP);
    }

    const loadElements = [];
    if (isThreePhase) {
      this.setDisplay('line-load-1p', false);
      this.setDisplay('line-load-l1', true);
      this.setDisplay('line-load-l2', true);
      this.setDisplay('line-load-l3', true);
      loadElements.push(this.getEl('line-load-l1'), this.getEl('line-load-l2'), this.getEl('line-load-l3'));
    } else {
      this.setDisplay('line-load-1p', true);
      this.setDisplay('line-load-l1', false);
      this.setDisplay('line-load-l2', false);
      this.setDisplay('line-load-l3', false);
      loadElements.push(this.getEl('line-load-1p'));
    }
    loadElements.push(this.getEl('lbl-load-sub'));

    this.alignTextStack(loadElements, 19, 12, 3.5);

    // 6. EPS
    let epsP = 0;
    if (isThreePhase) {
      const epsL1 = Math.abs(Math.round(this.getState(ent.eps_power_l1, 0)));
      const epsL2 = Math.abs(Math.round(this.getState(ent.eps_power_l2, 0)));
      const epsL3 = Math.abs(Math.round(this.getState(ent.eps_power_l3, 0)));

      epsP = (ent.eps_power_l1 || ent.eps_power_l2 || ent.eps_power_l3)
        ? (epsL1 + epsL2 + epsL3)
        : Math.abs(Math.round(this.getState(ent.eps_power, 0)));

      this.setText('txt-eps-l1', epsL1);
      this.setText('txt-eps-l2', epsL2);
      this.setText('txt-eps-l3', epsL3);
    } else {
      epsP = Math.abs(Math.round(this.getState(ent.eps_power, 0)));
      this.setText('txt-eps-p', epsP);
    }

    const hasEpsV = Boolean(ent.eps_voltage && this._hass?.states[ent.eps_voltage] !== undefined);
    const hasEpsF = hasEpsV && Boolean(ent.eps_frequency && this._hass?.states[ent.eps_frequency] !== undefined);

    const epsV = hasEpsV ? this.getState(ent.eps_voltage, 0.0) : 0;
    const epsF = hasEpsF ? this.getState(ent.eps_frequency, 0.0) : 0;

    const showEpsV = hasEpsV && epsV > 0;
    const showEpsF = hasEpsF && epsF > 0;

    if (showEpsV) this.setText('txt-eps-v', epsV.toFixed(1));
    if (showEpsF) this.setText('txt-eps-f', epsF.toFixed(2));

    const epsElements = [];
    if (isThreePhase) {
      this.setDisplay('line-eps-1p', false);
      this.setDisplay('line-eps-l1', true);
      this.setDisplay('line-eps-l2', true);
      this.setDisplay('line-eps-l3', true);
      epsElements.push(this.getEl('line-eps-l1'), this.getEl('line-eps-l2'), this.getEl('line-eps-l3'));
    } else {
      this.setDisplay('line-eps-1p', true);
      this.setDisplay('line-eps-l1', false);
      this.setDisplay('line-eps-l2', false);
      this.setDisplay('line-eps-l3', false);
      epsElements.push(this.getEl('line-eps-1p'));
    }

    this.setDisplay('line-eps-v', showEpsV);
    if (showEpsV) epsElements.push(this.getEl('line-eps-v'));

    this.setDisplay('line-eps-f', showEpsF);
    if (showEpsF) epsElements.push(this.getEl('line-eps-f'));

    this.alignTextStack(epsElements, 19, 12, 3.5);

    const showStandby = isGridConnected && (epsP === 0);
    this.setDisplay('lbl-eps-standby', showStandby);

    // 7. Pin Lưu Trữ
    let batP = Math.round(this.getState(ent.battery_power, 0));
    const batV = this.getState(ent.battery_voltage, 0);
    const soc = Math.round(this.getState(ent.battery_soc, 0));

    const invertBat = isTrue(this.config?.invert_battery_power) || isTrue(ent?.invert_battery_power);
    if (invertBat) batP = -batP;

    const isCharging = batP > 5;
    const isDischarging = batP < -5;

    this.setText('txt-bat-p', Math.abs(batP));
    this.setText('txt-bat-v', batV.toFixed(1));

    const lblBatMode = this.getEl('lbl-bat-mode');
    if (lblBatMode) {
      if (isCharging) lblBatMode.textContent = "Đang sạc";
      else if (isDischarging) lblBatMode.textContent = "Đang xả";
      else {
        if (soc >= 100) lblBatMode.textContent = "Pin đầy";
        else if (soc >= 20) lblBatMode.textContent = "Chờ sạc / xả";
        else lblBatMode.textContent = "Pin yếu";
      }
    }

    const showBatV = batV > 0;
    this.setDisplay('line-bat-v', showBatV);

    const batElements = [
      this.getEl('line-bat-p'),
      this.getEl('lbl-bat-mode'),
      ...(showBatV ? [this.getEl('line-bat-v')] : []),
      this.getEl('line-bat-soc')
    ];

    this.alignTextStack(batElements, 29, 12, 3.5);

    const batFill = this.getEl('bat-fill');
    const maxH = 43.0;
    const h = Math.max(1, (soc / 100) * maxH);
    if (batFill) {
      batFill.setAttribute('height', h);
      batFill.setAttribute('y', 7 + (maxH - h));
    }

    let batColor = '#16a34a';
    if (soc <= 20) batColor = '#dc2626';
    else if (soc <= 40) batColor = '#ea580c';

    this.setText('txt-soc-val', soc);
    const txtSoc = this.getEl('txt-soc-val');
    if (txtSoc) txtSoc.setAttribute('fill', batColor);
    if (batFill) batFill.setAttribute('fill', batColor);

    // 8. Thống kê năng lượng dạng kWh
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

    // 9. Luồng Năng Lượng
    const isImporting = isGridConnected && gridP < -5;
    const isExporting = isGridConnected && gridP > 5;

    const hasLoadPower = loadP > 5;
    const hasEpsPower = epsP > 5;
    const hasAcPvPower = hasAcPvP && acPvP > 5;
    const hasPvPower = pvP > 5;
    const isBatActive = isCharging || isDischarging;

    let showPvFlow = false;
    if (hasPvPower) {
      if (!isGridConnected) {
        showPvFlow = hasEpsPower || isBatActive;
      } else {
        showPvFlow = isCharging || isBatActive || hasLoadPower || hasEpsPower || isExporting;
      }
    }

    // Cập nhật màu động cho icon tải tiêu thụ (fill & stroke)
    const loadIconColor = isGridConnected ? '#52b788' : (hasLoadPower ? '#e11d48' : '#94a3b8');
    const loadIcons = this.shadowRoot.querySelectorAll('#icon-load .load-icon-color');
    loadIcons.forEach(icon => icon.setAttribute('fill', loadIconColor));
    const loadStrokes = this.shadowRoot.querySelectorAll('#icon-load .load-icon-stroke');
    loadStrokes.forEach(icon => icon.setAttribute('stroke', loadIconColor));

    const showAcPvFlow = hasAcPvPower && (
      isGridConnected 
        ? (hasLoadPower || isExporting || isCharging) 
        : (hasEpsPower || isCharging)
    );

    this.setFlowVisible('flow-pv', showPvFlow);
    this.setFlowVisible('flow-ac-pv', showAcPvFlow);
    this.setFlowVisible('flow-bat-charge', isCharging);
    this.setFlowVisible('flow-bat-discharge', isDischarging);

    const showLoadFlow = isGridConnected && hasLoadPower;
    this.setFlowVisible('flow-bus-to-load', showLoadFlow);
    this.setFlowVisible('flow-eps', hasEpsPower);

    this.setFlowVisible('flow-grid-import', isImporting);
    this.setFlowVisible('flow-grid-export', isExporting);

    if (isGridConnected) {
      const invNetPower = pvP - batP;
      const hasAcDemand = hasLoadPower || isExporting;

      if (invNetPower > 5 && hasAcDemand) {
        this.setFlowVisible('flow-inv-to-bus', true);
        this.setFlowVisible('flow-bus-to-inv', false);
      } else if (invNetPower < -5 && (isImporting || isDischarging)) {
        this.setFlowVisible('flow-inv-to-bus', false);
        this.setFlowVisible('flow-bus-to-inv', true);
      } else {
        this.setFlowVisible('flow-inv-to-bus', false);
        this.setFlowVisible('flow-bus-to-inv', false);
      }
    } else {
      if (hasAcPvPower && (isCharging || hasEpsPower)) {
        this.setFlowVisible('flow-inv-to-bus', false);
        this.setFlowVisible('flow-bus-to-inv', true);
      } else {
        this.setFlowVisible('flow-inv-to-bus', false);
        this.setFlowVisible('flow-bus-to-inv', false);
      }
    }

    const invLed = this.getEl('inv-led');
    if (invLed) invLed.setAttribute('fill', isGridConnected ? '#16a34a' : '#dc2626');

    const acNode = this.getEl('ac-bus-node');
    if (acNode) acNode.setAttribute('fill', isGridConnected ? '#16a34a' : '#0284c7');

    const lblGridMode = this.getEl('lbl-grid-mode');
    const pill = this.getEl('sys-status-pill');
    const pillTxt = this.getEl('sys-status-text');

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
        :host { display: block; width: 100%; aspect-ratio: 480 / 408; box-sizing: border-box; -webkit-text-size-adjust: 100%; -webkit-font-smoothing: antialiased; }
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
        .diagram-svg { width: 100%; height: auto; aspect-ratio: 480 / 408; display: block; overflow: visible; }
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
                    <g stroke="#52b788" stroke-width="4.5" stroke-linecap="round" fill="none">
                      <circle cx="34" cy="34" r="14" />
                      <line x1="34" y1="12" x2="34" y2="5" />
                      <line x1="18" y1="18" x2="13" y2="13" />
                      <line x1="12" y1="34" x2="5" y2="34" />
                      <line x1="18" y1="50" x2="13" y2="55" />
                      <line x1="50" y1="18" x2="55" y2="13" />
                      <line x1="56" y1="34" x2="63" y2="34" />
                    </g>
                    <polygon points="32,42 86,42 96,86 18,86" fill="#52b788" stroke="#52b788" stroke-width="4" stroke-linejoin="round"/>
                    <g stroke="#ffffff" stroke-width="2.5" stroke-linecap="round" opacity="0.9">
                      <line x1="28.5" y1="53" x2="88.5" y2="53" />
                      <line x1="25" y1="64" x2="91" y2="64" />
                      <line x1="21.5" y1="75" x2="93.5" y2="75" />
                      <line x1="45.5" y1="42" x2="37.5" y2="86" />
                      <line x1="59" y1="42" x2="57" y2="86" />
                      <line x1="72.5" y1="42" x2="76.5" y2="86" />
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
                  <svg width="26" height="26" viewBox="0 0 100 100">
                    <rect x="27" y="14" width="10" height="20" rx="1" fill="#52b788"/>
                    <path d="M 10 50 L 50 21 L 90 50" fill="none" stroke="#52b788" stroke-width="10" stroke-linecap="round" stroke-linejoin="round"/>
                    <path d="M 50 29.5 L 82 52.5 L 82 85 C 82 86.5 80.5 88 79 88 L 21 88 C 19.5 88 18 86.5 18 85 L 18 52.5 Z" fill="#52b788"/>
                    <polygon points="52,45.5 42,60.5 49.5,60.5 46.5,78.5 58,59.5 50.5,59.5" fill="#ffffff"/>
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
                    <rect x="5" y="6" width="20" height="30" rx="3" fill="#52b788"/>
                    <rect x="11" y="2" width="8" height="4" rx="1" fill="#52b788"/>
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
                  <svg width="24" height="28" viewBox="0 0 100 160">
                    <g fill="none" stroke="#50b984" stroke-linecap="round" stroke-linejoin="round">
                      <path d="M 50,6 L 18,152 M 50,6 L 82,152" stroke-width="7" />
                      <path d="M 22,42 L 78,42" stroke-width="7" />
                      <path d="M 22,46 L 78,46" stroke-width="4.5" />
                      <circle cx="20" cy="50" r="4" fill="#50b984" />
                      <circle cx="80" cy="50" r="4" fill="#50b984" />
                      <path d="M 10,72 L 90,72" stroke-width="8" />
                      <path d="M 10,77 L 90,77" stroke-width="4.5" />
                      <circle cx="8" cy="82" r="4.5" fill="#50b984" />
                      <circle cx="92" cy="82" r="4.5" fill="#50b984" />
                      <line x1="43" y1="24" x2="57" y2="24" stroke-width="4.5" />
                      <line x1="38" y1="42" x2="62" y2="42" stroke-width="4.5" />
                      <line x1="33" y1="72" x2="67" y2="72" stroke-width="4.5" />
                      <line x1="29" y1="95" x2="71" y2="95" stroke-width="4.5" />
                      <line x1="25" y1="118" x2="75" y2="118" stroke-width="5" />
                      <line x1="19" y1="138" x2="81" y2="138" stroke-width="6" />
                      <line x1="43" y1="24" x2="57" y2="42" stroke-width="3.5" />
                      <line x1="57" y1="24" x2="43" y2="42" stroke-width="3.5" />
                      <line x1="38" y1="42" x2="67" y2="72" stroke-width="3.5" />
                      <line x1="62" y1="42" x2="33" y2="72" stroke-width="3.5" />
                      <line x1="33" y1="72" x2="71" y2="95" stroke-width="3.5" />
                      <line x1="67" y1="72" x2="29" y2="95" stroke-width="3.5" />
                      <line x1="29" y1="95" x2="75" y2="118" stroke-width="3.5" />
                      <line x1="71" y1="95" x2="25" y2="118" stroke-width="3.5" />
                      <line x1="25" y1="118" x2="79" y2="138" stroke-width="4.5" />
                      <line x1="75" y1="118" x2="21" y2="138" stroke-width="4.5" />
                      <path d="M 18,152 L 50,138 L 82,152" stroke-width="5" />
                    </g>
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
                <path id="chv-block-r" d="M 0,0 L 8.5,0 L 12,5 L 8.5,10 L 0,10 L 3.5,5 Z"/>
                <path id="chv-block-l" d="M 12,0 L 3.5,0 L 0,5 L 3.5,10 L 12,10 L 8.5,5 Z"/>
                <path id="chv-block-d" d="M 0,0 L 5,3.5 L 10,0 L 10,8.5 L 5,12 L 0,8.5 Z"/>
                <path id="chv-block-u" d="M 5,0 L 10,3.5 L 10,12 L 5,8.5 L 0,12 L 0,3.5 Z"/>
              </defs>

              <g id="flow-pv">
                <use href="#chv-block-d" x="166" y="28" class="chv-block" style="animation-delay: 0.00s;" />
                <use href="#chv-block-d" x="166" y="41" class="chv-block" style="animation-delay: 0.35s;" />
                <use href="#chv-block-d" x="166" y="54" class="chv-block" style="animation-delay: 0.70s;" />
              </g>

              <g id="flow-ac-pv">
                <use href="#chv-block-d" x="275" y="42" class="chv-block" style="animation-delay: 0.00s;" />
                <use href="#chv-block-d" x="275" y="56" class="chv-block" style="animation-delay: 0.22s;" />
                <use href="#chv-block-d" x="275" y="70" class="chv-block" style="animation-delay: 0.44s;" />
                <use href="#chv-block-d" x="275" y="84" class="chv-block" style="animation-delay: 0.66s;" />
              </g>

              <g id="flow-eps">
                <use href="#chv-block-d" x="166" y="136" class="chv-block" style="animation-delay: 0.00s;" />
                <use href="#chv-block-d" x="166" y="148" class="chv-block" style="animation-delay: 0.35s;" />
                <use href="#chv-block-d" x="166" y="160" class="chv-block" style="animation-delay: 0.70s;" />
              </g>

              <g id="flow-bus-to-load">
                <use href="#chv-block-d" x="275" y="114" class="chv-block" style="animation-delay: 0.00s;" />
                <use href="#chv-block-d" x="275" y="128" class="chv-block" style="animation-delay: 0.25s;" />
                <use href="#chv-block-d" x="275" y="142" class="chv-block" style="animation-delay: 0.50s;" />
                <use href="#chv-block-d" x="275" y="156" class="chv-block" style="animation-delay: 0.75s;" />
              </g>

              <g id="flow-bat-discharge">
                <use href="#chv-block-r" x="82"  y="98" class="chv-block" style="animation-delay: 0.00s;" />
                <use href="#chv-block-r" x="96"  y="98" class="chv-block" style="animation-delay: 0.25s;" />
                <use href="#chv-block-r" x="110" y="98" class="chv-block" style="animation-delay: 0.50s;" />
                <use href="#chv-block-r" x="124" y="98" class="chv-block" style="animation-delay: 0.75s;" />
              </g>

              <g id="flow-bat-charge">
                <use href="#chv-block-l" x="124" y="98" class="chv-block" style="animation-delay: 0.00s;" />
                <use href="#chv-block-l" x="110" y="98" class="chv-block" style="animation-delay: 0.25s;" />
                <use href="#chv-block-l" x="96"  y="98" class="chv-block" style="animation-delay: 0.50s;" />
                <use href="#chv-block-l" x="82"  y="98" class="chv-block" style="animation-delay: 0.75s;" />
              </g>

              <g id="flow-inv-to-bus">
                <use href="#chv-block-r" x="204" y="98" class="chv-block" style="animation-delay: 0.00s;" />
                <use href="#chv-block-r" x="218" y="98" class="chv-block" style="animation-delay: 0.25s;" />
                <use href="#chv-block-r" x="232" y="98" class="chv-block" style="animation-delay: 0.50s;" />
                <use href="#chv-block-r" x="246" y="98" class="chv-block" style="animation-delay: 0.75s;" />
                <use href="#chv-block-r" x="260" y="98" class="chv-block" style="animation-delay: 1.00s;" />
              </g>

              <g id="flow-bus-to-inv">
                <use href="#chv-block-l" x="260" y="98" class="chv-block" style="animation-delay: 0.00s;" />
                <use href="#chv-block-l" x="246" y="98" class="chv-block" style="animation-delay: 0.25s;" />
                <use href="#chv-block-l" x="232" y="98" class="chv-block" style="animation-delay: 0.50s;" />
                <use href="#chv-block-l" x="216" y="98" class="chv-block" style="animation-delay: 0.75s;" />
                <use href="#chv-block-l" x="204" y="98" class="chv-block" style="animation-delay: 1.00s;" />
              </g>

              <g id="flow-grid-import">
                <use href="#chv-block-l" x="316" y="98" class="chv-block" style="animation-delay: 0.00s;" />
                <use href="#chv-block-l" x="302" y="98" class="chv-block" style="animation-delay: 0.30s;" />
                <use href="#chv-block-l" x="288" y="98" class="chv-block" style="animation-delay: 0.60s;" />
              </g>

              <g id="flow-grid-export">
                <use href="#chv-block-r" x="288" y="98" class="chv-block" style="animation-delay: 0.00s;" />
                <use href="#chv-block-r" x="302" y="98" class="chv-block" style="animation-delay: 0.30s;" />
                <use href="#chv-block-r" x="316" y="98" class="chv-block" style="animation-delay: 0.30s;" />
              </g>

              <circle id="ac-bus-node" cx="280" cy="105" r="5" fill="#16a34a" stroke="#ffffff" stroke-width="1.5"/>

              <!-- Khối 1: PV DC -->
              <g id="grp-pv" transform="translate(38, -6)">
                <g id="grp-pv1">
                  <text id="line-pv1-p" x="0" y="0" text-anchor="start"><tspan id="txt-pv1-p" class="svg-txt-bold">0</tspan><tspan class="unit-lbl" dx="3"> W</tspan></text>
                  <text id="line-pv1-v" x="58" y="0" text-anchor="start"><tspan id="txt-pv1-v" class="svg-txt-bold">0.0</tspan><tspan class="unit-lbl" dx="3"> V</tspan></text>
                </g>
                <g id="grp-pv2">
                  <text id="line-pv2-p" x="0" y="0" text-anchor="start"><tspan id="txt-pv2-p" class="svg-txt-bold">0</tspan><tspan class="unit-lbl" dx="3"> W</tspan></text>
                  <text id="line-pv2-v" x="58" y="0" text-anchor="start"><tspan id="txt-pv2-v" class="svg-txt-bold">0.0</tspan><tspan class="unit-lbl" dx="3"> V</tspan></text>
                </g>
                <g id="grp-pv3">
                  <text id="line-pv3-p" x="0" y="0" text-anchor="start"><tspan id="txt-pv3-p" class="svg-txt-bold">0</tspan><tspan class="unit-lbl" dx="3"> W</tspan></text>
                  <text id="line-pv3-v" x="58" y="0" text-anchor="start"><tspan id="txt-pv3-v" class="svg-txt-bold">0.0</tspan><tspan class="unit-lbl" dx="3"> V</tspan></text>
                </g>
                <g id="grp-pv4">
                  <text id="line-pv4-p" x="0" y="0" text-anchor="start"><tspan id="txt-pv4-p" class="svg-txt-bold">0</tspan><tspan class="unit-lbl" dx="3"> W</tspan></text>
                  <text id="line-pv4-v" x="58" y="0" text-anchor="start"><tspan id="txt-pv4-v" class="svg-txt-bold">0.0</tspan><tspan class="unit-lbl" dx="3"> V</tspan></text>
                </g>

                <g transform="translate(108, -16) scale(0.55)">
                  <g stroke="#52b788" stroke-width="4.5" stroke-linecap="round" fill="none">
                    <circle cx="34" cy="34" r="14" />
                    <line x1="34" y1="12" x2="34" y2="5" />
                    <line x1="18" y1="18" x2="13" y2="13" />
                    <line x1="12" y1="34" x2="5" y2="34" />
                    <line x1="18" y1="50" x2="13" y2="55" />
                    <line x1="50" y1="18" x2="55" y2="13" />
                    <line x1="56" y1="34" x2="63" y2="34" />
                  </g>
                  <polygon points="32,42 86,42 96,86 18,86" fill="#52b788" stroke="#52b788" stroke-width="4" stroke-linejoin="round"/>
                  <g stroke="#ffffff" stroke-width="2.5" stroke-linecap="round" opacity="0.9">
                    <line x1="28.5" y1="53" x2="88.5" y2="53" />
                    <line x1="25" y1="64" x2="91" y2="64" />
                    <line x1="21.5" y1="75" x2="93.5" y2="75" />
                    <line x1="45.5" y1="42" x2="37.5" y2="86" />
                    <line x1="59" y1="42" x2="57" y2="86" />
                    <line x1="72.5" y1="42" x2="76.5" y2="86" />
                  </g>
                </g>
              </g>

              <!-- Khối 2: PV Hòa Lưới -->
              <g id="grp-pv-ac">
                <text id="line-ac-pv-1p" x="315" y="0" text-anchor="start"><tspan id="txt-ac-pv-p" class="svg-txt-bold">0</tspan><tspan class="unit-lbl" dx="3"> W</tspan></text>
                <text id="line-ac-pv-l1" x="315" y="0" text-anchor="start" style="display:none;"><tspan id="txt-ac-pv-l1" class="svg-txt-bold">0</tspan><tspan class="unit-lbl" dx="3"> W</tspan></text>
                <text id="line-ac-pv-l2" x="315" y="0" text-anchor="start" style="display:none;"><tspan id="txt-ac-pv-l2" class="svg-txt-bold">0</tspan><tspan class="unit-lbl" dx="3"> W</tspan></text>
                <text id="line-ac-pv-l3" x="315" y="0" text-anchor="start" style="display:none;"><tspan id="txt-ac-pv-l3" class="svg-txt-bold">0</tspan><tspan class="unit-lbl" dx="3"> W</tspan></text>
                <text id="line-ac-pv-v" x="315" y="0" text-anchor="start"><tspan id="txt-ac-pv-v" class="highlight-val">0.0</tspan><tspan class="unit-lbl" dx="3"> V</tspan></text>
                <text id="line-ac-pv-f" x="315" y="0" text-anchor="start"><tspan id="txt-ac-pv-f" class="highlight-freq">0.00</tspan><tspan class="unit-lbl" dx="3"> Hz</tspan></text>

                <g transform="translate(253, -16)">
                  <rect x="0" y="0" width="54" height="51" rx="6" fill="#ffffff" stroke="#cbd5e1" stroke-width="1.8" stroke-dasharray="3.5,3"/>
                  <g fill="#10b981">
                    <polygon points="18,5 42,5 36,11 12,11" />
                    <polygon points="18,12 42,12 36,18 12,18" />
                  </g>
                  <g>
                    <rect x="9" y="24" width="36" height="22" rx="4" fill="#ffffff" stroke="#10b981" stroke-width="2"/>
                    <line x1="11" y1="43" x2="43" y2="27" stroke="#cbd5e1" stroke-width="1.2"/>
                    <line x1="13" y1="29" x2="21" y2="29" stroke="#0f172a" stroke-width="1.8" stroke-linecap="round"/>
                    <line x1="13" y1="33" x2="21" y2="33" stroke="#0f172a" stroke-width="1.8" stroke-linecap="round"/>
                    <path d="M 31 35 Q 33.5 33, 36 35 T 41 35" fill="none" stroke="#0f172a" stroke-width="1.5" stroke-linecap="round"/>
                    <path d="M 31 39 Q 33.5 37, 36 39 T 41 39" fill="none" stroke="#0f172a" stroke-width="1.5" stroke-linecap="round"/>
                  </g>
                </g>
              </g>

              <!-- Khối 3: Pin Lưu Trữ -->
              <g transform="translate(50, 72)">
                <rect x="11" y="1" width="10" height="4" rx="1.5" fill="#16a34a"/>
                <rect x="2" y="5" width="28" height="48" rx="4" fill="#ffffff" stroke="#16a34a" stroke-width="2"/>
                <rect id="bat-fill" x="4" y="7" width="24" height="43" rx="1.5" fill="#16a34a"/>

                <text id="line-bat-p" x="-8" y="0" text-anchor="end"><tspan id="txt-bat-p" class="svg-txt-bold">0</tspan><tspan class="unit-lbl" dx="3"> W</tspan></text>
                <text id="lbl-bat-mode" x="-8" y="0" class="svg-txt-sub" text-anchor="end">Chờ sạc / xả</text>
                <text id="line-bat-v" x="-8" y="0" text-anchor="end"><tspan id="txt-bat-v" class="highlight-val">0.0</tspan><tspan class="unit-lbl" dx="3"> V</tspan></text>
                <text id="line-bat-soc" x="-8" y="0" text-anchor="end"><tspan id="txt-soc-val" font-size="13px" font-weight="bold" fill="#16a34a">0</tspan><tspan class="unit-lbl" dx="1" fill="#16a34a">%</tspan></text>
              </g>

              <!-- Khối 4: Inverter trung tâm -->
              <g transform="translate(142, 74)">
                <rect x="0" y="0" width="58" height="58" rx="6" fill="#ffffff" stroke="#334155" stroke-width="2"/>
                <circle cx="10" cy="10" r="3.5" fill="#16a34a" id="inv-led"/>
                <rect x="11" y="18" width="36" height="22" rx="2" fill="#0f172a"/>
                <rect x="13" y="20" width="32" height="18" rx="1" fill="#020617"/>
                <text id="inv-lcd-time" x="29" y="32" font-size="7.5" font-weight="bold" fill="#16a34a" font-family="monospace" text-anchor="middle">00:00:00</text>
              </g>

              <!-- Khối 5: Điện Lưới -->
              <g transform="translate(328, 65)">
                <svg x="0" y="0" width="42" height="54" viewBox="0 0 100 160">
                  <g fill="none" stroke="#50b984" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M 50,6 L 18,152 M 50,6 L 82,152" stroke-width="7" />
                    <path d="M 22,42 L 78,42" stroke-width="7" />
                    <path d="M 22,46 L 78,46" stroke-width="4.5" />
                    <circle cx="20" cy="50" r="4" fill="#50b984" />
                    <circle cx="80" cy="50" r="4" fill="#50b984" />
                    <path d="M 10,72 L 90,72" stroke-width="8" />
                    <path d="M 10,77 L 90,77" stroke-width="4.5" />
                    <circle cx="8" cy="82" r="4.5" fill="#50b984" />
                    <circle cx="92" cy="82" r="4.5" fill="#50b984" />
                    <line x1="43" y1="24" x2="57" y2="24" stroke-width="4.5" />
                    <line x1="38" y1="42" x2="62" y2="42" stroke-width="4.5" />
                    <line x1="33" y1="72" x2="67" y2="72" stroke-width="4.5" />
                    <line x1="29" y1="95" x2="71" y2="95" stroke-width="4.5" />
                    <line x1="25" y1="118" x2="75" y2="118" stroke-width="5" />
                    <line x1="19" y1="138" x2="81" y2="138" stroke-width="6" />
                    <line x1="43" y1="24" x2="57" y2="42" stroke-width="3.5" />
                    <line x1="57" y1="24" x2="43" y2="42" stroke-width="3.5" />
                    <line x1="38" y1="42" x2="67" y2="72" stroke-width="3.5" />
                    <line x1="62" y1="42" x2="33" y2="72" stroke-width="3.5" />
                    <line x1="33" y1="72" x2="71" y2="95" stroke-width="3.5" />
                    <line x1="67" y1="72" x2="29" y2="95" stroke-width="3.5" />
                    <line x1="29" y1="95" x2="75" y2="118" stroke-width="3.5" />
                    <line x1="71" y1="95" x2="25" y2="118" stroke-width="3.5" />
                    <line x1="25" y1="118" x2="79" y2="138" stroke-width="4.5" />
                    <line x1="75" y1="118" x2="21" y2="138" stroke-width="4.5" />
                    <path d="M 18,152 L 50,138 L 82,152" stroke-width="5" />
                  </g>
                </svg>

                <text id="line-grid-1p" x="45" y="0"><tspan id="txt-grid-p" class="svg-txt-bold">0</tspan><tspan class="unit-lbl" dx="3"> W</tspan></text>
                <text id="line-grid-l1" x="45" y="0" style="display:none;"><tspan id="txt-grid-l1" class="svg-txt-bold">0</tspan><tspan class="unit-lbl" dx="3"> W</tspan></text>
                <text id="line-grid-l2" x="45" y="0" style="display:none;"><tspan id="txt-grid-l2" class="svg-txt-bold">0</tspan><tspan class="unit-lbl" dx="3"> W</tspan></text>
                <text id="line-grid-l3" x="45" y="0" style="display:none;"><tspan id="txt-grid-l3" class="svg-txt-bold">0</tspan><tspan class="unit-lbl" dx="3"> W</tspan></text>

                <text id="lbl-grid-mode" x="45" y="0" class="svg-txt-sub" font-weight="bold" fill="#dc2626">Mất lưới</text>
                <text id="line-grid-v" x="45" y="0"><tspan id="txt-grid-v" class="highlight-val">0.0</tspan><tspan class="unit-lbl" dx="3"> V</tspan></text>
                <text id="line-grid-f" x="45" y="0"><tspan id="txt-grid-f" class="highlight-freq">0.00</tspan><tspan class="unit-lbl" dx="3"> Hz</tspan></text>
              </g>

              <!-- Khối 6: EPS -->
              <g id="grp-eps" transform="translate(156, 175)">
                <svg id="icon-eps" x="0" y="0" width="38" height="38" viewBox="0 0 60 60">
                  <g stroke="#52b788" stroke-width="2.2" fill="none" stroke-linecap="round" stroke-linejoin="round">
                    <rect x="8" y="8" width="23" height="12" rx="3"/>
                    <text x="19.5" y="16.5" font-size="7.5" font-weight="bold" fill="#52b788" stroke="none" text-anchor="middle" font-family="sans-serif">UPS</text>

                    <circle cx="43" cy="23" r="9"/>
                    <line x1="40" y1="19" x2="40" y2="27" stroke-width="2.5"/>
                    <line x1="46" y1="19" x2="46" y2="27" stroke-width="2.5"/>

                    <path d="M 8 20 C 12 28, 10 38, 12 43 L 24 43"/>

                    <path d="M 23 37 C 23 37, 32 34, 35 43 C 36 48, 30 52, 24 50 Z" fill="#52b788"/>
                    <line x1="31" y1="34" x2="35" y2="30" stroke-width="2.5"/>
                    <line x1="36" y1="39" x2="40" y2="35" stroke-width="2.5"/>
                  </g>
                </svg>

                <text id="line-eps-1p" x="44" y="0"><tspan id="txt-eps-p" class="svg-txt-bold">0</tspan><tspan class="unit-lbl" dx="3"> W</tspan></text>
                <text id="line-eps-l1" x="44" y="0" style="display:none;"><tspan id="txt-eps-l1" class="svg-txt-bold">0</tspan><tspan class="unit-lbl" dx="3"> W</tspan></text>
                <text id="line-eps-l2" x="44" y="0" style="display:none;"><tspan id="txt-eps-l2" class="svg-txt-bold">0</tspan><tspan class="unit-lbl" dx="3"> W</tspan></text>
                <text id="line-eps-l3" x="44" y="0" style="display:none;"><tspan id="txt-eps-l3" class="svg-txt-bold">0</tspan><tspan class="unit-lbl" dx="3"> W</tspan></text>

                <text id="line-eps-v" x="44" y="0"><tspan id="txt-eps-v" class="highlight-val">0.0</tspan><tspan class="unit-lbl" dx="3"> V</tspan></text>
                <text id="line-eps-f" x="44" y="0"><tspan id="txt-eps-f" class="highlight-freq">0.00</tspan><tspan class="unit-lbl" dx="3"> Hz</tspan></text>

                <text x="0" y="52" id="lbl-eps-sub" class="svg-txt-sub">Công suất dự phòng</text>
                <text x="0" y="63" id="lbl-eps-standby" style="font-size: 9px; fill: #16a34a; font-weight: 800; display: none;">Chế độ chờ</text>
              </g>

              <!-- Khối 7: Tải Tiêu Thụ -->
              <g transform="translate(261, 175)">
                <svg id="icon-load" x="0" y="0" width="38" height="38" viewBox="0 0 100 100">
                  <rect class="load-icon-color" x="27" y="14" width="10" height="20" rx="1" fill="#52b788"/>
                  <path class="load-icon-stroke" d="M 10 50 L 50 21 L 90 50" fill="none" stroke="#52b788" stroke-width="10" stroke-linecap="round" stroke-linejoin="round"/>
                  <path class="load-icon-color" d="M 50 29.5 L 82 52.5 L 82 85 C 82 86.5 80.5 88 79 88 L 21 88 C 19.5 88 18 86.5 18 85 L 18 52.5 Z" fill="#52b788"/>
                  <polygon points="52,45.5 42,60.5 49.5,60.5 46.5,78.5 58,59.5 50.5,59.5" fill="#ffffff"/>
                </svg>

                <text id="line-load-1p" x="44" y="0"><tspan id="txt-load-p" class="svg-txt-bold">0</tspan><tspan class="unit-lbl" dx="3"> W</tspan></text>
                <text id="line-load-l1" x="44" y="0" style="display:none;"><tspan id="txt-load-l1" class="svg-txt-bold">0</tspan><tspan class="unit-lbl" dx="3"> W</tspan></text>
                <text id="line-load-l2" x="44" y="0" style="display:none;"><tspan id="txt-load-l2" class="svg-txt-bold">0</tspan><tspan class="unit-lbl" dx="3"> W</tspan></text>
                <text id="line-load-l3" x="44" y="0" style="display:none;"><tspan id="txt-load-l3" class="svg-txt-bold">0</tspan><tspan class="unit-lbl" dx="3"> W</tspan></text>

                <text id="lbl-load-sub" x="44" y="0" class="svg-txt-sub">Tiêu thụ</text>
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
  description: "Sơ đồ luồng năng lượng cho Inverter Hybrid (1 Pha / 3 Pha)"
});