/**
 * printService — single entry point for every print job in the app.
 *
 * Callers pass:
 *   • `html`      — existing rich HTML string (used by the OS print dialog /
 *                   external PrinterShare driver). Untouched by the Cat path.
 *   • `thermal`   — optional ThermalDoc that describes the SAME job in a
 *                   canvas-friendly structured form. When the user has paired
 *                   a Cat Printer, we rasterize this doc directly to a 1-bit
 *                   bitmap and stream it over BLE — no HTML → SVG → PNG dance.
 *
 * If BLE fails at runtime (rasterizer not ready, printer out of range, etc.)
 * or the caller didn't supply a `thermal` doc, we fall back to the OS print
 * flow so the user always gets paper in the end.
 */
import { Alert, Platform } from 'react-native';
import { printHtml } from './printer';
import { loadSettings } from './settings';
import { isCatPrinterAvailable, printMonoBitmap } from './catPrinter';
import { isRasterizerReady, rasterizeThermalDoc } from './htmlRasterizer';
import type { ThermalDoc } from './thermalDoc';

export interface PrintOptions {
  /** Best-effort description used in fallback error alerts (e.g. "HVAC Sticker"). */
  jobName?: string;
  /** Skip Cat-Printer routing even if it's the active mode. */
  forceExternal?: boolean;
  /** Structured version of the same job — Cat Printer BLE path uses this. */
  thermal?: ThermalDoc;
}

/** Print the supplied HTML through whichever printer is currently selected. */
export async function printJob(html: string, opts: PrintOptions = {}): Promise<void> {
  const settings = await loadSettings();
  const wantCat =
    !opts.forceExternal &&
    settings.printerMode === 'cat-ble' &&
    !!settings.catPrinterId;

  if (wantCat) {
    if (!isCatPrinterAvailable()) {
      Alert.alert(
        'Cat Printer needs a native build',
        'BLE printing only works after you build & install the APK from Publish. Falling back to the system print dialog.',
      );
      return printHtml(html);
    }
    if (!opts.thermal) {
      // Caller didn't supply a structured doc — we can't reliably rasterize HTML,
      // so fall back to the OS flow rather than silently failing.
      Alert.alert(
        'Print not supported on Cat Printer',
        'This print job does not have a thermal template yet. Falling back to the system print dialog.',
      );
      return printHtml(html);
    }
    if (!isRasterizerReady()) {
      Alert.alert(
        'Printer not ready',
        'The internal rasterizer is still initializing. Falling back to the system print dialog.',
      );
      return printHtml(html);
    }
    try {
      const bmp = await rasterizeThermalDoc(opts.thermal, {
        width: 384,
        darkness: settings.catPrinterDarkness,
        timeoutMs: 25000,
      });
      await printMonoBitmap(settings.catPrinterId, bmp, settings.catPrinterDarkness);
      return;
    } catch (e: any) {
      const msg = e?.message || 'Unknown BLE error';
      Alert.alert(
        `Cat Printer failed${opts.jobName ? ' — ' + opts.jobName : ''}`,
        `${msg}\n\nFalling back to the system print dialog.`,
      );
      // Fall through to external so the user still gets paper.
    }
  }

  return printHtml(html);
}

/** For A4-style / non-thermal prints (vehicle-history PDFs, etc.). */
export async function printJobExternal(html: string): Promise<void> {
  return printHtml(html);
}

export { isCatPrinterAvailable, isRasterizerReady };
export const IS_NATIVE = Platform.OS === 'android' || Platform.OS === 'ios';
