/**
 * Cat-printer BLE driver — corrected against the community-documented
 * "GT01/GB02/GB03/MX-series" protocol (confirmed via rbaron/catprinter,
 * NaitLee/Cat-Printer, bitbank2/Thermal_Printer — all independently
 * reverse-engineered from the same family of printers your GATT UUIDs match).
 *
 * Frame structure:
 *   0x51 0x78 | CC | DD | LL LH | ...data... | CRC | 0xFF
 *   - 0x51 0x78 : magic header (STX)
 *   - CC        : command byte (0xA2 = Draw Bitmap row, 0xA1 = Feed Paper,
 *                 0xA0 = Retract Paper)
 *   - DD        : direction, 0x00 = host -> printer
 *   - LL, LH    : data length, little-endian (low byte, high byte)
 *   - data      : payload (for bitmap: 48 bytes = 384 bits, 1 bit/pixel,
 *                 1 = print dot, 0 = blank)
 *   - CRC       : CRC-8 (poly 0x07, init 0x00) of the `data` bytes ONLY
 *   - 0xFF      : terminator (ETX)
 */

import { BleManager, Device } from 'react-native-ble-plx';
import { Buffer } from 'buffer'; // RN usually has this polyfilled already;
                                  // if not: npx expo install buffer

// ---- Printer constants (from your handover) --------------------------
export const SERVICE_UUID = '0000af30-0000-1000-8000-00805f9b34fb';
export const WRITE_CHAR_UUID = '0000ae01-0000-1000-8000-00805f9b34fb';

const MAGIC = [0x51, 0x78];
const CMD_RETRACT_PAPER = 0xa0;
const CMD_FEED_PAPER = 0xa1;
const CMD_DRAW_BITMAP = 0xa2; // <-- was wrongly 0xA1 in the old driver
const DIRECTION_HOST_TO_PRINTER = 0x00;

const BITMAP_WIDTH_PX = 384; // fixed for 57/58mm printers at 200 DPI
const ROW_BYTES = BITMAP_WIDTH_PX / 8; // 48 bytes per row

// Some cat-printer clones expect each data byte's bits mirrored
// (bit 0 <-> bit 7). If your prints come out looking like a scrambled/
// mirrored version of the real content, flip this to true and retest.
const REVERSE_BITS_PER_BYTE = false;

// ---- CRC-8 (poly 0x07, init 0x00) — build lookup table once ----------
const CRC8_TABLE: number[] = (() => {
  const table: number[] = [];
  for (let i = 0; i < 256; i++) {
    let crc = i;
    for (let bit = 0; bit < 8; bit++) {
      crc = (crc & 0x80) ? ((crc << 1) ^ 0x07) & 0xff : (crc << 1) & 0xff;
    }
    table[i] = crc;
  }
  return table;
})();

function crc8(data: Uint8Array): number {
  let crc = 0x00;
  for (let i = 0; i < data.length; i++) {
    crc = CRC8_TABLE[(crc ^ data[i]) & 0xff];
  }
  return crc;
}

// Precomputed bit-reversal lookup, only used if REVERSE_BITS_PER_BYTE
const BIT_MIRROR_TABLE: number[] = (() => {
  const table: number[] = [];
  for (let i = 0; i < 256; i++) {
    let b = i, r = 0;
    for (let k = 0; k < 8; k++) {
      r = (r << 1) | (b & 1);
      b >>= 1;
    }
    table[i] = r;
  }
  return table;
})();

// ---- Frame builder -----------------------------------------------------
function buildFrame(command: number, data: Uint8Array): Uint8Array {
  const length = data.length;
  const checksum = crc8(data);
  const frame = new Uint8Array(MAGIC.length + 2 + 2 + length + 1 + 1);
  let offset = 0;
  frame.set(MAGIC, offset); offset += MAGIC.length;
  frame[offset++] = command;
  frame[offset++] = DIRECTION_HOST_TO_PRINTER;
  frame[offset++] = length & 0xff;        // LL
  frame[offset++] = (length >> 8) & 0xff; // LH
  frame.set(data, offset); offset += length;
  frame[offset++] = checksum;
  frame[offset++] = 0xff;
  return frame;
}

export function buildDrawBitmapRowFrame(rowBytes: Uint8Array): Uint8Array {
  if (rowBytes.length !== ROW_BYTES) {
    throw new Error(`Row must be exactly ${ROW_BYTES} bytes (384px / 8), got ${rowBytes.length}`);
  }
  const payload = REVERSE_BITS_PER_BYTE
    ? Uint8Array.from(rowBytes, (b) => BIT_MIRROR_TABLE[b])
    : rowBytes;
  return buildFrame(CMD_DRAW_BITMAP, payload);
}

