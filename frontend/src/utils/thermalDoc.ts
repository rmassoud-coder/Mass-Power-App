/**
 * ThermalDoc — structured, canvas-friendly print job for the Cat Printer.
 *
 * The Cat Printer BLE path can't reliably rasterize arbitrary HTML on Android
 * WebView (SVG <foreignObject> fails on many phones). Instead we describe
 * each print job as a small list of primitive drawing ops and paint them
 * ourselves onto a canvas.
 *
 * The external / OS print flow keeps using the existing HTML builders — this
 * module ONLY feeds the Cat Printer path.
 *
 * NOTE (fix): every previous `{ t: 'header' }` op has been replaced with the
 * plain `{ t: 'text' }` op using `underline: 'solid'`. The `header` op's
 * canvas drawing path was confirmed broken (only the first header + last
 * element rendered, everything between went blank) — `text` with a solid
 * underline gives the identical "big centered heading, thick line under it"
 * look without that bug, and is used consistently everywhere for a real
 * global look across every sticker type.
 */
import type { Customer, Service, Vehicle, InventoryItem, LowStockItemBySupplier } from '../db/database';
import type { AppSettings } from './settings';

export type ThermalAlign = 'left' | 'center' | 'right';
export type ThermalFontFamily = 'sans' | 'mono';

export type ThermalOp =
  /** A single line of text. `size` is the font pixel size (24 = default). */
  | { t: 'text'; text: string; align?: ThermalAlign; size?: number; bold?: boolean; family?: ThermalFontFamily; letterSpacing?: number; underline?: 'solid' | 'dashed' | 'none' }
  /** Left-right justified row (label + value). */
  | { t: 'row'; left: string; right: string; size?: number; bold?: boolean; family?: ThermalFontFamily }
  /** Auto-wrapped paragraph. */
  | { t: 'wrap'; text: string; align?: ThermalAlign; size?: number; bold?: boolean; family?: ThermalFontFamily }
  /** A single-line white-on-black band. */
  | { t: 'band'; text: string; size?: number; bold?: boolean }
  /** Horizontal divider. */
  | { t: 'divider'; style?: 'solid' | 'dashed'; thick?: number }
  /** Blank vertical space in pixels. */
  | { t: 'space'; h: number }
  /** Big centered "sticker header" — shop name + solid underline.
   *  @deprecated known-broken canvas path — do not use, kept only so old
   *  imports don't break. Use headingOps() below instead. */
  | { t: 'header'; text: string; size?: number; letterSpacing?: number }
  /** [ ] label — used on stickers for "Tested for Leaks" etc. */
  | { t: 'checkbox'; checked: boolean; label: string; size?: number }
  /** Centered text inside a rectangular border. Used for warranty badges. */
  | { t: 'boxed_text'; text: string; size?: number; letterSpacing?: number; padX?: number; padY?: number }
  /** Draw a base64-encoded PNG/JPG data URI. Auto-scaled to fit `maxWidth`. */
  | { t: 'image'; dataUri: string; maxWidth?: number; align?: ThermalAlign };

