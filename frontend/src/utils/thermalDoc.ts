/**
 * ThermalDoc — structured, canvas-friendly print job for the Cat Printer.
 *
 * The Cat Printer BLE path can't reliably rasterize arbitrary HTML on Android
 * WebView (SVG <foreignObject> fails on many phones — Huawei, LG, etc.).
 * Instead of trying to render HTML, we describe each print job as a small
 * list of primitive drawing ops and paint them ourselves onto a canvas.
 *
 * The external / OS print flow keeps using the existing HTML builders — this
 * module ONLY feeds the Cat Printer path.
 */
import type { Customer, Service, Vehicle, InventoryItem, LowStockItemBySupplier } from '../db/database';
import type { AppSettings } from './settings';

export type ThermalAlign = 'left' | 'center' | 'right';

export type ThermalOp =
  /** A single line of text. `size` is the font pixel size (24 = default). */
  | { t: 'text'; text: string; align?: ThermalAlign; size?: number; bold?: boolean }
  /** Left-right justified row (label + value). */
  | { t: 'row'; left: string; right: string; size?: number; bold?: boolean }
  /** Auto-wrapped paragraph. */
  | { t: 'wrap'; text: string; align?: ThermalAlign; size?: number; bold?: boolean }
  /** A single-line white-on-black band (used for emphasis). */
  | { t: 'band'; text: string; size?: number }
  /** Horizontal divider. */
  | { t: 'divider'; style?: 'solid' | 'dashed' }
  /** Blank vertical space in pixels. */
  | { t: 'space'; h: number }
  /** Big centered "sticker header" — shop name + top border. */
  | { t: 'header'; text: string }
  /** [ ] label — used on stickers for "Tested for Leaks" etc. */
  | { t: 'checkbox'; checked: boolean; label: string; size?: number }
  /** Draw a base64-encoded PNG/JPG data URI. Auto-scaled to fit `maxWidth`. */
  | { t: 'image'; dataUri: string; maxWidth?: number; align?: ThermalAlign };

export interface ThermalDoc {
  /** Extra rows fed at end of print (in dots, ~200/inch on PD01). */
  feedRows?: number;
  ops: ThermalOp[];
}

/* -------------------------------------------------------------------------- */
/*                          Small helpers                                     */
/* -------------------------------------------------------------------------- */

function money(n: number): string {
  return `$${(n || 0).toFixed(2)}`;
}
function fmtDate(iso?: string | null): string {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  } catch {
    return String(iso);
  }
}

function shopHeader(settings: AppSettings): ThermalOp[] {
  const ops: ThermalOp[] = [];
  ops.push({ t: 'header', text: (settings.garageName || 'Mass Power Auto').toUpperCase() });
  if (settings.garagePhone) {
    ops.push({ t: 'text', text: settings.garagePhone, align: 'center', size: 20 });
  }
  ops.push({ t: 'space', h: 6 });
  return ops;
}

/* -------------------------------------------------------------------------- */
/*                           Public builders                                  */
/* -------------------------------------------------------------------------- */

/** Thermal customer receipt (mirrors buildThermalReceiptHtml). */
export function buildThermalReceiptDoc(
  customer: Customer,
  vehicle: Vehicle,
  service: Service,
  settings: AppSettings
): ThermalDoc {
  const ops: ThermalOp[] = [];
  ops.push(...shopHeader(settings));

  ops.push({ t: 'text', text: 'CUSTOMER RECEIPT', align: 'center', size: 22, bold: true });
  ops.push({ t: 'divider', style: 'dashed' });

  ops.push({ t: 'row', left: 'Customer', right: customer.name || '' });
  if (customer.mobile_number) {
    ops.push({ t: 'row', left: 'Phone', right: customer.mobile_number });
  }
  ops.push({ t: 'row', left: 'Vehicle', right: [vehicle.make, vehicle.model].filter(Boolean).join(' ') });
  if (vehicle.year) ops.push({ t: 'row', left: 'Year', right: vehicle.year });
  if (vehicle.plate_number) ops.push({ t: 'row', left: 'Plate', right: vehicle.plate_number });
  if (vehicle.vin) ops.push({ t: 'row', left: 'VIN', right: vehicle.vin });

  ops.push({ t: 'divider', style: 'dashed' });
  ops.push({ t: 'text', text: 'SERVICE', align: 'left', size: 22, bold: true });
  ops.push({ t: 'wrap', text: service.service_description || '', size: 22, bold: true });
  if (service.additional_info) {
    ops.push({ t: 'wrap', text: service.additional_info, size: 20 });
  }
  ops.push({ t: 'row', left: 'Date', right: fmtDate(service.service_date) });

  ops.push({ t: 'divider', style: 'dashed' });
  ops.push({ t: 'row', left: 'TOTAL', right: money(service.cost), size: 28, bold: true });
  if (service.partial_paid && service.partial_paid > 0) {
    ops.push({ t: 'row', left: 'Paid', right: money(service.partial_paid), size: 22 });
    const remaining = Math.max(0, service.cost - service.partial_paid);
    ops.push({ t: 'row', left: 'Remaining', right: money(remaining), size: 22, bold: true });
  }
  ops.push({
    t: 'band',
    text: service.is_paid ? 'PAID' : 'UNPAID',
    size: 26,
  });

  ops.push({ t: 'space', h: 12 });
  ops.push({ t: 'text', text: 'Thank you!', align: 'center', size: 20, bold: true });
  return { ops, feedRows: 40 };
}

