# 🔋 Inverter Hybrid Card cho Home Assistant

Thẻ Lovelace tùy chỉnh hiển thị sơ đồ luồng năng lượng và thống kê cho hệ thống Biến tần Hybrid (Solar / Battery / Grid / Load / EPS) trong Home Assistant.
<img width="1217" height="1252" alt="2" src="https://github.com/user-attachments/assets/e24904e8-f9b2-4841-b4ff-155872cd3c4a" />
<img width="1302" height="1316" alt="1" src="https://github.com/user-attachments/assets/42a08d67-049a-418a-8fd4-5a099f30e002" />


## ⚙️ Cài đặt qua HACS (Custom Repository)

1. Mở **HACS** trong Home Assistant.
2. Nhấn vào biểu tượng 3 chấm ở góc trên bên phải `⋮` ➔ chọn **Custom repositories** (Kho lưu trữ tùy chỉnh).
3. Nhập đường dẫn GitHub repository của bạn:
   - **Repository:** `https://github.com/vinh97/Power-Flow-Card`
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

     URL: /local/community/inverter-hybrid-card/inverter-hybrid-card.jsv=1.0.0.0

     Resource type: JavaScript Module


     ## 🛠️ Cấu hình mẫu
     Bước 3: Tạo thẻ trên Dashboard bằng YAML
     Vào Dashboard bất kỳ, chọn Chỉnh sửa giao diện, thêm thẻ mới dạng Thủ công (Manual) và nhập cấu hình mẫu sau:

## 🛠️ Cấu hình mẫu trên Dashboard (YAML)

Vào Dashboard bất kỳ ➔ Chọn **Chỉnh sửa giao diện** (Edit Dashboard) ➔ Thêm thẻ mới dạng **Thủ công** (Manual) ➔ Dán đoạn mã cấu hình YAML sau:

```yaml
type: custom:power-flow-card
always_show_ac_pv: false # PV Hòa Lưới / Máy phát: true = luôn hiện, false = tự ẩn khi 0W
invert_battery_power: false # Bật 'true' nếu công suất Pin bị ngược dấu (xả ra số dương, sạc vào số âm)
invert_grid_power: false # Bật 'true' nếu công suất Lưới bị ngược dấu (mua lưới ra số âm, bán lưới ra số dương)
entities:
  # --- Quang điện (PV) ---
  pv1_power: sensor.pv1_power
  pv1_voltage: sensor.pv1_voltage
  pv2_power: sensor.pv2_power
  pv2_voltage: sensor.pv2_voltage

  # PV Hòa Lưới / Máy phát (Tùy chọn - Không khai báo dòng nào sẽ tự động ẩn dòng đó)
  ac_pv_power: sensor.ac_pv_power
  ac_pv_voltage: sensor.ac_pv_voltage
  ac_pv_frequency: sensor.ac_pv_frequency

  # --- Tải tiêu thụ & Dự phòng (EPS) ---
  load_power: sensor.load_power
  eps_power: sensor.eps_power
  eps_voltage: sensor.eps_voltage
  eps_frequency: sensor.eps_frequency

  # --- Pin lưu trữ (Battery) ---
  battery_power: sensor.lux_battery_flow_live
  battery_voltage: sensor.battery_voltage
  battery_soc: sensor.battery_soc

  # --- Điện lưới EVN (Grid) ---
  grid_power: sensor.lux_grid_flow_live
  grid_voltage: sensor.grid_voltage
  grid_frequency: sensor.grid_frequency

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
