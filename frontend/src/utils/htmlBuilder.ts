import { Customer, Service, Vehicle } from '../db/database';
import { AppSettings, buildVehicleQrUrl } from './settings';

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
    <h1>${esc(settings.garageName)}</h1>
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
</style>
</head><body>
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
  <hr />
  <div class="center sm">Thank You!</div>
  <div class="center sm">${esc(settings.garageName)}</div>
  <div style="height: 20px;"></div>
</body></html>`;
}

export { esc, formatDashLights };