/** Oil-change sticker. */
export function buildOilStickerDoc(
  _customer: Customer,
  vehicle: Vehicle,
  service: Service,
  settings: AppSettings
): ThermalDoc {
  const ops: ThermalOp[] = [];
  ops.push({ t: 'header', text: (settings.garageName || 'Mass Power Auto').toUpperCase() });
  ops.push({ t: 'space', h: 4 });
  ops.push({
    t: 'text',
    text: [vehicle.make, vehicle.model].filter(Boolean).join(' ').toUpperCase(),
    align: 'center',
    size: 26,
    bold: true,
  });
  ops.push({ t: 'divider', style: 'dashed' });
  ops.push({ t: 'text', text: 'NEXT OIL CHANGE', align: 'center', size: 22, bold: true });
  ops.push({ t: 'space', h: 4 });

  if (service.next_service_date) {
    ops.push({ t: 'row', left: 'DATE', right: fmtDate(service.next_service_date), size: 24, bold: true });
  }
  if (service.next_service_mileage) {
    ops.push({ t: 'row', left: 'KM', right: String(service.next_service_mileage), size: 24, bold: true });
  }
  ops.push({ t: 'divider', style: 'dashed' });
  if (vehicle.plate_number) {
    ops.push({ t: 'text', text: `Plate: ${vehicle.plate_number}`, align: 'center', size: 18 });
  }
  if (settings.garagePhone) {
    ops.push({ t: 'text', text: settings.garagePhone, align: 'center', size: 18 });
  }
  return { ops, feedRows: 30 };
}

/** Battery-replacement sticker. */
export function buildBatteryStickerDoc(
  _customer: Customer,
  vehicle: Vehicle,
  service: Service,
  settings: AppSettings
): ThermalDoc {
  const ops: ThermalOp[] = [];
  ops.push({ t: 'header', text: (settings.garageName || 'Mass Power Auto').toUpperCase() });
  ops.push({ t: 'space', h: 4 });
  ops.push({
    t: 'text',
    text: [vehicle.make, vehicle.model].filter(Boolean).join(' ').toUpperCase(),
    align: 'center',
    size: 24,
    bold: true,
  });
  ops.push({ t: 'divider', style: 'dashed' });
  ops.push({ t: 'text', text: 'BATTERY REPLACEMENT', align: 'center', size: 22, bold: true });
  ops.push({ t: 'space', h: 4 });

  if (service.battery_install_date) {
    ops.push({ t: 'row', left: 'INSTALLED', right: fmtDate(service.battery_install_date), size: 22, bold: true });
  }
  if (service.battery_amp_rate) {
    ops.push({ t: 'row', left: 'AMP RATE', right: service.battery_amp_rate, size: 22, bold: true });
  }
  ops.push({ t: 'divider', style: 'dashed' });
  ops.push({ t: 'checkbox', checked: !!service.battery_parasitic_tested, label: 'Parasitic Draw Tested', size: 18 });
  if (vehicle.plate_number) {
    ops.push({ t: 'space', h: 4 });
    ops.push({ t: 'text', text: `Plate: ${vehicle.plate_number}`, align: 'center', size: 18 });
  }
  if (settings.garagePhone) {
    ops.push({ t: 'text', text: settings.garagePhone, align: 'center', size: 18 });
  }
  return { ops, feedRows: 30 };
}

