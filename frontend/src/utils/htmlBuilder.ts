import { Customer, Service, Vehicle, InventoryItem } from '../db/database';
import { AppSettings, buildVehicleQrUrl } from './settings';
import { MASS_POWER_LOGO_PNG_BASE64 } from './logoBase64';

function esc(s: string | undefined | null): string {
  if (!s) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatDashLights(s: Service): string {
  const lights: string[] = [];
  if (s.dash_abs) lights.push('ABS');
  if (s.dash_check_engine) lights.push('Check Engine');
  if (s.dash_brake) lights.push('Brake');
  if (s.dash_airbag) lights.push('Airbag');
  if (s.dash_immobilizer) lights.push('Immobilizer');
  if (s.dash_tpms) lights.push('HVAC Leaks');
  if (s.dash_oil_leak) lights.push('Oil Leak');
  return lights.length ? lights.join(', ') : '';
}

/** Full A4-style HTML for a single vehicle's full service history (for GitHub Pages). */
export function buildVehicleHistoryHtml(
  customer: Customer,
  vehicle: Vehicle,
  services: Service[],
  settings: AppSettings
): string {
  const totalCost = services.reduce((sum, s) => sum + s.cost, 0);
  const unpaidCost = services.filter((s) => !s.is_paid).reduce((sum, s) => sum + s.cost, 0);

  const rows = services
    .slice()
    .sort((a, b) => (a.service_date < b.service_date ? 1 : -1))
    .map((s) => {
      const lights = formatDashLights(s);
      return `
      <tr class="${s.is_paid ? '' : 'unpaid'}">
        <td>${esc(new Date(s.service_date).toLocaleDateString())}</td>
        <td><strong>${esc(s.service_description)}</strong>${
        s.additional_info ? `<div class="sub">${esc(s.additional_info)}</div>` : ''
      }${lights ? `<div class="lights">⚠ Dash: ${esc(lights)}</div>` : ''}</td>
        <td class="right">$${s.cost.toFixed(2)}</td>
        <td class="center">${s.is_paid ? '<span class="paid">PAID</span>' : '<span class="unpaid-tag">UNPAID</span>'}</td>
      </tr>`;
    })
    .join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>${esc(vehicle.make)} ${esc(vehicle.model)} - Service History</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #1e293b; background: #f8fafc; padding: 16px; }
  .container { max-width: 800px; margin: 0 auto; background: #fff; border-radius: 12px; padding: 24px; box-shadow: 0 2px 8px rgba(0,0,0,0.05); }
  h1 { color: #2563eb; font-size: 24px; margin-bottom: 4px; }
  .subtitle { color: #64748b; font-size: 14px; margin-bottom: 24px; }
  .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 24px; }
  .info-card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px; }
  .info-label { font-size: 11px; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px; }
  .info-value { font-size: 14px; font-weight: 600; color: #1e293b; }
  table { width: 100%; border-collapse: collapse; margin-top: 16px; }
  th { background: #eff6ff; color: #1e40af; text-align: left; padding: 10px; font-size: 13px; }
  td { padding: 10px; border-bottom: 1px solid #e2e8f0; font-size: 13px; vertical-align: top; }
  .right { text-align: right; }
  .center { text-align: center; }
  .sub { font-size: 11px; color: #64748b; margin-top: 2px; }
  .lights { font-size: 11px; color: #ea580c; margin-top: 2px; font-weight: 600; }
  tr.unpaid td { background: #fef2f2; }
  .paid { background: #10b981; color: #fff; padding: 2px 8px; border-radius: 4px; font-size: 10px; font-weight: bold; }
  .unpaid-tag { background: #ef4444; color: #fff; padding: 2px 8px; border-radius: 4px; font-size: 10px; font-weight: bold; }
  .summary { margin-top: 20px; padding-top: 16px; border-top: 2px solid #e2e8f0; display: flex; justify-content: space-between; font-size: 16px; }
  .total { color: #10b981; font-weight: bold; }
  .unpaid-total { color: #ef4444; font-weight: bold; }
  .footer { margin-top: 32px; text-align: center; color: #94a3b8; font-size: 12px; }
  @media print { body { background: #fff; padding: 0; } .container { box-shadow: none; } }
</style>
</head>
<body>
  <div class="container">
    <div style="display:flex; align-items:center; gap:14px; margin-bottom:8px;">
      <img src="${MASS_POWER_LOGO_PNG_BASE64}" alt="logo" style="width:64px; height:64px; border-radius:50%; flex:none;" />
      <h1 style="margin:0;">${esc(settings.garageName)}</h1>
    </div>
    <div class="subtitle">Vehicle Service History${settings.garagePhone ? ` &middot; ${esc(settings.garagePhone)}` : ''}</div>

    <div class="grid">
      <div class="info-card">
        <div class="info-label">Customer</div>
        <div class="info-value">${esc(customer.name)}</div>
      </div>
      <div class="info-card">
        <div class="info-label">Mobile</div>
        <div class="info-value">${esc(customer.mobile_number)}</div>
      </div>
      <div class="info-card">
        <div class="info-label">Vehicle</div>
        <div class="info-value">${esc(vehicle.year || '')} ${esc(vehicle.make)} ${esc(vehicle.model)}</div>
      </div>
      <div class="info-card">
        <div class="info-label">Plate Number</div>
        <div class="info-value">${esc(vehicle.plate_number)}</div>
      </div>
      <div class="info-card" style="grid-column: span 2;">
        <div class="info-label">VIN</div>
        <div class="info-value" style="font-family: monospace; word-break: break-all;">${esc(vehicle.vin)}</div>
      </div>
    </div>

    <h2 style="font-size: 18px; color: #1e293b; margin-bottom: 8px;">Service Records (${services.length})</h2>
    ${
      services.length === 0
        ? '<p style="color: #94a3b8; font-style: italic; padding: 16px 0;">No services recorded yet.</p>'
        : `<table>
      <thead>
        <tr>
          <th>Date</th>
          <th>Service</th>
          <th class="right">Cost</th>
          <th class="center">Status</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>`
    }

    <div class="summary">
      <span>Total Services: <strong>${services.length}</strong></span>
      <span class="total">Total: $${totalCost.toFixed(2)}</span>
    </div>
    ${
      unpaidCost > 0
        ? `<div class="summary"><span>&nbsp;</span><span class="unpaid-total">Unpaid Balance: $${unpaidCost.toFixed(2)}</span></div>`
        : ''
    }

    <div class="footer">
      Generated ${new Date().toLocaleString()}<br />
      ${esc(settings.garageName)} &middot; Vehicle ID: ${esc(vehicle.id)}
    </div>
  </div>
</body>
</html>`;
}

/** Compact 55mm thermal printer HTML for a single service receipt. */
export function buildThermalReceiptHtml(
  customer: Customer,
  vehicle: Vehicle,
  service: Service,
  settings: AppSettings
): string {
  const lights = formatDashLights(service);
  const hasOilReminder = !!(service.next_service_date || service.next_service_mileage);
  const nextDateFormatted = service.next_service_date
    ? new Date(service.next_service_date).toLocaleDateString('en-GB', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      })
    : '';
  // 55mm width ~= 208px at 96dpi; we use 200px to leave margin
  return `<!DOCTYPE html>
<html><head>
<meta charset="UTF-8" />
<style>
  @page { size: 55mm auto; margin: 2mm; }
  * { box-sizing: border-box; }
  body { font-family: 'Courier New', monospace; font-size: 11px; color: #000; margin: 0; padding: 4px; width: 55mm; }
  .center { text-align: center; }
  .right { text-align: right; }
  .bold { font-weight: bold; }
  .lg { font-size: 14px; }
  .sm { font-size: 9px; }
  .row { display: flex; justify-content: space-between; gap: 4px; }
  hr { border: none; border-top: 1px dashed #000; margin: 4px 0; }
  .box { border: 1px solid #000; padding: 3px; margin: 4px 0; }
  /* Oil reminder sticker */
  .sticker { border: 2px solid #000; padding: 8px 6px; margin: 6px 0; text-align: center; }
  .sticker-title { font-size: 13px; font-weight: bold; letter-spacing: 1px; margin-bottom: 4px; }
  .sticker-icon { font-size: 22px; line-height: 1; margin: 2px 0; }
  .sticker-field { font-size: 10px; margin-top: 6px; }
  .sticker-value { font-size: 14px; font-weight: bold; letter-spacing: 0.5px; margin-top: 2px; }
  .sticker-divider { border-top: 1px dashed #000; margin: 6px 0; }
</style>
</head><body>
  <div class="center"><img src="${MASS_POWER_LOGO_PNG_BASE64}" alt="logo" style="width:90px; height:90px; border-radius:50%;" /></div>
  <div class="center bold lg">${esc(settings.garageName)}</div>
  ${settings.garagePhone ? `<div class="center sm">${esc(settings.garagePhone)}</div>` : ''}
  <hr />
  <div class="center sm">SERVICE RECEIPT</div>
  <div class="sm">${esc(new Date(service.service_date).toLocaleString())}</div>
  <hr />
  <div class="bold">Customer:</div>
  <div>${esc(customer.name)}</div>
  <div class="sm">Mobile: ${esc(customer.mobile_number)}</div>
  <hr />
  <div class="bold">Vehicle:</div>
  <div>${esc(vehicle.year || '')} ${esc(vehicle.make)} ${esc(vehicle.model)}</div>
  <div class="sm">Plate: ${esc(vehicle.plate_number)}</div>
  <div class="sm">VIN: ${esc(vehicle.vin)}</div>
  ${service.current_mileage ? `<div class="sm">Mileage: ${service.current_mileage.toLocaleString()} km</div>` : ''}
  <hr />
  <div class="bold">Service:</div>
  <div>${esc(service.service_description)}</div>
  ${service.additional_info ? `<div class="sm">${esc(service.additional_info)}</div>` : ''}
  ${lights ? `<div class="box sm bold">⚠ DASH: ${esc(lights)}</div>` : ''}
  <hr />
  <div class="row bold lg">
    <span>TOTAL:</span><span>$${service.cost.toFixed(2)}</span>
  </div>
  <div class="center bold" style="margin-top:4px;">${service.is_paid ? '*** PAID ***' : '*** UNPAID ***'}</div>
  ${
    hasOilReminder
      ? `<div class="sticker">
            <div class="sticker-title">NEXT OIL CHANGE</div>
            <div class="sticker-icon">🛢️</div>
            ${nextDateFormatted ? `<div class="sticker-field">DATE</div><div class="sticker-value">${esc(nextDateFormatted)}</div>` : ''}
            ${service.next_service_date && service.next_service_mileage ? '<div class="sticker-divider"></div>' : ''}
            ${service.next_service_mileage ? `<div class="sticker-field">MILEAGE</div><div class="sticker-value">${service.next_service_mileage.toLocaleString()} KM</div>` : ''}
         </div>`
      : '<hr />'
  }
  <div class="center sm">Thank You!</div>
  <div class="center sm">${esc(settings.garageName)}</div>
  <div style="height: 20px;"></div>
</body></html>`;
}

export { esc, formatDashLights };

/** Standalone 55mm thermal HTML that prints ONLY the oil-change reminder sticker.
 *  Uses the same expo-print + system-print pipeline as the receipt — so any
 *  Bluetooth thermal printer / print service (PrinterShare, RawBT, etc.) the user
 *  has set up will receive it.
 *
 *  Minimal layout (per user spec):
 *    - Shop name
 *    - Car brand (vehicle.make only — e.g. "BMW")
 *    - Next oil change mileage
 *    - Next oil change date
 *    - Pen-tickable "FILTER CHANGE" checkbox
 */
export function buildOilStickerHtml(
  customer: Customer,
  vehicle: Vehicle,
  service: Service,
  settings: AppSettings
): string {
  const nextDateFormatted = service.next_service_date
    ? new Date(service.next_service_date).toLocaleDateString('en-GB', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      })
    : '';
  const nextMileage = service.next_service_mileage;

  return `<!DOCTYPE html>
<html><head>
<meta charset="UTF-8" />
<style>
  @page { size: 55mm auto; margin: 2mm; }
  * { box-sizing: border-box; }
  body {
    font-family: 'Arial Black', 'Arial', sans-serif;
    font-size: 12px;
    color: #000;
    margin: 0;
    padding: 0;
    width: 55mm;
    text-align: center;
  }
  .sticker {
    border: 3px solid #000;
    padding: 8px 6px;
    margin: 4px 2px;
  }
  .shop {
    font-size: 14px;
    font-weight: 900;
    letter-spacing: 1px;
    text-transform: uppercase;
    padding-bottom: 6px;
    border-bottom: 2px solid #000;
    margin-bottom: 6px;
  }
  .brand {
    font-size: 22px;
    font-weight: 900;
    letter-spacing: 2px;
    text-transform: uppercase;
    padding: 4px 0 8px 0;
    border-bottom: 1px dashed #000;
    margin-bottom: 8px;
  }
  .heading {
    font-size: 11px;
    font-weight: 900;
    letter-spacing: 2px;
    text-transform: uppercase;
    margin-bottom: 8px;
  }
  .field-row {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    margin: 6px 4px;
    font-size: 12px;
    font-weight: 900;
    letter-spacing: 1px;
  }
  .field-label { text-align: left; }
  .field-value {
    text-align: right;
    font-size: 14px;
  }
  .divider {
    border-top: 1px dashed #000;
    margin: 8px 4px;
  }
  .checkbox-row {
    display: flex;
    align-items: center;
    justify-content: center;
    margin: 10px 4px 4px 4px;
  }
  .checkbox {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 18px;
    height: 18px;
    border: 2px solid #000;
    margin-right: 8px;
    vertical-align: middle;
    font-size: 16px;
    font-weight: 900;
    line-height: 1;
  }
  .checkbox-label {
    font-size: 13px;
    font-weight: 900;
    letter-spacing: 1px;
    text-transform: uppercase;
    vertical-align: middle;
  }
</style>
</head><body>
  <div class="sticker">
    <img src="${MASS_POWER_LOGO_PNG_BASE64}" alt="logo" style="width:60px; height:60px; border-radius:50%; display:block; margin:0 auto 4px auto;" />
    <div class="shop">${esc(settings.garageName)}</div>
    <div class="brand">${esc([vehicle.make, vehicle.model].filter(Boolean).join(' ').trim())}</div>
    <div class="heading">Next Oil Change</div>
    ${
      service.oil_grade
        ? `<div class="field-row">
             <span class="field-label">OIL:</span>
             <span class="field-value">${esc(service.oil_grade)}</span>
           </div>`
        : ''
    }
    ${
      nextMileage
        ? `<div class="field-row">
             <span class="field-label">MILEAGE:</span>
             <span class="field-value">${nextMileage.toLocaleString()} KM</span>
           </div>`
        : ''
    }
    ${
      nextDateFormatted
        ? `<div class="field-row">
             <span class="field-label">DATE:</span>
             <span class="field-value">${esc(nextDateFormatted)}</span>
           </div>`
        : ''
    }
    <div class="divider"></div>
    <div class="checkbox-row">
      <span class="checkbox">${service.oil_filter_changed ? '&#10003;' : ''}</span>
      <span class="checkbox-label">Filter Change</span>
    </div>
  </div>
  <div style="height: 18px;"></div>
</body></html>`;
}

/** Standalone 55mm thermal HTML that prints ONLY the battery replacement sticker.
 *  Uses the same expo-print + system-print pipeline as the receipt.
 *
 *  Layout (per user spec):
 *    - Shop name
 *    - Car brand (make + model)
 *    - Amp rate (free-text, e.g. "700 CCA" or "80 Ah")
 *    - Installation date
 *    - Warranty length (6 months or 1 year)
 *    - Parasitic-draw tested checkbox
 */
export function buildBatteryStickerHtml(
  customer: Customer,
  vehicle: Vehicle,
  service: Service,
  settings: AppSettings
): string {
  const installFormatted = service.battery_install_date
    ? new Date(service.battery_install_date).toLocaleDateString('en-GB', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      })
    : '';
  const warrantyMonths = service.battery_warranty_months || 0;
  let warrantyExpiryFormatted = '';
  let warrantyLabel = '';
  if (warrantyMonths > 0 && service.battery_install_date) {
    const expiry = new Date(service.battery_install_date);
    expiry.setMonth(expiry.getMonth() + warrantyMonths);
    warrantyExpiryFormatted = expiry.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  }
  if (warrantyMonths === 6) warrantyLabel = '6 MONTHS';
  else if (warrantyMonths === 12) warrantyLabel = '1 YEAR';
  else if (warrantyMonths > 0) warrantyLabel = `${warrantyMonths} MONTHS`;

  return `<!DOCTYPE html>
<html><head>
<meta charset="UTF-8" />
<style>
  @page { size: 55mm auto; margin: 2mm; }
  * { box-sizing: border-box; }
  body {
    font-family: 'Arial Black', 'Arial', sans-serif;
    font-size: 12px;
    color: #000;
    margin: 0;
    padding: 0;
    width: 55mm;
    text-align: center;
  }
  .sticker {
    border: 3px solid #000;
    padding: 8px 6px;
    margin: 4px 2px;
  }
  .shop {
    font-size: 14px;
    font-weight: 900;
    letter-spacing: 1px;
    text-transform: uppercase;
    padding-bottom: 6px;
    border-bottom: 2px solid #000;
    margin-bottom: 6px;
  }
  .brand {
    font-size: 18px;
    font-weight: 900;
    letter-spacing: 2px;
    text-transform: uppercase;
    padding: 4px 0 8px 0;
    border-bottom: 1px dashed #000;
    margin-bottom: 8px;
  }
  .heading {
    font-size: 11px;
    font-weight: 900;
    letter-spacing: 2px;
    text-transform: uppercase;
    margin-bottom: 8px;
  }
  .amp-row {
    font-size: 20px;
    font-weight: 900;
    letter-spacing: 1px;
    padding: 4px 0;
    background: #000;
    color: #fff;
    margin: 6px -6px 8px -6px;
  }
  .field-row {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    margin: 6px 4px;
    font-size: 12px;
    font-weight: 900;
    letter-spacing: 1px;
  }
  .field-label { text-align: left; }
  .field-value {
    text-align: right;
    font-size: 14px;
  }
  .warranty-badge {
    display: inline-block;
    padding: 5px 10px;
    border: 2px solid #000;
    font-size: 13px;
    font-weight: 900;
    letter-spacing: 1px;
    text-transform: uppercase;
    margin: 4px 0;
  }
  .divider {
    border-top: 1px dashed #000;
    margin: 8px 4px;
  }
  .checkbox-row {
    display: flex;
    align-items: center;
    justify-content: center;
    margin: 8px 4px 4px 4px;
  }
  .checkbox {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 18px;
    height: 18px;
    border: 2px solid #000;
    margin-right: 8px;
    vertical-align: middle;
    font-size: 16px;
    font-weight: 900;
    line-height: 1;
  }
  .checkbox-label {
    font-size: 11px;
    font-weight: 900;
    letter-spacing: 1px;
    text-transform: uppercase;
    vertical-align: middle;
  }
  .plate {
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.5px;
    margin-top: 4px;
    padding-top: 4px;
    border-top: 1px dashed #000;
  }
</style>
</head><body>
  <div class="sticker">
    <img src="${MASS_POWER_LOGO_PNG_BASE64}" alt="logo" style="width:60px; height:60px; border-radius:50%; display:block; margin:0 auto 4px auto;" />
    <div class="shop">${esc(settings.garageName)}</div>
    <div class="brand">${esc([vehicle.make, vehicle.model].filter(Boolean).join(' ').trim())}</div>
    <div class="heading">Battery Replacement</div>
    ${
      service.battery_amp_rate
        ? `<div class="amp-row">${esc(service.battery_amp_rate)}</div>`
        : ''
    }
    ${
      installFormatted
        ? `<div class="field-row">
             <span class="field-label">INSTALLED:</span>
             <span class="field-value">${esc(installFormatted)}</span>
           </div>`
        : ''
    }
    ${
      warrantyLabel
        ? `<div style="text-align:center;"><span class="warranty-badge">WARRANTY ${warrantyLabel}</span></div>`
        : ''
    }
    ${
      warrantyExpiryFormatted
        ? `<div class="field-row">
             <span class="field-label">EXPIRES:</span>
             <span class="field-value">${esc(warrantyExpiryFormatted)}</span>
           </div>`
        : ''
    }
    <div class="divider"></div>
    <div class="checkbox-row">
      <span class="checkbox">${service.battery_parasitic_tested ? '&#10003;' : ''}</span>
      <span class="checkbox-label">Parasitic Draw Tested</span>
    </div>
    ${
      vehicle.plate_number
        ? `<div class="plate">${esc(vehicle.plate_number)}</div>`
        : ''
    }
  </div>
  <div style="height: 18px;"></div>
</body></html>`;
}



/** 55mm thermal HTML that prints one price-sticker per selected inventory item.
 *  A dashed cut-line separates each sticker so they can be scissor-cut apart
 *  and stuck on shelves / parts.
 *
 *  Per item shown:
 *    - Shop name (small header)
 *    - Item name (large, bold)
 *    - Item code (small, if present)
 *    - Retail price ($XX.XX, extra large)
 *  Quantity and cost price are intentionally NOT shown.
 */
export function buildPriceStickersHtml(
  items: InventoryItem[],
  garageName: string
): string {
  const stickers = items
    .map((it, idx) => {
      const retail =
        it.item_retail_price && it.item_retail_price > 0
          ? it.item_retail_price
          : it.item_price;
      const isLast = idx === items.length - 1;
      return `
        <div class="sticker">
          <div class="shop">${esc(garageName)}</div>
          <div class="item-name">${esc(it.item_type)}</div>
          ${
            it.item_code
              ? `<div class="item-code">${esc(it.item_code)}</div>`
              : ''
          }
          <div class="price">$${retail.toFixed(2)}</div>
        </div>
        ${isLast ? '' : '<div class="cut-line">&#9986; &nbsp; &nbsp; C U T &nbsp; &nbsp; H E R E &nbsp; &nbsp; &#9986;</div>'}`;
    })
    .join('');

  return `<!DOCTYPE html>
<html><head>
<meta charset="UTF-8" />
<style>
  @page { size: 55mm auto; margin: 2mm; }
  * { box-sizing: border-box; }
  body {
    font-family: 'Arial Black', 'Arial', sans-serif;
    font-size: 12px;
    color: #000;
    margin: 0;
    padding: 0;
    width: 55mm;
    text-align: center;
  }
  .sticker {
    padding: 8px 4px;
    border: 2px solid #000;
    margin: 2px 0;
  }
  .shop {
    font-size: 10px;
    font-weight: 900;
    letter-spacing: 1px;
    text-transform: uppercase;
    color: #000;
    margin-bottom: 4px;
  }
  .item-name {
    font-size: 18px;
    font-weight: 900;
    letter-spacing: 1px;
    text-transform: uppercase;
    color: #000;
    padding: 6px 2px;
    border-top: 1px dashed #000;
    border-bottom: 1px dashed #000;
    margin: 2px 0 6px 0;
    line-height: 1.15;
    word-break: break-word;
  }
  .item-code {
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.5px;
    color: #000;
    margin-bottom: 6px;
  }
  .price {
    font-size: 32px;
    font-weight: 900;
    letter-spacing: 1.5px;
    color: #000;
    padding: 4px 0 2px 0;
  }
  .cut-line {
    font-size: 10px;
    font-weight: 900;
    letter-spacing: 2px;
    color: #000;
    padding: 6px 0;
    border-top: 2px dashed #000;
    border-bottom: 2px dashed #000;
    margin: 6px 0;
    background: #fff;
  }
</style>
</head><body>
  ${stickers || '<div class="sticker">No items selected</div>'}
  <div style="height: 18px;"></div>
</body></html>`;
}
