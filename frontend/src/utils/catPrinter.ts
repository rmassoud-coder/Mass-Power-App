/**
 * Cat Printer (PD01 / GT01 / GB02) BLE driver — Phase 1
 * -----------------------------------------------------
 * Protocol reference: WerWolv Cat Printer reverse-engineering,
 * rbaron/catprinter, NaitLee/Cat-Printer.
 *
 * Frame format:
 *   0x51 0x78 [CmdID] 0x00 [DataLen] 0x00 [Data...] [CRC8(Data)] 0xFF
 *
 * BLE:
 *   Service UUID:  0000ae30-0000-1000-8000-00805f9b34fb
 *   Write char:    0000ae01-0000-1000-8000-00805f9b34fb
 *   Notify char:   0000ae02-0000-1000-8000-00805f9b34fb
 *
 * Every function here is safe to call from Expo Go / web preview — the BLE
 * module is lazy-required, and if it isn't available we simply return / no-op.
 */

import { Platform } from 'react-native';

/* -------------------------------------------------------------------------- */
/*                        Lazy BLE module loader                              */
/* -------------------------------------------------------------------------- */

let _bleManager: any = null;
let _bleAvailable: boolean | null = null;

/** Returns true only when running on a native build with react-native-ble-plx
 *  linked (i.e. NOT Expo Go, NOT web). */
export function isCatPrinterAvailable(): boolean {
  if (_bleAvailable !== null) return _bleAvailable;
  if (Platform.OS === 'web') {
    _bleAvailable = false;
    return false;
  }
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires, import/no-extraneous-dependencies
    const ble = require('react-native-ble-plx');
    if (!ble?.BleManager) {
      _bleAvailable = false;
      return false;
    }
    if (!_bleManager) _bleManager = new ble.BleManager();
    _bleAvailable = true;
    return true;
  } catch {
    _bleAvailable = false;
    return false;
  }
}

/* -------------------------------------------------------------------------- */
/*                         Protocol constants                                 */
/* -------------------------------------------------------------------------- */

export const CAT_SERVICE_UUID = '0000ae30-0000-1000-8000-00805f9b34fb';
export const CAT_WRITE_CHAR   = '0000ae01-0000-1000-8000-00805f9b34fb';
export const CAT_NOTIFY_CHAR  = '0000ae02-0000-1000-8000-00805f9b34fb';

/** Names commonly advertised by Cat-family printers (case-insensitive match). */
const CAT_NAME_PATTERNS = [
  'pd01', 'gt01', 'gb01', 'gb02', 'gb03', 'mx02', 'mx05', 'mx06',
  'mxw01', 'yt01', 'yhk', 'cat',
];

/** CRC-8 lookup table used by Cat printers (poly 0x07, init 0x00). */
const CRC8_TABLE: number[] = (() => {
  const t: number[] = [];
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let j = 0; j < 8; j++) {
      c = (c & 0x80) ? ((c << 1) ^ 0x07) & 0xff : (c << 1) & 0xff;
    }
    t.push(c);
  }
  return t;
})();

function crc8(data: number[]): number {
  let c = 0;
  for (const b of data) c = CRC8_TABLE[(c ^ b) & 0xff];
  return c & 0xff;
}

/** Build a single command frame. */
function buildFrame(cmdId: number, data: number[]): number[] {
  return [
    0x51, 0x78,
    cmdId,
    0x00,
    data.length & 0xff,
    (data.length >> 8) & 0xff,
    ...data,
    crc8(data),
    0xff,
  ];
}

// Command IDs
const CMD_FEED_PAPER     = 0xa1;
const CMD_DRAW_BITMAP    = 0xa2;
const CMD_SET_QUALITY    = 0xa4;
const CMD_LATTICE        = 0xa6;
const CMD_SET_ENERGY     = 0xaf;
const CMD_DRAWING_MODE   = 0xbe;

// Pre-computed "start printing" and "stop printing" lattice sequences that
// most Cat printers expect around a print job.
const START_LATTICE = [0xaa, 0x55, 0x17, 0x38, 0x44, 0x5f, 0x5f, 0x5f, 0x44, 0x38, 0x2c];
const END_LATTICE   = [0xaa, 0x55, 0x17, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x17, 0x38];

/* -------------------------------------------------------------------------- */
/*                        Public high-level API                               */
/* -------------------------------------------------------------------------- */

export interface CatDevice {
  id: string;
  name: string;
  rssi?: number | null;
}