/** HVAC sticker. */
export function buildHvacStickerDoc(
  _customer: Customer,
  vehicle: Vehicle,
  service: Service,
  settings: AppSettings
): ThermalDoc {
  const desc = (service.additional_info || '').trim();
  const ops: ThermalOp[] = [];
  ops.push({ t: 'header', text: (settings.garageName || 'Mass Power Auto').toUpperCase() });
  ops.push({ t: 'space', h: 4 });
  ops.push({
    t: 'text',
    text: [vehicle.make, vehicle.model].filter(Boolean).join(' ').toUpperCase(),
    align: 'center',
    size: 24,
    bold: true,
  });
  ops.push({ t: 'divider', style: 'dashed' });
  ops.push({ t: 'text', text: 'HVAC / AC SERVICE', align: 'center', size: 22, bold: true });
  ops.push({ t: 'space', h: 4 });
  ops.push({
    t: 'band',
    text: (desc ? desc : 'HVAC SERVICE PERFORMED').toUpperCase(),
    size: 22,
  });
  if (service.hvac_freon_date) {
    ops.push({ t: 'row', left: 'DATE', right: fmtDate(service.hvac_freon_date), size: 22, bold: true });
  }
  ops.push({ t: 'divider', style: 'dashed' });
  ops.push({ t: 'checkbox', checked: !!service.hvac_leak_tested, label: 'Tested for Leaks', size: 18 });
  if (vehicle.plate_number) {
    ops.push({ t: 'space', h: 4 });
    ops.push({ t: 'text', text: `Plate: ${vehicle.plate_number}`, align: 'center', size: 18 });
  }
  if (settings.garagePhone) {
    ops.push({ t: 'text', text: settings.garagePhone, align: 'center', size: 18 });
  }
  return { ops, feedRows: 30 };
}

/** Combined invoice — bundles multiple services with a flat discount. */
export function buildCombinedInvoiceDoc(
  customer: Customer,
  vehicles: Vehicle[],
  services: Service[],
  discount: number,
  settings: AppSettings
): ThermalDoc {
  const ops: ThermalOp[] = [];
  ops.push(...shopHeader(settings));
  ops.push({ t: 'text', text: 'COMBINED INVOICE', align: 'center', size: 22, bold: true });
  ops.push({ t: 'divider', style: 'dashed' });
  ops.push({ t: 'row', left: 'Customer', right: customer.name || '' });
  if (customer.mobile_number) ops.push({ t: 'row', left: 'Phone', right: customer.mobile_number });
  ops.push({ t: 'row', left: 'Date', right: new Date().toLocaleDateString('en-GB') });
  ops.push({ t: 'divider', style: 'dashed' });

  const vMap = new Map<string, Vehicle>();
  for (const v of vehicles) vMap.set(v.id, v);
  const sorted = [...services].sort((a, b) => (a.service_date < b.service_date ? 1 : -1));

  let subtotal = 0;
  for (const s of sorted) {
    subtotal += s.cost || 0;
    const v = vMap.get(s.vehicle_id);
    const vLabel = v ? [v.make, v.model, v.plate_number].filter(Boolean).join(' ') : '';
    if (vLabel) {
      ops.push({ t: 'wrap', text: vLabel.toUpperCase(), size: 20, bold: true });
    }
    ops.push({ t: 'wrap', text: s.service_description || '', size: 20 });
    ops.push({
      t: 'row',
      left: fmtDate(s.service_date),
      right: money(s.cost),
      size: 22,
      bold: true,
    });
    if (s.partial_paid && s.partial_paid > 0) {
      ops.push({ t: 'row', left: '  Paid', right: money(s.partial_paid), size: 18 });
    }
    ops.push({ t: 'space', h: 4 });
  }

  ops.push({ t: 'divider', style: 'dashed' });
  ops.push({ t: 'row', left: 'Subtotal', right: money(subtotal), size: 22 });
  if (discount > 0) {
    ops.push({ t: 'row', left: 'Discount', right: `- ${money(discount)}`, size: 22 });
  }
  const total = Math.max(0, subtotal - discount);
  ops.push({ t: 'row', left: 'TOTAL', right: money(total), size: 28, bold: true });
  ops.push({ t: 'space', h: 10 });
  ops.push({ t: 'text', text: 'Thank you!', align: 'center', size: 20, bold: true });
  return { ops, feedRows: 40 };
}

