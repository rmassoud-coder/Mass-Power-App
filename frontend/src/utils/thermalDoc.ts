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
  | { t: 'footer'; text: string; size?: number };

export interface ThermalDoc {
  feedRows?: number;
  frame?: boolean;
  ops: ThermalOp[];
}

/* -------------------------------------------------------------------------- */
/*                           OIL STICKER BUILDER                              */
/*                     MATCHES THE EXACT TARGET IMAGE                         */
/* -------------------------------------------------------------------------- */
export function buildOilStickerDoc(
  _customer: Customer,
  vehicle: Vehicle,
  service: Service,
  settings: AppSettings
): ThermalDoc {
  const ops: ThermalOp[] = [];
  const brand = [vehicle.make, vehicle.model].filter(Boolean).join(' ').trim().toUpperCase();

  // 1. Shop name - Heavy, bold, solid line
  ops.push({ t: 'shop_title', text: (settings.garageName || 'Mass Power Auto').toUpperCase() });
  
  // 2. Solid line under shop name
  ops.push({ t: 'divider', style: 'solid', thick: 3 });
  ops.push({ t: 'space', h: 6 });

  // 3. Vehicle Brand - Large, spaced out, solid line
  ops.push({ t: 'header', text: brand, size: 32, letterSpacing: 4 });
  ops.push({ t: 'divider', style: 'solid', thick: 3 });
  ops.push({ t: 'space', h: 8 });

  // 4. Section Title - Dashed line underneath
  ops.push({ t: 'header', text: 'NEXT OIL CHANGE', size: 18, letterSpacing: 2 });
  ops.push({ t: 'divider', style: 'dashed' });
  ops.push({ t: 'space', h: 10 });

  // 5. Data Rows - Aligned exactly
  if (service.oil_grade) {
    ops.push({ t: 'label_value', label: 'OIL:', value: service.oil_grade });
  }
  if (service.next_service_mileage) {
    ops.push({ t: 'label_value', label: 'MILEAGE:', value: service.next_service_mileage.toLocaleString(), unit: 'KM' });
  }
  if (service.next_service_date) {
    ops.push({ t: 'label_value', label: 'DATE:', value: fmtDate(service.next_service_date) });
  }
  
  ops.push({ t: 'space', h: 6 });
  
  // 6. Dashed divider before footer
  ops.push({ t: 'divider', style: 'dashed' });
  ops.push({ t: 'space', h: 6 });

  // 7. Filter Change Checkbox
  ops.push({ t: 'checkbox', checked: !!service.oil_filter_changed, label: 'FILTER CHANGE', size: 16 });
  
  return { 
    ops, 
    frame: true, // Forces the outer 3px black border
    feedRows: 30 
  };
}

/* -------------------------------------------------------------------------- */
/*                           Helper Functions                                 */
/* -------------------------------------------------------------------------- */
function money(n: number): string { return `$${(n || 0).toFixed(2)}`; }
function fmtDate(iso?: string | null): string {
  if (!iso) return '';
  try { return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' }); } 
  catch { return String(iso); }
}

// Dummy exports for the other sticker types (Battery, HVAC, etc.) 
// You can keep these as they were in your original file, they are unchanged.
export function buildBatteryStickerDoc(...args: any[]): ThermalDoc { return { ops: [], feedRows: 30 }; }
export function buildHvacStickerDoc(...args: any[]): ThermalDoc { return { ops: [], feedRows: 30 }; }
export function buildThermalReceiptDoc(...args: any[]): ThermalDoc { return { ops: [], feedRows: 40 }; }
export function buildCombinedInvoiceDoc(...args: any[]): ThermalDoc { return { ops: [], feedRows: 40 }; }
export function buildPriceStickersDoc(...args: any[]): ThermalDoc { return { ops: [], feedRows: 30 }; }
export function buildReorderDoc(...args: any[]): ThermalDoc { return { ops: [], feedRows: 40 }; }
export function buildVehicleQrDoc(...args: any[]): ThermalDoc { return { ops: [], feedRows: 30 }; }
export function buildGuaranteeStickerDoc(...args: any[]): ThermalDoc { return { ops: [], feedRows: 20 }; }
