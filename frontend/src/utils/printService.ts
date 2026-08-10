import { Alert, Platform } from 'react-native';
import { printHtml } from './printer';
import { loadSettings } from './settings';
import { isCatPrinterAvailable, printMonoBitmap } from './catPrinter';
import { isRasterizerReady, rasterizeThermalDoc } from './htmlRasterizer';
import type { ThermalDoc } from './thermalDoc';

export interface PrintOptions {
  jobName?: string;
  forceExternal?: boolean;
  thermal?: ThermalDoc | Promise<ThermalDoc>;
}

export async function printJob(html: string, opts: PrintOptions = {}): Promise<void> {
  const settings = await loadSettings();
  const wantCat =
    !opts.forceExternal &&
    settings.printerMode === 'cat-ble' &&
    !!settings.catPrinterId;

  if (wantCat) {
    if (!isCatPrinterAvailable()) {
      Alert.alert('Cat Printer needs a native build', 'BLE printing only works after you build & install the APK from Publish. Falling back to the system print dialog.');
      return printHtml(html);
    }
    if (!opts.thermal) {
      Alert.alert('Print not supported on Cat Printer', 'This print job does not have a thermal template yet. Falling back to the system print dialog.');
      return printHtml(html);
    }
    if (!isRasterizerReady()) {
      Alert.alert('Printer not ready', 'The internal rasterizer is still initializing. Falling back to the system print dialog.');
      return printHtml(html);
    }
    try {
      const thermalDoc = await opts.thermal; 
      const bmp = await rasterizeThermalDoc(thermalDoc, {
        width: 384,
        darkness: settings.catPrinterDarkness,
        timeoutMs: 25000,
      });
      await printMonoBitmap(settings.catPrinterId, bmp, settings.catPrinterDarkness);
      return;
    } catch (e: any) {
      const msg = e?.message || 'Unknown BLE error';
      Alert.alert(`Cat Printer failed${opts.jobName ? ' — ' + opts.jobName : ''}`, `${msg}\n\nFalling back to the system print dialog.`);
    }
  }
  return printHtml(html);
}

export async function printJobExternal(html: string): Promise<void> {
  return printHtml(html);
}

export { isCatPrinterAvailable, isRasterizerReady };
export const IS_NATIVE = Platform.OS === 'android' || Platform.OS === 'ios';