export function buildFeedPaperFrame(steps: number): Uint8Array {
  return buildFrame(CMD_FEED_PAPER, Uint8Array.from([steps & 0xff]));
}

export function buildRetractPaperFrame(steps: number): Uint8Array {
  return buildFrame(CMD_RETRACT_PAPER, Uint8Array.from([steps & 0xff]));
}

// ---- Floyd–Steinberg dithering: RGBA pixels -> packed 1-bit rows -------
/**
 * Takes raw RGBA pixel data (e.g. from a canvas getImageData() call inside
 * a hidden WebView, postMessage'd back as a flat array) and converts it to
 * an array of 48-byte rows ready for buildDrawBitmapRowFrame().
 *
 * width MUST be 384. height is whatever your content needs.
 */
export function ditherToPackedRows(
  rgba: Uint8ClampedArray | Uint8Array,
  width: number,
  height: number
): Uint8Array[] {
  if (width !== BITMAP_WIDTH_PX) {
    throw new Error(`Canvas width must be ${BITMAP_WIDTH_PX}px, got ${width}`);
  }

  // Convert to grayscale luminance buffer (float, for error diffusion)
  const gray = new Float32Array(width * height);
  for (let i = 0; i < width * height; i++) {
    const r = rgba[i * 4], g = rgba[i * 4 + 1], b = rgba[i * 4 + 2];
    gray[i] = 0.299 * r + 0.587 * g + 0.114 * b;
  }

  // Floyd–Steinberg error diffusion, output 1 = black/print, 0 = white
  const bits = new Uint8Array(width * height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      const old = gray[idx];
      const newVal = old < 128 ? 0 : 255;
      bits[idx] = newVal === 0 ? 1 : 0; // dark pixel -> print dot
      const err = old - newVal;
      if (x + 1 < width) gray[idx + 1] += err * (7 / 16);
      if (y + 1 < height) {
        if (x > 0) gray[idx + width - 1] += err * (3 / 16);
        gray[idx + width] += err * (5 / 16);
        if (x + 1 < width) gray[idx + width + 1] += err * (1 / 16);
      }
    }
  }

  // Pack into 48-byte rows, MSB first
  const rows: Uint8Array[] = [];
  for (let y = 0; y < height; y++) {
    const row = new Uint8Array(ROW_BYTES);
    for (let x = 0; x < width; x++) {
      if (bits[y * width + x]) {
        row[x >> 3] |= 0x80 >> (x & 7);
      }
    }
    rows.push(row);
  }
  return rows;
}

// ---- BLE transmission ---------------------------------------------------
/**
 * Sends a full set of bitmap rows to the connected printer.
 * Negotiates a larger MTU if possible, then writes in MTU-sized chunks
 * with a short delay between writes (printer has a small internal buffer).
 */
export async function sendBitmapToPrinter(
  manager: BleManager,
  device: Device,
  rows: Uint8Array[],
  opts: { feedAfter?: number; writeDelayMs?: number } = {}
): Promise<void> {
  const feedAfter = opts.feedAfter ?? 80; // steps of paper feed after printing
  const writeDelayMs = opts.writeDelayMs ?? 20;

  // Try to negotiate a bigger MTU (Android only; iOS ignores this)
  let mtu = 23;
  try {
    const connected = await manager.requestMTUForDevice(device.id, 185);
    mtu = connected.mtu ?? 23;
  } catch {
    // fall back silently to default MTU
  }
  const maxChunk = Math.max(20, mtu - 3); // ATT overhead is 3 bytes

  // Build the full byte stream: one frame per row, concatenated
  const frames = rows.map(buildDrawBitmapRowFrame);
  const feedFrame = buildFeedPaperFrame(feedAfter);
  const totalLength =
    frames.reduce((sum, f) => sum + f.length, 0) + feedFrame.length;
  const fullStream = new Uint8Array(totalLength);
  let offset = 0;
  for (const f of frames) { fullStream.set(f, offset); offset += f.length; }
  fullStream.set(feedFrame, offset);

  // Write in MTU-sized slices — the printer treats the incoming
  // characteristic writes as one continuous byte stream, so frame
  // boundaries don't need to align with BLE write boundaries.
  for (let i = 0; i < fullStream.length; i += maxChunk) {
    const slice = fullStream.slice(i, i + maxChunk);
    const base64Chunk = Buffer.from(slice).toString('base64');
    await manager.writeCharacteristicWithoutResponseForDevice(
      device.id,
      SERVICE_UUID,
      WRITE_CHAR_UUID,
      base64Chunk
    );
    if (writeDelayMs > 0) {
      await new Promise((res) => setTimeout(res, writeDelayMs));
    }
  }
}
