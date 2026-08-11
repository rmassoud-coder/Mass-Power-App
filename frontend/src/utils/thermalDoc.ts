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

  // 1. THE LOGO - NOW DOUBLE THE SIZE (120px width instead of 60)
  const logoUrl = "https://rmassoud-coder.github.io/Mass-Power-App/vehicle%20profiles/mass-power-logo.png";
  ops.push({ t: 'image', url: logoUrl, width: 120 });
  ops.push({ t: 'space', h: 8 });

  // 2. Shop name - ENLARGED (24px instead of 22px)
  ops.push({ t: 'shop_title', text: (settings.garageName || 'Mass Power Auto').toUpperCase() });
  ops.push({ t: 'divider', style: 'solid', thick: 3 });
  ops.push({ t: 'space', h: 8 });

  // 3. Vehicle Brand - ENLARGED (34px instead of 32px)
  ops.push({ t: 'header', text: brand, size: 34, letterSpacing: 4 });
  ops.push({ t: 'divider', style: 'solid', thick: 3 });
  ops.push({ t: 'space', h: 8 });

  // 4. Section Title - ENLARGED (20px instead of 18px)
  ops.push({ t: 'header', text: 'NEXT OIL CHANGE', size: 20, letterSpacing: 2 });
  ops.push({ t: 'divider', style: 'dashed' });
  ops.push({ t: 'space', h: 10 });

  // 5. Data Rows - ENLARGED (Values at 20px instead of 18px)
  if (service.oil_grade) {
    ops.push({ t: 'label_value', label: 'OIL:', value: service.oil_grade });
  }
  if (service.next_service_mileage) {
    ops.push({ t: 'label_value', label: 'MILEAGE:', value: service.next_service_mileage.toLocaleString(), unit: 'KM' });
  }
  if (service.next_service_date) {
    ops.push({ t: 'label_value', label: 'DATE:', value: fmtDate(service.next_service_date) });
  }
  
  ops.push({ t: 'space', h: 8 });
  ops.push({ t: 'divider', style: 'dashed' });
  ops.push({ t: 'space', h: 8 });

  // 6. Checkbox - ENLARGED (18px instead of 16px)
  ops.push({ t: 'checkbox', checked: !!service.oil_filter_changed, label: 'FILTER CHANGE', size: 18 });
  
  return { 
    ops, 
    frame: true, 
    feedRows: 60 // INCREASED to 60 (gives 2 empty lines + extra slack for pulling/cutting)
  };
}

function fmtDate(iso?: string | null): string {
  if (!iso) return '';
  try { return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' }); } 
  catch { return String(iso); }
}

export function buildBatteryStickerDoc(...args: any[]): ThermalDoc { return { ops: [], feedRows: 60 }; }
export function buildHvacStickerDoc(...args: any[]): ThermalDoc { return { ops: [], feedRows: 60 }; }
export function buildThermalReceiptDoc(...args: any[]): ThermalDoc { return { ops: [], feedRows: 60 }; }
export function buildCombinedInvoiceDoc(...args: any[]): ThermalDoc { return { ops: [], feedRows: 60 }; }
export function buildPriceStickersDoc(...args: any[]): ThermalDoc { return { ops: [], feedRows: 60 }; }
export function buildReorderDoc(...args: any[]): ThermalDoc { return { ops: [], feedRows: 60 }; }
export function buildVehicleQrDoc(...args: any[]): ThermalDoc { return { ops: [], feedRows: 60 }; }
export function buildGuaranteeStickerDoc(...args: any[]): ThermalDoc { return { ops: [], feedRows: 60 }; }
