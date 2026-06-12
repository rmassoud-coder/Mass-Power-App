import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy';
import { Platform, Alert } from 'react-native';

/**
 * Open the OS print dialog with the provided HTML.
 * On Android with a Bluetooth thermal printer set up at the OS level (or via a print service
 * like PrinterShare / RawBT for ESC/POS), this will route to the printer.
 * Works on real device builds. NOT supported in Expo Go's web preview.
 */
export async function printHtml(html: string): Promise<void> {
  try {
    await Print.printAsync({ html });
  } catch (e: any) {
    // User cancelled or no printer available -> fallback to share PDF
    if (e?.message && /cancel/i.test(e.message)) return;
    throw e;
  }
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