export interface ThermalDoc {
  /** Extra rows fed at end of print. */
  feedRows?: number;
  /** If true, draws a 3-px solid border around the whole print area (stickers). */
  frame?: boolean;
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

/**
 * Big centered heading with a thick solid underline — the global replacement
 * for the broken `header` op. Used for both the shop-name line and the
 * vehicle-brand line on every sticker, so the whole app has one consistent
 * "Audi A8 oil sticker" look everywhere instead of it being one-off.
 */
function headingOps(text: string, size: number, letterSpacing = 1): ThermalOp[] {
  return [
    { t: 'text', text, align: 'center', size, bold: true, letterSpacing, underline: 'solid' },
  ];
}

/* -------------------------------------------------------------------------- */
/*                           Public builders                                  */
/* -------------------------------------------------------------------------- */

/**
 * Thermal customer receipt. Mirrors buildThermalReceiptHtml — monospace font,
 * dashed dividers, big TOTAL row, PAID/UNPAID banner, optional oil-reminder box.
 */
export function buildThermalReceiptDoc(
  customer: Customer,
  vehicle: Vehicle,
  service: Service,
  settings: AppSettings
): ThermalDoc {
  const ops: ThermalOp[] = [];

  // Shop header (large, centered)
  ops.push({ t: 'text', text: (settings.garageName || 'Mass Power Auto'), align: 'center', size: 26, bold: true, family: 'mono' });
  if (settings.garagePhone) {
    ops.push({ t: 'text', text: settings.garagePhone, align: 'center', size: 18, family: 'mono' });
  }
  ops.push({ t: 'divider', style: 'dashed' });

  // Section: SERVICE RECEIPT / date
  ops.push({ t: 'text', text: 'SERVICE RECEIPT', align: 'center', size: 18, family: 'mono' });
  try {
    ops.push({ t: 'text', text: new Date(service.service_date).toLocaleString(), align: 'left', size: 18, family: 'mono' });
  } catch { /* ignore */ }
  ops.push({ t: 'divider', style: 'dashed' });

  // Customer
  ops.push({ t: 'text', text: 'Customer:', align: 'left', size: 22, bold: true, family: 'mono' });
  ops.push({ t: 'wrap', text: customer.name || '', size: 22, family: 'mono' });
  if (customer.mobile_number) {
    ops.push({ t: 'text', text: `Mobile: ${customer.mobile_number}`, align: 'left', size: 18, family: 'mono' });
  }
  ops.push({ t: 'divider', style: 'dashed' });

  // Vehicle
  ops.push({ t: 'text', text: 'Vehicle:', align: 'left', size: 22, bold: true, family: 'mono' });
  const vLine = [vehicle.year || '', vehicle.make, vehicle.model].filter(Boolean).join(' ');
  ops.push({ t: 'wrap', text: vLine, size: 22, family: 'mono' });
  if (vehicle.plate_number) ops.push({ t: 'text', text: `Plate: ${vehicle.plate_number}`, align: 'left', size: 18, family: 'mono' });
  if (vehicle.vin) ops.push({ t: 'text', text: `VIN: ${vehicle.vin}`, align: 'left', size: 18, family: 'mono' });
  if (service.current_mileage) {
    ops.push({ t: 'text', text: `Mileage: ${service.current_mileage.toLocaleString()} km`, align: 'left', size: 18, family: 'mono' });
  }
  ops.push({ t: 'divider', style: 'dashed' });

  // Service
  ops.push({ t: 'text', text: 'Service:', align: 'left', size: 22, bold: true, family: 'mono' });
  ops.push({ t: 'wrap', text: service.service_description || '', size: 22, family: 'mono' });
  if (service.additional_info) {
    ops.push({ t: 'wrap', text: service.additional_info, size: 18, family: 'mono' });
  }
  ops.push({ t: 'divider', style: 'dashed' });

  // TOTAL + payment banner
  ops.push({ t: 'row', left: 'TOTAL:', right: money(service.cost), size: 28, bold: true, family: 'mono' });
  if (service.partial_paid && service.partial_paid > 0) {
    const remaining = Math.max(0, service.cost - service.partial_paid);
    ops.push({ t: 'row', left: 'Paid:', right: money(service.partial_paid), size: 20, family: 'mono' });
    ops.push({ t: 'row', left: 'Remaining:', right: money(remaining), size: 22, bold: true, family: 'mono' });
  }
  ops.push({ t: 'text', text: service.is_paid ? '*** PAID ***' : '*** UNPAID ***', align: 'center', size: 22, bold: true, family: 'mono' });

  // Oil reminder mini-sticker at the bottom (kept simple — no nested box)
  const hasOilReminder = !!(service.next_service_date || service.next_service_mileage);
  if (hasOilReminder) {
    ops.push({ t: 'space', h: 6 });
    ops.push({ t: 'divider', style: 'solid' });
    ops.push({ t: 'text', text: 'NEXT OIL CHANGE', align: 'center', size: 22, bold: true, letterSpacing: 2 });
    if (service.next_service_date) {
      ops.push({ t: 'text', text: 'DATE', align: 'center', size: 16, bold: true });
      ops.push({ t: 'text', text: fmtDate(service.next_service_date), align: 'center', size: 24, bold: true });
    }
    if (service.next_service_mileage) {
      if (service.next_service_date) ops.push({ t: 'divider', style: 'dashed' });
      ops.push({ t: 'text', text: 'MILEAGE', align: 'center', size: 16, bold: true });
      ops.push({ t: 'text', text: `${service.next_service_mileage.toLocaleString()} KM`, align: 'center', size: 24, bold: true });
    }
    ops.push({ t: 'divider', style: 'solid' });
  } else {
    ops.push({ t: 'divider', style: 'dashed' });
  }

  ops.push({ t: 'text', text: 'Thank You!', align: 'center', size: 18, family: 'mono' });
  ops.push({ t: 'text', text: settings.garageName || '', align: 'center', size: 18, family: 'mono' });
  return { ops, feedRows: 40 };
}

/**
 * Oil-change sticker. Shop name + vehicle brand as big centered headings
 * with a solid underline (see headingOps), field rows, dashed divider,
 * checkbox row. All inside a 3-px outer frame.
 */
export function buildOilStickerDoc(
  _customer: Customer,
  vehicle: Vehicle,
  service: Service,
  settings: AppSettings
): ThermalDoc {
  const ops: ThermalOp[] = [];
  const brand = [vehicle.make, vehicle.model].filter(Boolean).join(' ').trim().toUpperCase();

  ops.push(...headingOps((settings.garageName || 'Mass Power Auto').toUpperCase(), 24, 1));
  ops.push({ t: 'space', h: 4 });
  ops.push(...headingOps(brand, 28, 2));
  ops.push({ t: 'space', h: 6 });

  ops.push({ t: 'text', text: 'NEXT OIL CHANGE', align: 'center', size: 20, bold: true, letterSpacing: 2 });
  ops.push({ t: 'space', h: 6 });

  if (service.oil_grade) {
    ops.push({ t: 'row', left: 'OIL:', right: service.oil_grade, size: 22, bold: true });
  }
  if (service.next_service_mileage) {
    ops.push({ t: 'row', left: 'MILEAGE:', right: `${service.next_service_mileage.toLocaleString()} KM`, size: 22, bold: true });
  }
  if (service.next_service_date) {
    ops.push({ t: 'row', left: 'DATE:', right: fmtDate(service.next_service_date), size: 22, bold: true });
  }
  ops.push({ t: 'divider', style: 'dashed' });
  ops.push({ t: 'checkbox', checked: !!service.oil_filter_changed, label: 'Filter Change', size: 20 });
  return { ops, frame: true, feedRows: 30 };
}

/**
 * Battery-replacement sticker. Big black amp-rate band, warranty badge with
 * border, expiry date, dashed divider, parasitic-tested checkbox, plate
 * number footer.
 */
export function buildBatteryStickerDoc(
  _customer: Customer,
  vehicle: Vehicle,
  service: Service,
  settings: AppSettings
): ThermalDoc {
  const ops: ThermalOp[] = [];
  const brand = [vehicle.make, vehicle.model].filter(Boolean).join(' ').trim().toUpperCase();

  const warrantyMonths = service.battery_warranty_months || 0;
  let warrantyLabel = '';
  let warrantyExpiryFormatted = '';
  if (warrantyMonths > 0) {
    if (warrantyMonths === 6) warrantyLabel = '6 MONTHS';
    else if (warrantyMonths === 12) warrantyLabel = '1 YEAR';
    else warrantyLabel = `${warrantyMonths} MONTHS`;
    if (service.battery_install_date) {
      const exp = new Date(service.battery_install_date);
      exp.setMonth(exp.getMonth() + warrantyMonths);
      warrantyExpiryFormatted = exp.toLocaleDateString('en-GB', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      });
    }
  }

