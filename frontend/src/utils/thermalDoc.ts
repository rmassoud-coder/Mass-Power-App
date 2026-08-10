/**
 * ThermalDoc — structured, canvas-friendly print job for the Cat Printer.
 */
import type { Customer, Service, Vehicle, InventoryItem, LowStockItemBySupplier } from '../db/database';
import type { AppSettings } from './settings';

export type ThermalAlign = 'left' | 'center' | 'right';
export type ThermalFontFamily = 'sans' | 'mono';

export type ThermalOp =
  | { t: 'shop_title'; text: string }
  | { t: 'header'; text: string; size?: number; letterSpacing?: number }
  | { t: 'label_value'; label: string; value: string; unit?: string }
  | { t: 'divider'; style?: 'solid' | 'dashed'; thick?: number }
  | { t: 'space'; h: number }
  | { t: 'checkbox'; checked: boolean; label: string; size?: number }
  | { t: 'footer'; text: string; size?: number };

export interface ThermalDoc {
  feedRows?: number;
  frame?: boolean;
  ops: ThermalOp[];
}

function money(n: number): string { return `$${(n || 0).toFixed(2)}`; }
function fmtDate(iso?: string | null): string {
  if (!iso) return '';
  try { return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' }); } 
  catch { return String(iso); }
}

/* -------------------------------------------------------------------------- */
/*                           OIL STICKER BUILDER                              */
/* -------------------------------------------------------------------------- */
export function buildOilStickerDoc(
  _customer: Customer,
  vehicle: Vehicle,
  service: Service,
  settings: AppSettings
): ThermalDoc {
  const ops: ThermalOp[] = [];
  const brand = [vehicle.make, vehicle.model].filter(Boolean).join(' ').trim().toUpperCase();

  ops.push({ t: 'shop_title', text: (settings.garageName || 'Mass Power Auto').toUpperCase() });
  ops.push({ t: 'space', h: 6 });
  ops.push({ t: 'header', text: brand, size: 28, letterSpacing: 3 });
  ops.push({ t: 'space', h: 8 });
  ops.push({ t: 'header', text: 'NEXT OIL CHANGE', size: 18, letterSpacing: 3 });
  ops.push({ t: 'space', h: 10 });

  if (service.oil_grade) ops.push({ t: 'label_value', label: 'OIL', value: service.oil_grade });
  if (service.next_service_mileage) ops.push({ t: 'label_value', label: 'MILEAGE', value: service.next_service_mileage.toLocaleString(), unit: 'KM' });
  if (service.next_service_date) ops.push({ t: 'label_value', label: 'DATE', value: fmtDate(service.next_service_date) });
  
  ops.push({ t: 'space', h: 6 });
  ops.push({ t: 'divider', style: 'dashed' });
  ops.push({ t: 'space', h: 6 });
  ops.push({ t: 'checkbox', checked: !!service.oil_filter_changed, label: 'Filter Change', size: 18 });
  
  return { ops, frame: true, feedRows: 30 };
}

/* -------------------------------------------------------------------------- */
/*                           BATTERY STICKER BUILDER                          */
/* -------------------------------------------------------------------------- */
export function buildBatteryStickerDoc(
  _customer: Customer,
  vehicle: Vehicle,
  service: Service,
  settings: AppSettings
): ThermalDoc {
  const ops: ThermalOp[] = [];
  const brand = [vehicle.make, vehicle.model].filter(Boolean).join(' ').trim().toUpperCase();

  const warrantyMonths = service.battery_warranty_months || 0;
  let warrantyLabel = '', warrantyExpiryFormatted = '';
  if (warrantyMonths > 0) {
    warrantyLabel = warrantyMonths === 6 ? '6 MONTHS' : warrantyMonths === 12 ? '1 YEAR' : `${warrantyMonths} MONTHS`;
    if (service.battery_install_date) {
      const exp = new Date(service.battery_install_date);
      exp.setMonth(exp.getMonth() + warrantyMonths);
      warrantyExpiryFormatted = exp.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });
    }
  }

  ops.push({ t: 'shop_title', text: (settings.garageName || 'Mass Power Auto').toUpperCase() });
  ops.push({ t: 'space', h: 6 });
  ops.push({ t: 'header', text: brand, size: 28, letterSpacing: 3 });
  ops.push({ t: 'space', h: 8 });
  ops.push({ t: 'header', text: 'BATTERY REPLACEMENT', size: 18, letterSpacing: 3 });
  ops.push({ t: 'space', h: 10 });

  if (service.battery_amp_rate) ops.push({ t: 'label_value', label: 'AMP RATE', value: service.battery_amp_rate });
  if (service.battery_install_date) ops.push({ t: 'label_value', label: 'INSTALLED', value: fmtDate(service.battery_install_date) });
  if (warrantyLabel) { ops.push({ t: 'space', h: 4 }); ops.push({ t: 'header', text: `WARRANTY ${warrantyLabel}`, size: 16, letterSpacing: 1 }); }
  if (warrantyExpiryFormatted) ops.push({ t: 'label_value', label: 'EXPIRES', value: warrantyExpiryFormatted });
  
  ops.push({ t: 'space', h: 6 });
  ops.push({ t: 'divider', style: 'dashed' });
  ops.push({ t: 'space', h: 6 });
  ops.push({ t: 'checkbox', checked: !!service.battery_parasitic_tested, label: 'Parasitic Draw Tested', size: 18 });
  return { ops, frame: true, feedRows: 30 };
}