/** Price-stickers (inventory retail prices). One item per band, 2-column layout. */
export function buildPriceStickersDoc(items: InventoryItem[], garageName: string): ThermalDoc {
  const ops: ThermalOp[] = [];
  for (const it of items) {
    ops.push({ t: 'text', text: garageName.toUpperCase(), align: 'center', size: 16 });
    ops.push({ t: 'text', text: (it.item_type || '').toUpperCase(), align: 'center', size: 22, bold: true });
    if (it.item_code) {
      ops.push({ t: 'text', text: `Code: ${it.item_code}`, align: 'center', size: 16 });
    }
    ops.push({
      t: 'band',
      text: money(it.item_retail_price || it.item_price || 0),
      size: 32,
    });
    ops.push({ t: 'divider', style: 'dashed' });
    ops.push({ t: 'space', h: 4 });
  }
  if (ops.length === 0) {
    ops.push({ t: 'text', text: 'No items selected', align: 'center', size: 20 });
  }
  return { ops, feedRows: 30 };
}

/** Reorder-by-supplier report. */
export function buildReorderDoc(
  groups: LowStockItemBySupplier[],
  garageName: string,
  garagePhone: string,
  threshold: number
): ThermalDoc {
  const ops: ThermalOp[] = [];
  ops.push({ t: 'header', text: (garageName || 'Mass Power Auto').toUpperCase() });
  if (garagePhone) ops.push({ t: 'text', text: garagePhone, align: 'center', size: 18 });
  ops.push({ t: 'space', h: 4 });
  ops.push({ t: 'text', text: 'REORDER REPORT', align: 'center', size: 22, bold: true });
  ops.push({
    t: 'text',
    text: `Items ≤ ${threshold} in stock`,
    align: 'center',
    size: 18,
  });
  ops.push({ t: 'divider', style: 'dashed' });

  if (!groups.length) {
    ops.push({ t: 'text', text: 'Everything is in stock.', align: 'center', size: 20 });
    return { ops, feedRows: 30 };
  }
  for (const g of groups) {
    ops.push({ t: 'text', text: (g.supplier_name || 'No Supplier').toUpperCase(), size: 22, bold: true, align: 'left' });
    for (const it of g.items) {
      ops.push({
        t: 'row',
        left: it.item_type || '',
        right: `${it.item_quantity}`,
        size: 20,
      });
      if (it.item_code) {
        ops.push({ t: 'text', text: `  ${it.item_code}`, size: 16, align: 'left' });
      }
    }
    ops.push({ t: 'divider', style: 'dashed' });
  }
  return { ops, feedRows: 40 };
}

/** Vehicle QR sticker (needs a QR data URI passed in). */
export function buildVehicleQrDoc(
  vehicle: Vehicle,
  qrDataUri: string,
  garageName: string
): ThermalDoc {
  const ops: ThermalOp[] = [];
  ops.push({ t: 'header', text: (garageName || 'Mass Power Auto').toUpperCase() });
  ops.push({
    t: 'text',
    text: [vehicle.make, vehicle.model].filter(Boolean).join(' ').toUpperCase(),
    align: 'center',
    size: 22,
    bold: true,
  });
  if (vehicle.plate_number) {
    ops.push({ t: 'text', text: vehicle.plate_number, align: 'center', size: 18, bold: true });
  }
  ops.push({ t: 'space', h: 6 });
  if (qrDataUri) {
    ops.push({ t: 'image', dataUri: qrDataUri, maxWidth: 300, align: 'center' });
  }
  ops.push({ t: 'space', h: 4 });
  ops.push({ t: 'text', text: 'SCAN FOR SERVICE HISTORY', align: 'center', size: 16, bold: true });
  return { ops, feedRows: 30 };
}

/** Monthly Data-Matrix guarantee sticker. */
export function buildGuaranteeStickerDoc(
  dmDataUri: string,
  monthLabel: string
): ThermalDoc {
  const ops: ThermalOp[] = [];
  ops.push({ t: 'text', text: 'MASS POWER', align: 'center', size: 26, bold: true });
  ops.push({ t: 'text', text: 'GUARANTEE', align: 'center', size: 18, bold: true });
  ops.push({ t: 'space', h: 6 });
  if (dmDataUri) {
    ops.push({ t: 'image', dataUri: dmDataUri, maxWidth: 160, align: 'center' });
  }
  ops.push({ t: 'space', h: 4 });
  ops.push({ t: 'text', text: monthLabel, align: 'center', size: 20, bold: true });
  return { ops, feedRows: 30 };
}