  ops.push(...headingOps((settings.garageName || 'Mass Power Auto').toUpperCase(), 24, 1));
  ops.push({ t: 'space', h: 4 });
  ops.push(...headingOps(brand, 28, 2));
  ops.push({ t: 'space', h: 6 });

  ops.push({ t: 'text', text: 'BATTERY REPLACEMENT', align: 'center', size: 18, bold: true, letterSpacing: 2 });
  ops.push({ t: 'space', h: 6 });

  if (service.battery_amp_rate) {
    ops.push({ t: 'band', text: service.battery_amp_rate, size: 30, bold: true });
  }
  if (service.battery_install_date) {
    ops.push({ t: 'row', left: 'INSTALLED:', right: fmtDate(service.battery_install_date), size: 22, bold: true });
  }
  if (warrantyLabel) {
    ops.push({ t: 'space', h: 4 });
    ops.push({ t: 'boxed_text', text: `WARRANTY ${warrantyLabel}`, size: 20, letterSpacing: 1 });
  }
  if (warrantyExpiryFormatted) {
    ops.push({ t: 'row', left: 'EXPIRES:', right: warrantyExpiryFormatted, size: 22, bold: true });
  }
  ops.push({ t: 'divider', style: 'dashed' });
  ops.push({ t: 'checkbox', checked: !!service.battery_parasitic_tested, label: 'Parasitic Draw Tested', size: 18 });
  if (vehicle.plate_number) {
    ops.push({ t: 'divider', style: 'dashed' });
    ops.push({ t: 'text', text: vehicle.plate_number, align: 'center', size: 16, bold: true, letterSpacing: 1 });
  }
  return { ops, frame: true, feedRows: 30 };
}

