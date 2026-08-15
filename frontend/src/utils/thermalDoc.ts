/**
 * ThermalDoc — structured print job matching the exact Target Image layout.
 */
import type { Customer, Service, Vehicle, InventoryItem, LowStockItemBySupplier } from '../db/database';
import type { AppSettings } from './settings';

export type ThermalOp =
  | { t: 'shop_title'; text: string }
  | { t: 'header'; text: string; size?: number; letterSpacing?: number }
  | { t: 'label_value'; label: string; value: string; unit?: string }
  | { t: 'divider'; style?: 'solid' | 'dashed'; thick?: number }
  | { t: 'space'; h: number }
  | { t: 'checkbox'; checked: boolean; label: string; size?: number }
  | { t: 'footer'; text: string; size?: number }
  | { t: 'image'; url: string; width?: number };

export interface ThermalDoc {
  feedRows?: number;
  /** Blank white rows rendered at the TOP of the canvas, before any content.
   *  Baked into the bitmap itself so it always prints, unlike a separate
   *  BLE feed command sent before the draw command (which some cat-printer
   *  firmware buffers/ignores depending on ordering). */
  leadRows?: number;
  frame?: boolean;
  ops: ThermalOp[];
}

export function buildOilStickerDoc(
  _customer: Customer,
  vehicle: Vehicle,
  service: Service,
  settings: AppSettings
): ThermalDoc {
  const ops: ThermalOp[] = [];
  const brand = [vehicle.make, vehicle.model].filter(Boolean).join(' ').trim().toUpperCase();

  const logoUrl = "https://rmassoud-coder.github.io/Mass-Power-App/vehicle%20profiles/mass-power-logo.png";
  ops.push({ t: 'image', url: logoUrl, width: 143 });
  ops.push({ t: 'space', h: 6 });

  ops.push({ t: 'shop_title', text: (settings.garageName || 'Mass Power Auto').toUpperCase() });
  ops.push({ t: 'divider', style: 'solid', thick: 3 });
  ops.push({ t: 'space', h: 6 });
  ops.push({ t: 'header', text: brand, size: 32, letterSpacing: 4 });
  ops.push({ t: 'divider', style: 'solid', thick: 3 });
  ops.push({ t: 'space', h: 8 });
  ops.push({ t: 'header', text: 'NEXT OIL CHANGE', size: 18, letterSpacing: 2 });
  ops.push({ t: 'divider', style: 'dashed' });
  ops.push({ t: 'space', h: 10 });

  if (service.oil_grade) ops.push({ t: 'label_value', label: 'OIL:', value: service.oil_grade });
  if (service.next_service_mileage) ops.push({ t: 'label_value', label: 'MILEAGE:', value: service.next_service_mileage.toLocaleString(), unit: 'KM' });
  if (service.next_service_date) ops.push({ t: 'label_value', label: 'DATE:', value: fmtDate(service.next_service_date) });
  
  ops.push({ t: 'space', h: 6 });
  ops.push({ t: 'divider', style: 'dashed' });
  ops.push({ t: 'space', h: 6 });
  ops.push({ t: 'checkbox', checked: !!service.oil_filter_changed, label: 'FILTER CHANGE', size: 16 });
  
  return { ops, frame: true, feedRows: 30, leadRows: 60 };
}

