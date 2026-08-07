/**
 * InvoicePrinter — renders an invoice to an off-screen HTML canvas inside a
 * hidden WebView, extracts the raw pixel data, and sends it to the cat
 * printer via catPrinterService.ts.
 *
 * WHY A WEBVIEW: React Native has no native Canvas/pixel-buffer API. A
 * WebView gives us real HTML5 canvas + getImageData(), which is the only
 * reliable way to rasterize text/layout into pixels in RN. This ALSO fixes
 * your preview-vs-print mismatch: point your on-screen preview at rendering
 * the exact same HTML/canvas drawing function (see renderInvoiceHTML below),
 * so both preview and print pull from one shared layout definition instead
 * of two divergent code paths.
 *
 * Usage:
 *   const printerRef = useRef<InvoicePrinterHandle>(null);
 *   <InvoicePrinter ref={printerRef} />
 *   ...
 *   await printerRef.current?.print(invoiceData, connectedDevice, bleManager);
 */

import React, { forwardRef, useImperativeHandle, useRef } from 'react';
import { View, StyleSheet } from 'react-native';
import { WebView } from 'react-native-webview';
import { BleManager, Device } from 'react-native-ble-plx';
import { ditherToPackedRows, sendBitmapToPrinter } from './catPrinterService';

const CANVAS_WIDTH = 384; // MUST match printer width, do not change

export interface InvoiceItem {
  name: string;
  qty: number;
  price: number;
}

export interface InvoiceData {
  businessName: string;
  address?: string;
  phone?: string;
  invoiceNumber: string;
  date: string;
  items: InvoiceItem[];
  total: number;
  footerNote?: string;
}

export interface InvoicePrinterHandle {
  print: (
    data: InvoiceData,
    device: Device,
    manager: BleManager
  ) => Promise<void>;
}

// ---- Shared layout function (used by the canvas render below) ----------
// If you want the on-screen preview to match exactly, port this same
// drawing logic to whatever preview component you use — or, simpler,
// render this same WebView visibly (not hidden) as the preview itself.
function renderInvoiceHTML(data: InvoiceData): string {
  const itemsJson = JSON.stringify(data.items);
  const dataJson = JSON.stringify(data);

  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8" /></head>
<body style="margin:0;padding:0;">
<canvas id="c" width="${CANVAS_WIDTH}" height="1200"></canvas>
<script>
  const data = ${dataJson};
  const items = ${itemsJson};
  const canvas = document.getElementById('c');
  const ctx = canvas.getContext('2d');

  // White background (canvas defaults to transparent = black when we
  // read pixels back, so this must be explicit)
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#000000';
  ctx.textBaseline = 'top';

  let y = 10;
  const centerText = (text, size, bold) => {
    ctx.font = (bold ? 'bold ' : '') + size + 'px monospace';
    const w = ctx.measureText(text).width;
    ctx.fillText(text, (canvas.width - w) / 2, y);
    y += size + 6;
  };
  const leftText = (text, size, bold) => {
    ctx.font = (bold ? 'bold ' : '') + size + 'px monospace';
    ctx.fillText(text, 4, y);
    y += size + 4;
  };
  const divider = () => {
    ctx.fillRect(4, y, canvas.width - 8, 2);
    y += 10;
  };

  centerText(data.businessName, 24, true);
  if (data.address) centerText(data.address, 14, false);
  if (data.phone) centerText(data.phone, 14, false);
  y += 6;
  divider();

  leftText('Invoice #: ' + data.invoiceNumber, 14, false);
  leftText('Date: ' + data.date, 14, false);
  divider();

  items.forEach((item) => {
    const lineTotal = (item.qty * item.price).toFixed(2);
    const label = item.qty + 'x ' + item.name;
    ctx.font = '14px monospace';
    ctx.fillText(label, 4, y);
    const priceStr = '$' + lineTotal;
    const pw = ctx.measureText(priceStr).width;
    ctx.fillText(priceStr, canvas.width - 4 - pw, y);
    y += 20;
  });

  divider();
  leftText('TOTAL: $' + data.total.toFixed(2), 18, true);
  y += 6;

  if (data.footerNote) {
    divider();
    centerText(data.footerNote, 12, false);
  }
  y += 20;

  // Trim canvas to actual content height, then read pixels
  const finalHeight = y;
  const imgData = ctx.getImageData(0, 0, canvas.width, finalHeight);

  window.ReactNativeWebView.postMessage(JSON.stringify({
    width: canvas.width,
    height: finalHeight,
    pixels: Array.from(imgData.data),
  }));
</script>
</body>
</html>`;
}

export const InvoicePrinter = forwardRef<InvoicePrinterHandle>((_, ref) => {
  const webviewRef = useRef<WebView>(null);
  const resolverRef = useRef<((v: { width: number; height: number; pixels: number[] }) => void) | null>(null);

  useImperativeHandle(ref, () => ({
    print: async (data: InvoiceData, device: Device, manager: BleManager) => {
      const html = renderInvoiceHTML(data);

      const pixelData = await new Promise<{ width: number; height: number; pixels: number[] }>((resolve) => {
        resolverRef.current = resolve;
        webviewRef.current?.injectJavaScript(`
          document.open(); document.write(${JSON.stringify(html)}); document.close();
          true;
        `);
      });

      const rgba = Uint8ClampedArray.from(pixelData.pixels);
      const rows = ditherToPackedRows(rgba, pixelData.width, pixelData.height);
      await sendBitmapToPrinter(manager, device, rows);
    },
  }));

  return (
    <View style={styles.hidden} pointerEvents="none">
      <WebView
        ref={webviewRef}
        originWhitelist={['*']}
        source={{ html: '<html><body></body></html>' }}
        onMessage={(event) => {
          if (resolverRef.current) {
            const parsed = JSON.parse(event.nativeEvent.data);
            resolverRef.current(parsed);
            resolverRef.current = null;
          }
        }}
      />
    </View>
  );
});

const styles = StyleSheet.create({
  hidden: {
    position: 'absolute',
    width: 1,
    height: 1,
    opacity: 0,
    top: -1000,
  },
});