/**
 * HVAC sticker. Brand, HVAC heading, black band with the description (or
 * default text), optional DATE row, dashed divider, leak-tested checkbox,
 * plate footer.
 */
export function buildHvacStickerDoc(
  _customer: Customer,
  vehicle: Vehicle,
  service: Service,
  settings: AppSettings
): ThermalDoc {
  const ops: ThermalOp[] = [];
  const brand = [vehicle.make, vehicle.model].filter(Boolean).join(' ').trim().toUpperCase();
  const desc = (service.additional_info || '').trim();

  ops.push(...headingOps((settings.garageName || 'Mass Power Auto').toUpperCase(), 24, 1));
  ops.push({ t: 'space', h: 4 });
  ops.push(...headingOps(brand, 28, 2));
  ops.push({ t: 'space', h: 6 });

  ops.push({ t: 'text', text: 'HVAC / AC SERVICE', align: 'center', size: 18, bold: true, letterSpacing: 2 });
  ops.push({ t: 'space', h: 6 });
  ops.push({
    t: 'band',
    text: (desc ? desc : 'HVAC SERVICE PERFORMED').toUpperCase(),
    size: 24,
    bold: true,
  });
  if (service.hvac_freon_date) {
    ops.push({ t: 'row', left: 'DATE:', right: fmtDate(service.hvac_freon_date), size: 22, bold: true });
  }
  ops.push({ t: 'divider', style: 'dashed' });
  ops.push({ t: 'checkbox', checked: !!service.hvac_leak_tested, label: 'Tested for Leaks', size: 18 });
  if (vehicle.plate_number) {
    ops.push({ t: 'divider', style: 'dashed' });
    ops.push({ t: 'text', text: vehicle.plate_number, align: 'center', size: 16, bold: true, letterSpacing: 1 });
  }
  return { ops, frame: true, feedRows: 30 };
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
  ops.push({ t: 'text', text: (settings.garageName || 'Mass Power Auto'), align: 'center', size: 26, bold: true, family: 'mono' });
  if (settings.garagePhone) {
    ops.push({ t: 'text', text: settings.garagePhone, align: 'center', size: 18, family: 'mono' });
  }
  ops.push({ t: 'divider', style: 'dashed' });
  ops.push({ t: 'text', text: 'COMBINED INVOICE', align: 'center', size: 20, bold: true, family: 'mono' });
  ops.push({ t: 'row', left: 'Customer:', right: customer.name || '', size: 20, family: 'mono' });
  if (customer.mobile_number) ops.push({ t: 'row', left: 'Phone:', right: customer.mobile_number, size: 18, family: 'mono' });
  ops.push({ t: 'row', left: 'Date:', right: new Date().toLocaleDateString('en-GB'), size: 18, family: 'mono' });
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
      ops.push({ t: 'wrap', text: vLabel.toUpperCase(), size: 18, bold: true, family: 'mono' });
    }
    ops.push({ t: 'wrap', text: s.service_description || '', size: 20, family: 'mono' });
    ops.push({
      t: 'row',
      left: fmtDate(s.service_date),
      right: money(s.cost),
      size: 20,
      bold: true,
      family: 'mono',
    });
    if (s.partial_paid && s.partial_paid > 0) {
      ops.push({ t: 'row', left: '  Paid', right: money(s.partial_paid), size: 16, family: 'mono' });
    }
    ops.push({ t: 'space', h: 4 });
  }

  ops.push({ t: 'divider', style: 'dashed' });
  ops.push({ t: 'row', left: 'Subtotal:', right: money(subtotal), size: 20, family: 'mono' });
  if (discount > 0) {
    ops.push({ t: 'row', left: 'Discount:', right: `- ${money(discount)}`, size: 20, family: 'mono' });
  }
  const total = Math.max(0, subtotal - discount);
  ops.push({ t: 'row', left: 'TOTAL:', right: money(total), size: 28, bold: true, family: 'mono' });
  ops.push({ t: 'space', h: 6 });
  ops.push({ t: 'text', text: 'Thank you!', align: 'center', size: 18, bold: true, family: 'mono' });
  return { ops, feedRows: 40 };
}