/* -------------------------------------------------------------------------- */
/*                           HVAC STICKER BUILDER                             */
/* -------------------------------------------------------------------------- */
export function buildHvacStickerDoc(
  _customer: Customer,
  vehicle: Vehicle,
  service: Service,
  settings: AppSettings
): ThermalDoc {
  const ops: ThermalOp[] = [];
  const brand = [vehicle.make, vehicle.model].filter(Boolean).join(' ').trim().toUpperCase();

  ops.push({ t: 'shop_title', text: (settings.garageName || 'Mass Power Auto').toUpperCase() });
  ops.push({ t: 'space', h: 6 });
  ops.push({ t: 'header', text: brand, size: 28, letterSpacing: 3 });
  ops.push({ t: 'space', h: 8 });
  ops.push({ t: 'header', text: 'HVAC / AC SERVICE', size: 18, letterSpacing: 3 });
  ops.push({ t: 'space', h: 10 });

  if (service.additional_info) ops.push({ t: 'label_value', label: 'SERVICE', value: service.additional_info.toUpperCase() });
  if (service.hvac_freon_date) ops.push({ t: 'label_value', label: 'DATE', value: fmtDate(service.hvac_freon_date) });
  
  ops.push({ t: 'space', h: 6 });
  ops.push({ t: 'divider', style: 'dashed' });
  ops.push({ t: 'space', h: 6 });
  ops.push({ t: 'checkbox', checked: !!service.hvac_leak_tested, label: 'Tested for Leaks', size: 18 });
  return { ops, frame: true, feedRows: 30 };
}

/* -------------------------------------------------------------------------- */
/*                           RECEIPT & INVOICE BUILDERS                       */
/* -------------------------------------------------------------------------- */
export function buildThermalReceiptDoc(
  customer: Customer,
  vehicle: Vehicle,
  service: Service,
  settings: AppSettings
): ThermalDoc { /* Keep as-is from your original code */ return { ops: [], feedRows: 40 }; }

export function buildCombinedInvoiceDoc(
  customer: Customer,
  vehicles: Vehicle[],
  services: Service[],
  discount: number,
  settings: AppSettings
): ThermalDoc { /* Keep as-is from your original code */ return { ops: [], feedRows: 40 }; }

export function buildPriceStickersDoc(items: InventoryItem[], garageName: string): ThermalDoc { return { ops: [], feedRows: 30 }; }
export function buildReorderDoc(groups: LowStockItemBySupplier[], garageName: string, garagePhone: string, threshold: number): ThermalDoc { return { ops: [], feedRows: 40 }; }
export function buildVehicleQrDoc(vehicle: Vehicle, qrDataUri: string, garageName: string): ThermalDoc { return { ops: [], feedRows: 30 }; }
export function buildGuaranteeStickerDoc(dmDataUri: string, monthLabel: string): ThermalDoc { return { ops: [], feedRows: 20 }; }
