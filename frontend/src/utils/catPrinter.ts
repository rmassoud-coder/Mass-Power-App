/**
 * catPrinter.ts — BLE driver for GT01/GB02/GB03/MX-series "cat printers".
 *
 * Protocol (confirmed against rbaron/catprinter, NaitLee/Cat-Printer,
 * bitbank2/Thermal_Printer — independent reverse-engineering of this
 * printer family):
 *
 *   0x51 0x78 | CC | DD | LL LH | ...data... | CRC | 0xFF
 *   - 0x51 0x78 : magic header
 *   - CC        : 0xA2 = Draw Bitmap row, 0xA1 = Feed Paper, 0xA0 = Retract
 *   - DD        : 0x00 = host -> printer
 *   - LL, LH    : data length, little-endian
 *   - data      : 48 bytes/row (384px / 8), MSB-first bit order
 *   - CRC       : CRC-8 (poly 0x07, init 0x00) of `data` only
 *   - 0xFF      : terminator
 *
 * BIT ORDER NOTE: htmlRasterizer.ts packs each row as
 *   row[x >> 3] |= (1 << (x & 7))
 * — pixel 0 goes into the LOWEST bit of the byte (LSB-first). This printer
 * protocol expects MSB-first (pixel 0 = highest bit). We mirror every byte
 * before sending to correct for this. If prints still look wrong after
 * this fix, set MIRROR_BITS = false below and retest — it means the
 * rasterizer's convention was already correct and this was double-flipping.
 */
import { BleManager, Device } from 'react-native-ble-plx';
import { Buffer } from 'buffer'; // npx expo install buffer if missing

export interface MonoBitmap {
  width: number;
  height: number;
  /** Each entry: base64-encoded row, bytesPerRow long, LSB-first packed (see note above). */
  rowsBase64: string[];
}

const SERVICE_UUID = '0000af30-0000-1000-8000-00805f9b34fb';
const WRITE_CHAR_UUID = '0000ae01-0000-1000-8000-00805f9b34fb';

const MAGIC = [0x51, 0x78];
const CMD_RETRACT_PAPER = 0xa0;
const CMD_FEED_PAPER = 0xa1;
const CMD_DRAW_BITMAP = 0xa2;
const DIRECTION_HOST_TO_PRINTER = 0x00;

const MIRROR_BITS = true; // see note above — flip to false if output is still wrong

let _manager: BleManager | null = null;
function getManager(): BleManager {
  if (!_manager) _manager = new BleManager();
  return _manager;
}

export function isCatPrinterAvailable(): boolean {
  try {
    getManager();
    return true;
  } catch {
    return false;
  }
}

// ---- CRC-8 (poly 0x07, init 0x00) ----
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
  for (let i = 0; i < data.length; i++) crc = CRC8_TABLE[(crc ^ data[i]) & 0xff];
  return crc;
}

// ---- Bit mirror table (byte-wise bit reversal) ----
const BIT_MIRROR_TABLE: number[] = (() => {
  const table: number[] = [];
  for (let i = 0; i < 256; i++) {
    let b = i, r = 0;
    for (let k = 0; k < 8; k++) { r = (r << 1) | (b & 1); b >>= 1; }
    table[i] = r;
  }
  return table;
})();

function buildFrame(command: number, data: Uint8Array): Uint8Array {
  const length = data.length;
  const checksum = crc8(data);
  const frame = new Uint8Array(MAGIC.length + 2 + 2 + length + 1 + 1);
  let offset = 0;
  frame.set(MAGIC, offset); offset += MAGIC.length;
  frame[offset++] = command;
  frame[offset++] = DIRECTION_HOST_TO_PRINTER;
  frame[offset++] = length & 0xff;
  frame[offset++] = (length >> 8) & 0xff;
  frame.set(data, offset); offset += length;
  frame[offset++] = checksum;
  frame[offset++] = 0xff;
  return frame;
}

/** Decode one base64 row from the rasterizer, correcting bit order if needed. */
function decodeRow(rowBase64: string): Uint8Array {
  const bytes = Uint8Array.from(Buffer.from(rowBase64, 'base64'));
  if (!MIRROR_BITS) return bytes;
  const mirrored = new Uint8Array(bytes.length);
  for (let i = 0; i < bytes.length; i++) mirrored[i] = BIT_MIRROR_TABLE[bytes[i]];
  return mirrored;
}

/**
 * Connect to the given printer (by BLE device id), stream the bitmap,
 * feed paper, and disconnect. Matches the signature printService.ts expects.
 */
export async function printMonoBitmap(
  catPrinterId: string,
  bmp: MonoBitmap,
  _darkness?: number
): Promise<void> {
  const manager = getManager();
  let device: Device;
  try {
    device = await manager.connectToDevice(catPrinterId, { autoConnect: false, timeout: 10000 });
    await device.discoverAllServicesAndCharacteristics();
  } catch (e: any) {
    throw new Error('Could not connect to printer: ' + (e?.message || e));
  }

  try {
    const rowFrames = bmp.rowsBase64.map((r) => buildFrame(CMD_DRAW_BITMAP, decodeRow(r)));
    const feedFrame = buildFrame(CMD_FEED_PAPER, Uint8Array.from([80]));

    let mtu = 23;
    try {
      const connected = await manager.requestMTUForDevice(device.id, 185);
      mtu = connected.mtu ?? 23;
    } catch {
      // keep default MTU
    }
    const maxChunk = Math.max(20, mtu - 3);

    const totalLen = rowFrames.reduce((s, f) => s + f.length, 0) + feedFrame.length;
    const stream = new Uint8Array(totalLen);
    let off = 0;
    for (const f of rowFrames) { stream.set(f, off); off += f.length; }
    stream.set(feedFrame, off);

    for (let i = 0; i < stream.length; i += maxChunk) {
      const slice = stream.slice(i, i + maxChunk);
      const b64 = Buffer.from(slice).toString('base64');
      await manager.writeCharacteristicWithoutResponseForDevice(
        device.id,
        SERVICE_UUID,
        WRITE_CHAR_UUID,
        b64
      );
      await new Promise((res) => setTimeout(res, 20));
    }
  } finally {
    await manager.cancelDeviceConnection(device.id).catch(() => {});
  }
}