function fmtDate(iso?: string | null): string {
  if (!iso) return '';
  try { return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' }); } 
  catch { return String(iso); }
}

// ===============================================================
// 🔥 NEW: Fully built Battery Sticker Layout
// ===============================================================
export function buildBatteryStickerDoc(
  customer: Customer,
  vehicle: Vehicle,
  service: Service,
  settings: AppSettings
): ThermalDoc {
  const ops: ThermalOp[] = [];
  const brand = [vehicle.make, vehicle.model].filter(Boolean).join(' ').trim().toUpperCase();

  // Logo URL (Must match the URL used in oil sticker)
  const logoUrl = "https://rmassoud-coder.github.io/Mass-Power-App/vehicle%20profiles/mass-power-logo.png";
  ops.push({ t: 'image', url: logoUrl, width: 143 });
  ops.push({ t: 'space', h: 6 });

  ops.push({ t: 'shop_title', text: (settings.garageName || 'Mass Power Auto').toUpperCase() });
  ops.push({ t: 'divider', style: 'solid', thick: 3 });
  ops.push({ t: 'space', h: 6 });
  
  // Vehicle Info
  ops.push({ t: 'header', text: brand, size: 32, letterSpacing: 4 });
  ops.push({ t: 'divider', style: 'solid', thick: 3 });
  ops.push({ t: 'space', h: 8 });
  ops.push({ t: 'header', text: 'BATTERY REPLACEMENT', size: 18, letterSpacing: 2 });
  ops.push({ t: 'divider', style: 'dashed' });
  ops.push({ t: 'space', h: 10 });

  // Battery Details
  if (service.battery_amp_rate) ops.push({ t: 'label_value', label: 'AMP RATE:', value: service.battery_amp_rate });
  if (service.battery_install_date) ops.push({ t: 'label_value', label: 'INSTALL DATE:', value: fmtDate(service.battery_install_date) });
  if (service.battery_warranty_months) ops.push({ t: 'label_value', label: 'WARRANTY:', value: `${service.battery_warranty_months} Months` });
  
  ops.push({ t: 'space', h: 6 });
  ops.push({ t: 'divider', style: 'dashed' });
  ops.push({ t: 'space', h: 6 });
  ops.push({ t: 'checkbox', checked: !!service.battery_parasitic_tested, label: 'PARASITIC TESTED', size: 16 });
  
  // Small footer with date
  ops.push({ t: 'space', h: 10 });
  ops.push({ t: 'divider', style: 'solid', thick: 2 });
  ops.push({ t: 'footer', text: `${service.created_at.split('T')[0]}`, size: 12 });

  // ⚠️ CRITICAL FIX: Set feedRows and leadRows to 0 to stop the white lines
  return { ops, frame: true, feedRows: 0, leadRows: 0 };
}

// ===============================================================
// 🔥 Placeholders for future sticker types (Already fixed to 0)
// ===============================================================

export function buildHvacStickerDoc(...args: any[]): ThermalDoc { return { ops: [], feedRows: 0 }; }
export function buildThermalReceiptDoc(...args: any[]): ThermalDoc { return { ops: [], feedRows: 0 }; }
export function buildCombinedInvoiceDoc(...args: any[]): ThermalDoc { return { ops: [], feedRows: 0 }; }
export function buildPriceStickersDoc(...args: any[]): ThermalDoc { return { ops: [], feedRows: 0 }; }
export function buildReorderDoc(...args: any[]): ThermalDoc { return { ops: [], feedRows: 0 }; }
export function buildVehicleQrDoc(...args: any[]): ThermalDoc { return { ops: [], feedRows: 0 }; }
export function buildWarrantyStickerDoc(
  itemType: string,
  description: string,
  period: string,
  issueDate: Date,
  expiryDate: Date,
  settings: AppSettings
): ThermalDoc {
  const ops: ThermalOp[] = [];

  // Logo
  const logoUrl = "https://rmassoud-coder.github.io/Mass-Power-App/vehicle%20profiles/mass-power-logo.png";
  ops.push({ t: 'image', url: logoUrl, width: 143 });
  ops.push({ t: 'space', h: 12 });

  // Shop Name
  ops.push({ t: 'shop_title', text: (settings.garageName || 'Mass Power Auto').toUpperCase() });
  ops.push({ t: 'divider', style: 'solid', thick: 3 });
  ops.push({ t: 'space', h: 6 });

  // Main Title
  ops.push({ t: 'header', text: 'WARRANTY STICKER', size: 22, letterSpacing: 2 });
  ops.push({ t: 'divider', style: 'dashed' });
  ops.push({ t: 'space', h: 8 });

  // Item Type
  ops.push({ t: 'label_value', label: 'ITEM:', value: itemType.toUpperCase() });
  ops.push({ t: 'space', h: 4 });

  // Description
  ops.push({ t: 'divider', style: 'solid', thick: 2 });
  ops.push({ t: 'header', text: description.toUpperCase(), size: 16, letterSpacing: 1 });
  ops.push({ t: 'divider', style: 'solid', thick: 2 });
  ops.push({ t: 'space', h: 8 });

  // Dates
  ops.push({ t: 'label_value', label: 'ISSUE DATE:', value: issueDate.toLocaleDateString() });
  ops.push({ t: 'label_value', label: 'EXPIRY DATE:', value: expiryDate.toLocaleDateString() });
  ops.push({ t: 'space', h: 6 });

  // Ticker Box
  ops.push({ t: 'divider', style: 'dashed' });
  ops.push({ t: 'checkbox', checked: false, label: `VALID FOR ${period} MONTHS`, size: 16 });
  ops.push({ t: 'space', h: 6 });

  // Footer
  ops.push({ t: 'footer', text: 'Keep this sticker with your receipt.', size: 10 });

  return { ops, frame: true, feedRows: 0, leadRows: 0 };
}
