/**
 * printService — single entry point for every print job in the app.
 *
 * Depending on settings.printerMode it either:
 *   - "external": hands off HTML to expo-print / OS share sheet (existing flow).
 *   - "cat-ble" : rasterizes the HTML in a hidden WebView, applies 1-bit
 *                 Floyd–Steinberg dithering, and streams the bitmap to the
 *                 paired Cat Printer over BLE.
 *
 * If BLE rasterization fails at runtime (WebView not mounted, printer out of
 * range, etc.) we fall back to the external print path so the user always
 * gets a receipt on paper.
 */
import { Alert, Platform } from 'react-native';
import { printHtml } from './printer';
import { loadSettings } from './settings';
import {
  isCatPrinterAvailable,
  printMonoBitmap,
} from './catPrinter';
import { isRasterizerReady, rasterizeHtml } from './htmlRasterizer';

export interface PrintOptions {
  /**
   * Best-effort description shown in fallback error alerts.
   * e.g. "Oil Sticker", "Combined Invoice".
   */
  jobName?: string;
  /**
   * Skip Cat-Printer routing even if it's the active mode. Used by places
   * that ONLY make sense on a full page (e.g. A4 vehicle history PDFs).
   */
  forceExternal?: boolean;
}

/**
 * Print the supplied HTML through whichever printer is currently selected
 * in settings.
 */
export async function printJob(html: string, opts: PrintOptions = {}): Promise<void> {
  const settings = await loadSettings();

  const wantCat =
    !opts.forceExternal &&
    settings.printerMode === 'cat-ble' &&
    !!settings.catPrinterId;

  if (wantCat) {
    // Prefer BLE path
    if (!isCatPrinterAvailable()) {
      // e.g. running in Expo Go / web — nothing we can do but tell the user.
      Alert.alert(
        'Cat Printer needs a native build',
        'BLE printing only works after you build & install the APK from Publish. Falling back to the system print dialog.',
      );
      return printHtml(html);
    }
    if (!isRasterizerReady()) {
      // Host WebView not mounted yet — fall back gracefully.
      Alert.alert(
        'Printer not ready',
        'The internal rasterizer is still initializing. Falling back to the system print dialog.',
      );
      return printHtml(html);
    }
    try {
      const bmp = await rasterizeHtml(html, {
        width: 384,
        darkness: settings.catPrinterDarkness,
        timeoutMs: 25000,
      });
      await printMonoBitmap(
        settings.catPrinterId,
        bmp,
        settings.catPrinterDarkness,
      );
      return;
    } catch (e: any) {
      const msg = e?.message || 'Unknown BLE error';
      Alert.alert(
        `Cat Printer failed${opts.jobName ? ' — ' + opts.jobName : ''}`,
        `${msg}\n\nFalling back to the system print dialog.`,
      );
      // Fall through to external print so the user still gets paper.
    }
  }

  // External (default) path
  return printHtml(html);
}

/**
 * Convenience helper for A4-style / vehicle-history prints that should NEVER
 * be forced onto a 55-mm thermal printer.
 */
export async function printJobExternal(html: string): Promise<void> {
  return printHtml(html);
}

// Re-export so callers can guard UI on it too.
export { isCatPrinterAvailable, isRasterizerReady };
export const IS_NATIVE = Platform.OS === 'android' || Platform.OS === 'ios';
