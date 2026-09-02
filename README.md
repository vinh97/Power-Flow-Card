# 🔋 Inverter Hybrid Card cho Home Assistant

Thẻ Lovelace tùy chỉnh hiển thị sơ đồ luồng năng lượng và thống kê cho hệ thống Biến tần Hybrid (Solar / Battery / Grid / Load / EPS) trong Home Assistant.

---
<img width="1272" height="1594" alt="5" src="https://github.com/user-attachments/assets/1e995c9a-59a7-4a6b-89a4-f8cc2d394dc1" />
<img width="1263" height="1602" alt="4" src="https://github.com/user-attachments/assets/caec91b1-6010-4816-afa4-29ef24c8e659" />
<img width="927" height="1321" alt="2" src="https://github.com/user-attachments/assets/8262ac7c-d8f3-4be2-a2e7-4d7c7b3d59cf" />
<img width="1272" height="1600" alt="1" src="https://github.com/user-attachments/assets/f4e63a99-144a-44ba-805e-02137092b95b" />



## ⚙️ Cài đặt qua HACS (Custom Repository)

1. Mở **HACS** trong Home Assistant.
2. Nhấn vào biểu tượng 3 chấm ở góc trên bên phải `⋮` ➔ chọn **Custom repositories** (Kho lưu trữ tùy chỉnh).
3. Nhập đường dẫn GitHub repository của bạn:
   - **Repository:** `https://github.com/TÊN_USER_GITHUB/power-flow-card`
   - **Type:** `Plugin`
4. Bấm **Add** (Thêm), sau đó tìm kiếm **Power Flow Card** và bấm **Download**.
5. Tải lại trang giao diện Home Assistant.

---

## ⚙️ Cài đặt Thủ công (Manual)

     1. Copy thư mục `inverter-hybrid-card` về và đặt vào thư mục `/config/www/community/` trong Home Assistant.
     2. Thêm vào `resources` thông qua UI
     Thêm qua UI

     Vào Settings → Dashboards → Resources → Add Resource

     Nhập:

     URL: /local/community/power-flow-card/power-flow-card.js?ver=1.0.0.0.0

     Resource type: JavaScript Module


     ## 🛠️ Cấu hình mẫu
     Bước 3: Tạo thẻ trên Dashboard bằng YAML
     Vào Dashboard bất kỳ, chọn Chỉnh sửa giao diện, thêm thẻ mới dạng Thủ công (Manual) và nhập cấu hình mẫu sau:

## 🛠️ Cấu hình mẫu trên Dashboard (YAML)

Vào Dashboard bất kỳ ➔ Chọn **Chỉnh sửa giao diện** (Edit Dashboard) ➔ Thêm thẻ mới dạng **Thủ công** (Manual) ➔ Dán đoạn mã cấu hình YAML sau:

```yaml
type: custom:power-flow-card

# --- Cấu hình tùy chọn hệ thống ---
three_phase: false           # Đặt true nếu dùng hệ thống 3 pha
invert_battery_power: false  # Đặt true nếu công suất pin bị ngược dấu
invert_grid_power: false     # Đặt true nếu công suất lưới bị ngược dấu
always_show_ac_pv: false     # Đặt true nếu luôn muốn hiển thị khung AC PV / Máy phát

entities:
  # --- Điện mặt trời (DC PV) ---
  pv1_power: sensor.pv1_power
  pv1_voltage: sensor.pv1_voltage
  pv2_power: sensor.pv2_power
  pv2_voltage: sensor.pv2_voltage
  pv3_power: sensor.inverter_pv3_power
  pv3_voltage: sensor.inverter_pv3_voltage
  pv4_power: sensor.inverter_pv4_power
  pv4_voltage: sensor.inverter_pv4_voltage

  # --- Điện mặt trời AC / Máy phát điện (AC PV) ---
  ac_pv_power: sensor.ac_pv_power
  ac_pv_voltage: sensor.ac_pv_voltage
  ac_pv_frequency: sensor.ac_pv_frequency
  # Nếu dùng 3 pha cho AC PV:
  ac_pv_power_l1: sensor.ac_pv_power_l1
  ac_pv_power_l2: sensor.ac_pv_power_l2
  ac_pv_power_l3: sensor.ac_pv_power_l3

  # --- Pin lưu trữ (Battery) ---
  battery_power: sensor.lux_battery_flow_live
  battery_voltage: sensor.battery_voltage
  battery_soc: sensor.battery_soc

  # --- Tải tiêu thụ (Load) ---
  load_power: sensor.inverter_power
  Nếu dùng 3 pha cho Tải tiêu thụ:
  load_power_l1: sensor.inverter_load_power_l1
  load_power_l2: sensor.inverter_load_power_l2
  load_power_l3: sensor.inverter_load_power_l3

  # --- Cổng dự phòng (EPS / Backup) ---
  eps_power: sensor.eps_power
  eps_voltage: sensor.eps_voltage
  eps_frequency: sensor.eps_frequency
  # Nếu dùng 3 pha cho EPS:
  eps_power_l1: sensor.inverter_eps_power_l1
  eps_power_l2: sensor.inverter_eps_power_l2
  eps_power_l3: sensor.inverter_eps_power_l3

  # --- Điện lưới (Grid) ---
  grid_power: sensor.lux_grid_flow_live
  grid_voltage: sensor.grid_voltage
  grid_frequency: sensor.grid_frequency
  # Nếu dùng 3 pha cho Lưới:
  grid_power_l1: sensor.inverter_grid_power_l1
  grid_power_l2: sensor.inverter_grid_power_l2
  grid_power_l3: sensor.inverter_grid_power_l3
  grid_voltage_l1: sensor.inverter_grid_voltage_l1
  grid_frequency_l1: sensor.inverter_grid_frequency_l1

  # --- Thống kê sản lượng & tiêu thụ (kWh) ---

  # --- Thống kê Sản lượng PV ---
  pv_daily: sensor.lux_solar_output_daily
  pv_total: sensor.pv_energy_total

  # --- Thống kê Tải tiêu thụ ---
  load_daily: sensor.load_consumption_today
  load_total: sensor.load_consumption_total

  # --- Thống kê Sạc / Xả Pin ---
  battery_charge_daily: sensor.charge_energy_today
  battery_charge_total: sensor.charge_energy_total
  battery_discharge_daily: sensor.discharge_energy_today
  battery_discharge_total: sensor.discharge_energy_total

  # --- Thống kê Mua / Bán Điện Lưới ---
  grid_buy_daily: sensor.energy_from_grid_today
  grid_buy_total: sensor.energy_from_grid_total
  grid_sell_daily: sensor.energy_to_grid_today
  grid_sell_total: sensor.energy_to_grid_total
```
