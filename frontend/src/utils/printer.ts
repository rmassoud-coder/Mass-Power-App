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

/** Web-only: print just the provided HTML.
 *  Uses window.open (most reliable for printing only the popup content) and
 *  falls back to a hidden iframe if popups are blocked.
 */
function printHtmlOnWeb(html: string): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const w: any = typeof window !== 'undefined' ? window : null;
      const doc = w && w.document;
      if (!w || !doc) {
        reject(new Error('Printing is not available in this environment'));
        return;
      }

      // Preferred path: open a new tab/window with ONLY the sticker HTML and print from there.
      // This guarantees the printer receives exactly this HTML and not the parent page.
      const popup = w.open('', 'mp-print-sticker', 'width=420,height=640');
      if (popup && !popup.closed) {
        try {
          popup.document.open();
          popup.document.write(html);
          popup.document.close();

          const triggerPrint = () => {
            try {
              popup.focus();
              popup.print();
              // Close shortly after the print dialog opens so the user
              // isn't left with an extra tab.
              setTimeout(() => {
                try {
                  popup.close();
                } catch {
                  // ignore
                }
              }, 600);
              resolve();
            } catch (err) {
              try {
                popup.close();
              } catch {
                /* ignore */
              }
              reject(err);
            }
          };

          // Wait for the popup document to load before printing.
          if (popup.document.readyState === 'complete') {
            triggerPrint();
          } else {
            popup.addEventListener('load', triggerPrint, { once: true });
            // Safety timeout in case `load` never fires
            setTimeout(triggerPrint, 800);
          }
          return;
        } catch (err) {
          try {
            popup.close();
          } catch {
            /* ignore */
          }
          // fall through to iframe fallback
        }
      }

      // Fallback: hidden iframe (used when popups are blocked).
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
        setTimeout(() => {
          try {
            iframe.parentNode && iframe.parentNode.removeChild(iframe);
          } catch {
            /* ignore */
          }
        }, 500);
      };

      iframe.onload = () => {
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
