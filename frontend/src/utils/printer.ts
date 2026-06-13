import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy';
import { Platform, Alert } from 'react-native';

/**
 * Open the OS print dialog with the provided HTML.
 *
 * On Android/iOS: uses expo-print which generates a PDF from the HTML and routes
 * to the system print dialog → Bluetooth thermal printer or print service like
 * PrinterShare / RawBT.
 *
 * On Web: expo-print's web shim calls `window.print()` on the CURRENT page, which
 * would print the entire app screen instead of our small sticker/receipt. To fix
 * this we open a hidden iframe containing just the HTML and print only that.
 */
export async function printHtml(html: string): Promise<void> {
  if (Platform.OS === 'web') {
    return printHtmlOnWeb(html);
  }
  try {
    await Print.printAsync({ html });
  } catch (e: any) {
    if (e?.message && /cancel/i.test(e.message)) return;
    throw e;
  }
}

/** Web-only: print just the provided HTML by injecting an iframe. */
function printHtmlOnWeb(html: string): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    try {
      // Some web targets don't have `document` (SSR). Bail safely.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const w: any = typeof window !== 'undefined' ? window : null;
      const doc = w && w.document;
      if (!w || !doc) {
        reject(new Error('Printing is not available in this environment'));
        return;
      }

      const iframe = doc.createElement('iframe');
      iframe.style.position = 'fixed';
      iframe.style.right = '0';
      iframe.style.bottom = '0';
      iframe.style.width = '0';
      iframe.style.height = '0';
      iframe.style.border = '0';
      iframe.setAttribute('aria-hidden', 'true');
      doc.body.appendChild(iframe);

      const cleanup = () => {
        // small delay so the print dialog can fully open before we tear down
        setTimeout(() => {
          try {
            iframe.parentNode && iframe.parentNode.removeChild(iframe);
          } catch {
            // ignore
          }
        }, 500);
      };

      const onLoad = () => {
        try {
          const cw = iframe.contentWindow;
          if (!cw) {
            cleanup();
            reject(new Error('Print iframe has no content window'));
            return;
          }
          cw.focus();
          cw.print();
          cleanup();
          resolve();
        } catch (err) {
          cleanup();
          reject(err);
        }
      };

      iframe.onload = onLoad;
      // Use srcdoc so the HTML is parsed in the iframe (sandboxed and independent of parent doc)
      iframe.srcdoc = html;
    } catch (err) {
      reject(err);
    }
  });
}

/**
 * Generate a PDF from HTML and open the share sheet so user can send to any app
 * (email, WhatsApp, drive, or a print app like PrinterShare/RawBT for Bluetooth POS).
 */
export async function sharePdfFromHtml(html: string, fileName: string): Promise<void> {
  const { uri } = await Print.printToFileAsync({ html, base64: false });
  // Rename to a nicer filename in cache
  const newUri = `${FileSystem.cacheDirectory}${fileName}.pdf`;
  try {
    await FileSystem.copyAsync({ from: uri, to: newUri });
  } catch {
    // ignore - we'll share original
  }
  const targetUri = (await fileExists(newUri)) ? newUri : uri;
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(targetUri, { mimeType: 'application/pdf', dialogTitle: fileName });
  } else {
    Alert.alert('Share unavailable', 'Sharing is not available on this device.');
  }
}

/**
 * Save raw HTML to a file in the device cache & open share sheet so user can upload
 * to GitHub Pages or send via email / drive.
 */
export async function shareHtml(html: string, fileName: string): Promise<void> {
  const path = `${FileSystem.cacheDirectory}${fileName}.html`;
  await FileSystem.writeAsStringAsync(path, html, { encoding: FileSystem.EncodingType.UTF8 });
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(path, { mimeType: 'text/html', dialogTitle: fileName });
  } else {
    Alert.alert('Share unavailable', 'Sharing is not available on this device.');
  }
}

async function fileExists(uri: string): Promise<boolean> {
  try {
    const info = await FileSystem.getInfoAsync(uri);
    return info.exists;
  } catch {
    return false;
  }
}

export const PRINT_SUPPORTED = Platform.OS === 'android' || Platform.OS === 'ios';
