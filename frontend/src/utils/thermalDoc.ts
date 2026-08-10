/**
 * ThermalDoc — structured, canvas-friendly print job for the Cat Printer.
 */
import type { Customer, Service, Vehicle, InventoryItem, LowStockItemBySupplier } from '../db/database';
import type { AppSettings } from './settings';

export type ThermalAlign = 'left' | 'center' | 'right';
export type ThermalFontFamily = 'sans' | 'mono';

export type ThermalOp =
  /** Shop name with thick underline */
  | { t: 'shop_title'; text: string }
  /** Vehicle name with thick underline */
  | { t: 'header'; text: string; size?: number; letterSpacing?: number }
  /** Label + value pair (left/right aligned) */
  | { t: 'label_value'; label: string; value: string; unit?: string }
  /** Horizontal divider */
  | { t: 'divider'; style?: 'solid' | 'dashed'; thick?: number }
  /** Blank space */
  | { t: 'space'; h: number }
  /** Checkbox with label */
  | { t: 'checkbox'; checked: boolean; label: string; size?: number }
  /** Footer text */
  | { t: 'footer'; text: string; size?: number };

export interface ThermalDoc {
  feedRows?: number;
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

/* -------------------------------------------------------------------------- */
/*                           Public builders                                  */
/* -------------------------------------------------------------------------- */

/**
 * Oil-change sticker - Audi A8 oil sticker look applied globally
 * Works for ANY vehicle (Audi, BMW, Toyota, etc.)
 */
export function buildOilStickerDoc(
  _customer: Customer,
  vehicle: Vehicle,
  service: Service,
  settings: AppSettings
): ThermalDoc {
  const ops: ThermalOp[] = [];
  const brand = [vehicle.make, vehicle.model].filter(Boolean).join(' ').trim().toUpperCase();

  // Shop name with thick underline
  ops.push({ t: 'shop_title', text: (settings.garageName || 'Mass Power Auto').toUpperCase() });
  ops.push({ t: 'space', h: 4 });
  
  // Vehicle brand with thick underline - THIS IS THE FIX
  ops.push({ t: 'header', text: brand, size: 28, letterSpacing: 2 });
  ops.push({ t: 'space', h: 6 });
  
  ops.push({ t: 'space', h: 6 });
  ops.push({ t: 'header', text: 'NEXT OIL CHANGE', size: 18, letterSpacing: 2 });
  ops.push({ t: 'space', h: 6 });

  if (service.oil_grade) {
    ops.push({ t: 'label_value', label: 'OIL', value: service.oil_grade });
  }
  if (service.next_service_mileage) {
    ops.push({ t: 'label_value', label: 'MILEAGE', value: service.next_service_mileage.toLocaleString(), unit: 'KM' });
  }
  if (service.next_service_date) {
    ops.push({ t: 'label_value', label: 'DATE', value: fmtDate(service.next_service_date) });
  }
  ops.push({ t: 'divider', style: 'dashed' });
  ops.push({ t: 'checkbox', checked: !!service.oil_filter_changed, label: 'Filter Change', size: 20 });
  ops.push({ t: 'space', h: 4 });
  ops.push({ t: 'footer', text: 'NEXT SERVICE DUE' });
  
  return { ops, frame: true, feedRows: 30 };
}

/**
 * Battery-replacement sticker.
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

  ops.push({ t: 'shop_title', text: (settings.garageName || 'Mass Power Auto').toUpperCase() });
  ops.push({ t: 'space', h: 4 });
  ops.push({ t: 'header', text: brand, size: 28, letterSpacing: 2 });
  ops.push({ t: 'space', h: 6 });
  ops.push({ t: 'header', text: 'BATTERY REPLACEMENT', size: 18, letterSpacing: 2 });
  ops.push({ t: 'space', h: 6 });

  if (service.battery_amp_rate) {
    ops.push({ t: 'label_value', label: 'AMP RATE', value: service.battery_amp_rate });
  }
  if (service.battery_install_date) {
    ops.push({ t: 'label_value', label: 'INSTALLED', value: fmtDate(service.battery_install_date) });
  }
  if (warrantyLabel) {
    ops.push({ t: 'space', h: 4 });
    ops.push({ t: 'header', text: `WARRANTY ${warrantyLabel}`, size: 16, letterSpacing: 1 });
  }
  if (warrantyExpiryFormatted) {
    ops.push({ t: 'label_value', label: 'EXPIRES', value: warrantyExpiryFormatted });
  }
  ops.push({ t: 'divider', style: 'dashed' });
  ops.push({ t: 'checkbox', checked: !!service.battery_parasitic_tested, label: 'Parasitic Draw Tested', size: 18 });
  if (vehicle.plate_number) {
    ops.push({ t: 'divider', style: 'dashed' });
    ops.push({ t: 'footer', text: vehicle.plate_number });
  }
  return { ops, frame: true, feedRows: 30 };
}

/**
 * HVAC sticker.
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

  ops.push({ t: 'shop_title', text: (settings.garageName || 'Mass Power Auto').toUpperCase() });
  ops.push({ t: 'space', h: 4 });
  ops.push({ t: 'header', text: brand, size: 28, letterSpacing: 2 });
  ops.push({ t: 'space', h: 6 });
  ops.push({ t: 'header', text: 'HVAC / AC SERVICE', size: 18, letterSpacing: 2 });
  ops.push({ t: 'space', h: 6 });
  ops.push({ t: 'header', text: (desc ? desc : 'HVAC SERVICE PERFORMED').toUpperCase(), size: 20, letterSpacing: 1 });
  if (service.hvac_freon_date) {
    ops.push({ t: 'label_value', label: 'DATE', value: fmtDate(service.hvac_freon_date) });
  }
  ops.push({ t: 'divider', style: 'dashed' });
  ops.push({ t: 'checkbox', checked: !!service.hvac_leak_tested, label: 'Tested for Leaks', size: 18 });
  if (vehicle.plate_number) {
    ops.push({ t: 'divider', style: 'dashed' });
    ops.push({ t: 'footer', text: vehicle.plate_number });
  }
  return { ops, frame: true, feedRows: 30 };
}

/**
 * Thermal customer receipt.
 */
export function buildThermalReceiptDoc(
  customer: Customer,
  vehicle: Vehicle,
  service: Service,
  settings: AppSettings
): ThermalDoc {
  const ops: ThermalOp[] = [];

  ops.push({ t: 'shop_title', text: (settings.garageName || 'Mass Power Auto').toUpperCase() });
  if (settings.garagePhone) {
    ops.push({ t: 'footer', text: settings.garagePhone });
  }
  ops.push({ t: 'divider', style: 'dashed' });

  ops.push({ t: 'header', text: 'SERVICE RECEIPT', size: 18, letterSpacing: 1 });
  try {
    ops.push({ t: 'label_value', label: 'DATE', value: new Date(service.service_date).toLocaleString() });
  } catch { /* ignore */ }
  ops.push({ t: 'divider', style: 'dashed' });

  ops.push({ t: 'header', text: 'CUSTOMER', size: 16, letterSpacing: 1 });
  ops.push({ t: 'label_value', label: 'NAME', value: customer.name || '' });
  if (customer.mobile_number) {
    ops.push({ t: 'label_value', label: 'MOBILE', value: customer.mobile_number });
  }
  ops.push({ t: 'divider', style: 'dashed' });

  ops.push({ t: 'header', text: 'VEHICLE', size: 16, letterSpacing: 1 });
  const vLine = [vehicle.year || '', vehicle.make, vehicle.model].filter(Boolean).join(' ');
  ops.push({ t: 'label_value', label: 'MAKE/MODEL', value: vLine });
  if (vehicle.plate_number) ops.push({ t: 'label_value', label: 'PLATE', value: vehicle.plate_number });
  if (vehicle.vin) ops.push({ t: 'label_value', label: 'VIN', value: vehicle.vin });
  if (service.current_mileage) {
    ops.push({ t: 'label_value', label: 'MILEAGE', value: service.current_mileage.toLocaleString(), unit: 'KM' });
  }
  ops.push({ t: 'divider', style: 'dashed' });

  ops.push({ t: 'header', text: 'SERVICE', size: 16, letterSpacing: 1 });
  ops.push({ t: 'label_value', label: 'DESCRIPTION', value: service.service_description || '' });
  if (service.additional_info) {
    ops.push({ t: 'label_value', label: 'NOTES', value: service.additional_info });
  }
  ops.push({ t: 'divider', style: 'dashed' });

  ops.push({ t: 'label_value', label: 'TOTAL', value: money(service.cost) });
  if (service.partial_paid && service.partial_paid > 0) {
    const remaining = Math.max(0, service.cost - service.partial_paid);
    ops.push({ t: 'label_value', label: 'PAID', value: money(service.partial_paid) });
    ops.push({ t: 'label_value', label: 'REMAINING', value: money(remaining) });
  }
  ops.push({ t: 'header', text: service.is_paid ? 'PAID' : 'UNPAID', size: 18, letterSpacing: 1 });

  const hasOilReminder = !!(service.next_service_date || service.next_service_mileage);
  if (hasOilReminder) {
    ops.push({ t: 'space', h: 6 });
    ops.push({ t: 'divider', style: 'solid' });
    ops.push({ t: 'header', text: 'NEXT OIL CHANGE', size: 18, letterSpacing: 2 });
    if (service.next_service_date) {
      ops.push({ t: 'label_value', label: 'DATE', value: fmtDate(service.next_service_date) });
    }
    if (service.next_service_mileage) {
      ops.push({ t: 'label_value', label: 'MILEAGE', value: service.next_service_mileage.toLocaleString(), unit: 'KM' });
    }
    ops.push({ t: 'divider', style: 'solid' });
  } else {
    ops.push({ t: 'divider', style: 'dashed' });
  }

  ops.push({ t: 'footer', text: 'Thank You!' });
  ops.push({ t: 'footer', text: settings.garageName || '' });
  return { ops, feedRows: 40 };
}

/** Combined invoice */
export function buildCombinedInvoiceDoc(
  customer: Customer,
  vehicles: Vehicle[],
  services: Service[],
  discount: number,
  settings: AppSettings
): ThermalDoc {
  const ops: ThermalOp[] = [];
  ops.push({ t: 'shop_title', text: (settings.garageName || 'Mass Power Auto').toUpperCase() });
  if (settings.garagePhone) {
    ops.push({ t: 'footer', text: settings.garagePhone });
  }
  ops.push({ t: 'divider', style: 'dashed' });
  ops.push({ t: 'header', text: 'COMBINED INVOICE', size: 18, letterSpacing: 1 });
  ops.push({ t: 'label_value', label: 'CUSTOMER', value: customer.name || '' });
  if (customer.mobile_number) ops.push({ t: 'label_value', label: 'PHONE', value: customer.mobile_number });
  ops.push({ t: 'label_value', label: 'DATE', value: new Date().toLocaleDateString('en-GB') });
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
      ops.push({ t: 'label_value', label: 'VEHICLE', value: vLabel.toUpperCase() });
    }
    ops.push({ t: 'label_value', label: 'SERVICE', value: s.service_description || '' });
    ops.push({ t: 'label_value', label: 'DATE', value: fmtDate(s.service_date), unit: money(s.cost) });
    if (s.partial_paid && s.partial_paid > 0) {
      ops.push({ t: 'label_value', label: 'PAID', value: money(s.partial_paid) });
    }
    ops.push({ t: 'space', h: 4 });
  }

  ops.push({ t: 'divider', style: 'dashed' });
  ops.push({ t: 'label_value', label: 'SUBTOTAL', value: money(subtotal) });
  if (discount > 0) {
    ops.push({ t: 'label_value', label: 'DISCOUNT', value: `- ${money(discount)}` });
  }
  const total = Math.max(0, subtotal - discount);
  ops.push({ t: 'label_value', label: 'TOTAL', value: money(total) });
  ops.push({ t: 'space', h: 6 });
  ops.push({ t: 'footer', text: 'Thank you!' });
  return { ops, feedRows: 40 };
}