/** Ask for BT permissions on Android 12+. No-op on iOS / other platforms. */
export async function ensureCatPrinterPermissions(): Promise<boolean> {
  if (!isCatPrinterAvailable()) return false;
  if (Platform.OS !== 'android') return true;
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { PermissionsAndroid } = require('react-native');
    const perms: string[] = [];
    // 31+ needs the two new BT permissions
    if (Platform.Version >= 31) {
      perms.push(
        PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
        PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
      );
    } else {
      perms.push(PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION);
    }
    const results = await PermissionsAndroid.requestMultiple(perms);
    for (const p of perms) {
      if (results[p] !== PermissionsAndroid.RESULTS.GRANTED) return false;
    }
    return true;
  } catch {
    return false;
  }
}

/** Scan for nearby Cat printers for up to `timeoutMs` (default 6s). */
export async function scanForCatPrinters(
  timeoutMs: number = 6000
): Promise<CatDevice[]> {
  if (!isCatPrinterAvailable() || !_bleManager) return [];
  const found = new Map<string, CatDevice>();
  return new Promise((resolve) => {
    _bleManager.startDeviceScan(null, null, (error: any, device: any) => {
      if (error) {
        _bleManager.stopDeviceScan();
        resolve([...found.values()]);
        return;
      }
      if (!device) return;
      const name = (device.name || device.localName || '').toLowerCase();
      const isCat = CAT_NAME_PATTERNS.some((p) => name.includes(p));
      if (isCat && !found.has(device.id)) {
        found.set(device.id, {
          id: device.id,
          name: device.name || device.localName || 'Cat Printer',
          rssi: device.rssi,
        });
      }
    });
    setTimeout(() => {
      try { _bleManager.stopDeviceScan(); } catch { /* ignore */ }
      resolve([...found.values()]);
    }, timeoutMs);
  });
}

/** Connect + discover services + write a fixed "test print" job. */
export async function testPrint(deviceId: string): Promise<void> {
  if (!isCatPrinterAvailable() || !_bleManager) {
    throw new Error('BLE not available in preview / Expo Go');
  }
  const device = await _bleManager.connectToDevice(deviceId, {
    requestMTU: 200,
    autoConnect: false,
  });
  await device.discoverAllServicesAndCharacteristics();
  try {
    // Build a small test job: header commands + a black-band bitmap
    const bytes: number[] = [];

    // Housekeeping
    bytes.push(...buildFrame(CMD_LATTICE, START_LATTICE));
    bytes.push(...buildFrame(CMD_SET_QUALITY, [0x03]));           // med quality
    bytes.push(...buildFrame(CMD_DRAWING_MODE, [0x00]));          // image mode
    bytes.push(...buildFrame(CMD_SET_ENERGY, [0xE0, 0x2E]));      // ~12000

    // 20 solid-black rows (each row = 48 bytes = 384 pixels wide, all 1's)
    const blackRow = Array(48).fill(0xff);
    for (let i = 0; i < 20; i++) {
      bytes.push(...buildFrame(CMD_DRAW_BITMAP, blackRow));
    }
    // 20 empty rows for spacing
    const whiteRow = Array(48).fill(0x00);
    for (let i = 0; i < 20; i++) {
      bytes.push(...buildFrame(CMD_DRAW_BITMAP, whiteRow));
    }
    // Feed paper 100 dot rows so the strip clears the print head
    bytes.push(...buildFrame(CMD_FEED_PAPER, [0x64, 0x00]));
    bytes.push(...buildFrame(CMD_LATTICE, END_LATTICE));

    // Write in ~180-byte chunks (safe under most Cat printer MTUs)
    const CHUNK = 180;
    for (let i = 0; i < bytes.length; i += CHUNK) {
      const slice = bytes.slice(i, i + CHUNK);
      const b64 = _numsToBase64(slice);
      await device.writeCharacteristicWithoutResponseForService(
        CAT_SERVICE_UUID,
        CAT_WRITE_CHAR,
        b64,
      );
      // Tiny delay to let the printer breathe
      await new Promise((r) => setTimeout(r, 20));
    }
  } finally {
    try { await device.cancelConnection(); } catch { /* ignore */ }
  }
}

/** Utility: convert a number array to a base64 string (what ble-plx expects). */
function _numsToBase64(nums: number[]): string {
  // Prefer Buffer if the polyfill is present, otherwise use btoa fallback.
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const B = require('buffer').Buffer;
    return B.from(nums).toString('base64');
  } catch {
    let bin = '';
    for (const n of nums) bin += String.fromCharCode(n & 0xff);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (global as any).btoa
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ? (global as any).btoa(bin)
      : '';
  }
}
