/**
 * catPrinter.ts — BLE driver for GT01/GB02/GB03/MX/PD01-series "cat printers".
 *
 * Protocol (confirmed against rbaron/catprinter, NaitLee/Cat-Printer,
 * bitbank2/Thermal_Printer):
 *   0x51 0x78 | CC | DD | LL LH | ...data... | CRC | 0xFF
 *   - CC   : 0xA2 = Draw Bitmap row, 0xA1 = Feed Paper, 0xA0 = Retract
 *   - LL,LH: data length, little-endian
 *   - data : 48 bytes/row (384px / 8)
 *   - CRC  : CRC-8 (poly 0x07, init 0x00) of `data` only
 *
 * BIT ORDER: htmlRasterizer.ts packs each row as row[x>>3] |= (1 << (x&7))
 * — LSB-first. This protocol expects MSB-first, so we mirror bits before
 * sending (see MIRROR_BITS below).
 *
 * NOTE: a separate lead-in CMD_FEED_PAPER sent before the draw-bitmap
 * frames was tried to push the top of the image clear of the print head,
 * but proved unreliable — firmware appears to buffer/reorder feed commands
 * inconsistently when they precede draw commands. Lead-in space is instead
 * baked directly into the bitmap as blank rows (see ThermalDoc.leadRows in
 * thermalDoc.ts / htmlRasterizer.ts), which always prints correctly since
 * it's just image data.
 */
import { BleManager, Device, State as BleState } from 'react-native-ble-plx';
import { PermissionsAndroid, Platform } from 'react-native';
import { Buffer } from 'buffer'; // npx expo install buffer if missing

export interface MonoBitmap {
  width: number;
  height: number;
  /** Each entry: base64-encoded row, bytesPerRow long, LSB-first packed. */
  rowsBase64: string[];
}

export interface CatDevice {
  id: string;
  name: string;
  rssi?: number;
}

const SERVICE_UUID = '0000ae30-0000-1000-8000-00805f9b34fb';
const WRITE_CHAR_UUID = '0000ae01-0000-1000-8000-00805f9b34fb';

const MAGIC = [0x51, 0x78];
const CMD_RETRACT_PAPER = 0xa0;
const CMD_FEED_PAPER = 0xa1;
const CMD_DRAW_BITMAP = 0xa2;
const DIRECTION_HOST_TO_PRINTER = 0x02; // 0x00=Lighter, 0x02=Dark, 0x03=Darkest

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

// ---- Permissions -----------------------------------------------------
export async function ensureCatPrinterPermissions(): Promise<boolean> {
  if (Platform.OS !== 'android') return true;

  try {
    if (Platform.Version >= 31) {
      const granted = await PermissionsAndroid.requestMultiple([
        PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
        PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
      ]);
      return Object.values(granted).every(
        (v) => v === PermissionsAndroid.RESULTS.GRANTED
      );
    } else {
      const granted = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION
      );
      return granted === PermissionsAndroid.RESULTS.GRANTED;
    }
  } catch {
    return false;
  }
}

// ---- Scanning ----------------------------------------------------------
export function scanForCatPrinters(timeoutMs = 7000): Promise<CatDevice[]> {
  return new Promise((resolve, reject) => {
    const manager = getManager();
    const found = new Map<string, CatDevice>();

    manager.state().then((state) => {
      if (state !== BleState.PoweredOn) {
        reject(new Error('Bluetooth is off. Please enable Bluetooth and try again.'));
        return;
      }

      manager.startDeviceScan(null, { allowDuplicates: false }, (error, device) => {
        if (error) {
          manager.stopDeviceScan();
          reject(new Error(error.message || 'BLE scan failed'));
          return;
        }
        if (device && device.name) {
          found.set(device.id, { id: device.id, name: device.name, rssi: device.rssi ?? undefined });
        }
      });

      setTimeout(() => {
        manager.stopDeviceScan();
        const list = Array.from(found.values()).sort(
          (a, b) => (b.rssi ?? -999) - (a.rssi ?? -999)
        );
        resolve(list);
      }, timeoutMs);
    }).catch((e) => reject(e));
  });
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

// ---- Bit mirror table ----
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

// Horizontal mirror fix: testing confirmed per-byte bit order is already
// correct with no per-byte mirroring (text was legible, just read
// right-to-left). The remaining issue is a FULL-ROW mirror, not a per-byte
// one: the printer wants each 384-pixel row read left-to-right, but our
// source rows come out reversed at the row level. Reversing a bit-packed
// sequence is mathematically equivalent to reversing the byte order AND
// bit-mirroring each byte — so this reuses BIT_MIRROR_TABLE, just applied
// row-wide instead of byte-local (a byte-local-only mirror is what produced
// scrambled noise earlier: it reversed each 8-pixel group in place without
// also reversing which byte holds which group).
function decodeRow(rowBase64: string): Uint8Array {
  const bytes = Uint8Array.from(Buffer.from(rowBase64, 'base64'));
  const reversed = Array.from(bytes).reverse();
  return Uint8Array.from(reversed, (b) => BIT_MIRROR_TABLE[b]);
}

async function sendBitmap(deviceId: string, bmp: MonoBitmap): Promise<void> {
  const manager = getManager();
  let device: Device;
  try {
    device = await manager.connectToDevice(deviceId, { autoConnect: false, timeout: 10000 });
    await device.discoverAllServicesAndCharacteristics();
  } catch (e: any) {
    throw new Error('Could not connect to printer: ' + (e?.message || e));
  }

  try {
    const orderedRows = [...bmp.rowsBase64].reverse();
    const rowFrames = orderedRows.map((r) => buildFrame(CMD_DRAW_BITMAP, decodeRow(r)));
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

/** Matches printService.ts's expected signature. */
export async function printMonoBitmap(
  catPrinterId: string,
  bmp: MonoBitmap,
  _darkness?: number
): Promise<void> {
  return sendBitmap(catPrinterId, bmp);
}

/** Sends a simple black-band test pattern so the user can confirm the connection works. */
export async function testPrint(deviceId: string, _darkness = 3): Promise<void> {
  const width = 384;
  const rowBytes = width / 8;
  const height = 120;
  const rows: string[] = [];

  for (let y = 0; y < height; y++) {
    const row = new Uint8Array(rowBytes);
    if (y > height / 3 && y < (height * 2) / 3) {
      row.fill(0xff);
    }
    let bin = '';
    for (let i = 0; i < row.length; i++) bin += String.fromCharCode(row[i]);
    rows.push(Buffer.from(bin, 'binary').toString('base64'));
  }

  await sendBitmap(deviceId, { width, height, rowsBase64: rows });
}