/** Price stickers */
export function buildPriceStickersDoc(items: InventoryItem[], garageName: string): ThermalDoc {
  const ops: ThermalOp[] = [];
  for (const it of items) {
    ops.push({ t: 'shop_title', text: garageName.toUpperCase() });
    ops.push({ t: 'header', text: (it.item_type || '').toUpperCase(), size: 20, letterSpacing: 1 });
    if (it.item_code) {
      ops.push({ t: 'footer', text: `Code: ${it.item_code}` });
    }
    ops.push({ t: 'header', text: money(it.item_retail_price || it.item_price || 0), size: 30, letterSpacing: 1 });
    ops.push({ t: 'divider', style: 'dashed' });
    ops.push({ t: 'space', h: 4 });
  }
  if (ops.length === 0) {
    ops.push({ t: 'footer', text: 'No items selected' });
  }
  return { ops, feedRows: 30 };
}

/** Reorder by supplier report */
export function buildReorderDoc(
  groups: LowStockItemBySupplier[],
  garageName: string,
  garagePhone: string,
  threshold: number
): ThermalDoc {
  const ops: ThermalOp[] = [];
  ops.push({ t: 'shop_title', text: (garageName || 'Mass Power Auto').toUpperCase() });
  if (garagePhone) ops.push({ t: 'footer', text: garagePhone });
  ops.push({ t: 'space', h: 4 });
  ops.push({ t: 'header', text: 'REORDER REPORT', size: 20, letterSpacing: 2 });
  ops.push({ t: 'footer', text: `Items ≤ ${threshold} in stock` });
  ops.push({ t: 'divider', style: 'dashed' });

  if (!groups.length) {
    ops.push({ t: 'footer', text: 'Everything is in stock.' });
    return { ops, feedRows: 30 };
  }
  for (const g of groups) {
    ops.push({ t: 'header', text: (g.supplier_name || 'No Supplier').toUpperCase(), size: 18, letterSpacing: 1 });
    for (const it of g.items) {
      ops.push({ t: 'label_value', label: it.item_type || '', value: `${it.item_quantity}` });
      if (it.item_code) {
        ops.push({ t: 'footer', text: `  ${it.item_code}` });
      }
    }
    ops.push({ t: 'divider', style: 'dashed' });
  }
  return { ops, feedRows: 40 };
}