/** Price-stickers. One item per band. */
export function buildPriceStickersDoc(items: InventoryItem[], garageName: string): ThermalDoc {
  const ops: ThermalOp[] = [];
  for (const it of items) {
    ops.push({ t: 'text', text: garageName.toUpperCase(), align: 'center', size: 16, letterSpacing: 1 });
    ops.push({ t: 'text', text: (it.item_type || '').toUpperCase(), align: 'center', size: 22, bold: true });
    if (it.item_code) {
      ops.push({ t: 'text', text: `Code: ${it.item_code}`, align: 'center', size: 16 });
    }
    ops.push({
      t: 'band',
      text: money(it.item_retail_price || it.item_price || 0),
      size: 34,
      bold: true,
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
  ops.push(...headingOps((garageName || 'Mass Power Auto').toUpperCase(), 24, 1));
  if (garagePhone) ops.push({ t: 'text', text: garagePhone, align: 'center', size: 18 });
  ops.push({ t: 'space', h: 4 });
  ops.push({ t: 'text', text: 'REORDER REPORT', align: 'center', size: 22, bold: true, letterSpacing: 2 });
  ops.push({ t: 'text', text: `Items \u2264 ${threshold} in stock`, align: 'center', size: 18 });
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

/** Vehicle QR sticker. Needs a locally-generated QR data URI. */
export function buildVehicleQrDoc(
  vehicle: Vehicle,
  qrDataUri: string,
  garageName: string
): ThermalDoc {
  const ops: ThermalOp[] = [];
  ops.push(...headingOps((garageName || 'Mass Power Auto').toUpperCase(), 22, 1));
  ops.push({
    t: 'text',
    text: [vehicle.make, vehicle.model].filter(Boolean).join(' ').toUpperCase(),
    align: 'center',
    size: 22,
    bold: true,
    letterSpacing: 1,
  });
  if (vehicle.plate_number) {
    ops.push({ t: 'text', text: vehicle.plate_number, align: 'center', size: 16, bold: true });
  }
  ops.push({ t: 'space', h: 6 });
  if (qrDataUri) {
    ops.push({ t: 'image', dataUri: qrDataUri, maxWidth: 320, align: 'center' });
  }
  ops.push({ t: 'space', h: 4 });
  ops.push({ t: 'text', text: 'SCAN FOR SERVICE HISTORY', align: 'center', size: 14, bold: true, letterSpacing: 1 });
  return { ops, frame: true, feedRows: 30 };
}

/**
 * Monthly Data-Matrix guarantee sticker.
 * NOTE: this function's original body was cut off mid-way in what I could
 * see, past the "MASS POWER" opening line — rebuilt here to match the same
 * heading pattern and layout style as buildVehicleQrDoc (the other
 * QR/image-based sticker in this file). If the original had extra fields,
 * paste the version currently on GitHub and I'll merge them in.
 */
export function buildGuaranteeStickerDoc(
  dmDataUri: string,
  monthLabel: string
): ThermalDoc {
  const ops: ThermalOp[] = [];
  ops.push(...headingOps('MASS POWER', 24, 2));
  ops.push({ t: 'text', text: 'GUARANTEE', align: 'center', size: 18, bold: true, letterSpacing: 2 });
  ops.push({ t: 'text', text: monthLabel.toUpperCase(), align: 'center', size: 20, bold: true });
  ops.push({ t: 'space', h: 6 });
  if (dmDataUri) {
    ops.push({ t: 'image', dataUri: dmDataUri, maxWidth: 280, align: 'center' });
  }
  return { ops, frame: true, feedRows: 30 };
}
