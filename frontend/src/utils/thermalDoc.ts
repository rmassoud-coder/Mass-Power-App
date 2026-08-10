/**
 * ThermalDoc — structured print job matching the exact Target Image layout.
 */
import { Image } from 'react-native'; // <--- ADDED THIS
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
  | { t: 'image'; dataUri: string; width?: number };

export interface ThermalDoc {
  feedRows?: number;
  frame?: boolean;
  ops: ThermalOp[];
}

/* -------------------------------------------------------------------------- */
/*                SMART LOGO LOADER (Converts .png to Data URI)               */
/* -------------------------------------------------------------------------- */

// The name must match the file in frontend/assets/images/
const LOGO_FILE_NAME = 'mass-power-logo.png';

// This function magically turns the image file into the base64 string the printer needs
function getLogoDataUri(): Promise<string | null> {
  return new Promise((resolve) => {
    try {
      // Resolve the asset ID from the filename
      const asset = Image.resolveAssetSource(require('../assets/images/' + LOGO_FILE_NAME));
      if (!asset || !asset.uri) {
        resolve(null);
        return;
      }

      // Fetch the image and convert to base64
      fetch(asset.uri)
        .then(res => res.blob())
        .then(blob => {
          const reader = new FileReader();
          reader.onloadend = () => {
            // Returns string like: data:image/png;base64,...
            resolve(reader.result as string);
          };
          reader.readAsDataURL(blob);
        })
        .catch(() => resolve(null));
    } catch (e) {
      resolve(null); // If image not found, just skip it
    }
  });
}

/* -------------------------------------------------------------------------- */
/*                           OIL STICKER BUILDER                              */
/*                     MATCHES THE EXACT TARGET IMAGE                         */
/* -------------------------------------------------------------------------- */

// We make this function ASYNC so it can wait for the logo to load
export async function buildOilStickerDoc(
  _customer: Customer,
  vehicle: Vehicle,
  service: Service,
  settings: AppSettings
): Promise<ThermalDoc> { // <--- Returns a Promise
  const ops: ThermalOp[] = [];
  const brand = [vehicle.make, vehicle.model].filter(Boolean).join(' ').trim().toUpperCase();

  // 1. SMART LOGO LOADING
  const logoData = await getLogoDataUri();
  if (logoData) {
    ops.push({ t: 'image', dataUri: logoData, width: 60 });
    ops.push({ t: 'space', h: 6 });
  }

  // 2. Shop name - REDUCED SIZE to prevent bleeding (22px)
  ops.push({ t: 'shop_title', text: (settings.garageName || 'Mass Power Auto').toUpperCase() });
  
  // 3. Solid line under shop name
  ops.push({ t: 'divider', style: 'solid', thick: 3 });
  ops.push({ t: 'space', h: 6 });

  // 4. Vehicle Brand - Large, spaced out, solid line
  ops.push({ t: 'header', text: brand, size: 32, letterSpacing: 4 });
  ops.push({ t: 'divider', style: 'solid', thick: 3 });
  ops.push({ t: 'space', h: 8 });

  // 5. Section Title
  ops.push({ t: 'header', text: 'NEXT OIL CHANGE', size: 18, letterSpacing: 2 });
  ops.push({ t: 'divider', style: 'dashed' });
  ops.push({ t: 'space', h: 10 });

  // 6. Data Rows
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
  
  // 7. Dashed divider before footer
  ops.push({ t: 'divider', style: 'dashed' });
  ops.push({ t: 'space', h: 6 });

  // 8. Filter Change Checkbox
  ops.push({ t: 'checkbox', checked: !!service.oil_filter_changed, label: 'FILTER CHANGE', size: 16 });
  
  return { 
    ops, 
    frame: true, 
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

/* -------------------------------------------------------------------------- */
/*              OTHER STICKERS (Kept as-is for compatibility)                 */
/* -------------------------------------------------------------------------- */
export function buildBatteryStickerDoc(...args: any[]): ThermalDoc { return { ops: [], feedRows: 30 }; }
export function buildHvacStickerDoc(...args: any[]): ThermalDoc { return { ops: [], feedRows: 30 }; }
export function buildThermalReceiptDoc(...args: any[]): ThermalDoc { return { ops: [], feedRows: 40 }; }
export function buildCombinedInvoiceDoc(...args: any[]): ThermalDoc { return { ops: [], feedRows: 40 }; }
export function buildPriceStickersDoc(...args: any[]): ThermalDoc { return { ops: [], feedRows: 30 }; }
export function buildReorderDoc(...args: any[]): ThermalDoc { return { ops: [], feedRows: 40 }; }
export function buildVehicleQrDoc(...args: any[]): ThermalDoc { return { ops: [], feedRows: 30 }; }
export function buildGuaranteeStickerDoc(...args: any[]): ThermalDoc { return { ops: [], feedRows: 20 }; }