/** Vehicle QR sticker */
export function buildVehicleQrDoc(
  vehicle: Vehicle,
  qrDataUri: string,
  garageName: string
): ThermalDoc {
  const ops: ThermalOp[] = [];
  ops.push({ t: 'shop_title', text: (garageName || 'Mass Power Auto').toUpperCase() });
  ops.push({ t: 'header', text: [vehicle.make, vehicle.model].filter(Boolean).join(' ').toUpperCase(), size: 22, letterSpacing: 1 });
  if (vehicle.plate_number) {
    ops.push({ t: 'footer', text: vehicle.plate_number });
  }
  ops.push({ t: 'space', h: 6 });
  // QR code image would go here
  ops.push({ t: 'space', h: 4 });
  ops.push({ t: 'footer', text: 'SCAN FOR SERVICE HISTORY' });
  return { ops, frame: true, feedRows: 30 };
}

/** Guarantee sticker */
export function buildGuaranteeStickerDoc(
  dmDataUri: string,
  monthLabel: string
): ThermalDoc {
  const ops: ThermalOp[] = [];
  ops.push({ t: 'shop_title', text: 'MASS POWER AUTO' });
  ops.push({ t: 'header', text: 'GUARANTEE', size: 18, letterSpacing: 2 });
  ops.push({ t: 'space', h: 6 });
  // Data matrix image would go here
  ops.push({ t: 'space', h: 4 });
  ops.push({ t: 'footer', text: monthLabel });
  return { ops, frame: true, feedRows: 20 };
}
