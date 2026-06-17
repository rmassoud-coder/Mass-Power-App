/**
 * VIN scanner — captures a photo with the device camera and runs Google ML Kit
 * on-device text recognition to extract a valid 17-character VIN from the image.
 *
 * Notes:
 * - Requires a development / production build (APK / IPA). The ML Kit native
 *   module is NOT available inside Expo Go and the call will throw a clear
 *   "ML Kit native module not available" error in that case.
 * - All processing happens on-device — no internet required.
 */

import * as ImagePicker from 'expo-image-picker';

// VIN allowed characters (no I, O, Q)
const VIN_CHARSET = 'ABCDEFGHJKLMNPRSTUVWXYZ0123456789';

export type VinScanResult =
  | { ok: true; vin: string; candidates: string[]; rawText: string }
  | { ok: false; reason: 'cancelled' | 'permission' | 'no_vin' | 'unavailable' | 'error'; message: string; candidates?: string[]; rawText?: string };

/** Sanitise a raw OCR line into a VIN-shaped candidate. */
function sanitizeForVin(input: string): string {
  return input
    .toUpperCase()
    // strip everything except VIN-allowed characters + characters we will normalise
    .replace(/[^A-Z0-9IOQ]/g, '');
}

/** Apply VIN-specific OCR normalisation (I→1, O/Q→0). */
function normaliseVinConfusions(input: string): string {
  return input
    .replace(/I/g, '1')
    .replace(/O/g, '0')
    .replace(/Q/g, '0');
}

/** Try to pull out any 17-char VIN candidate from a string. */
function findVinIn(text: string): string[] {
  const matches: string[] = [];
  const cleaned = sanitizeForVin(text);
  const normalised = normaliseVinConfusions(cleaned);

  // Strict 17-char windows on both raw-cleaned and normalised strings
  for (const source of [normalised, cleaned]) {
    if (source.length < 17) continue;
    for (let i = 0; i <= source.length - 17; i++) {
      const window = source.slice(i, i + 17);
      if (/^[A-HJ-NPR-Z0-9]{17}$/.test(window) && !matches.includes(window)) {
        matches.push(window);
      }
    }
  }
  return matches;
}

/**
 * Open the camera, take a picture, and run on-device OCR to extract a VIN.
 */
export async function scanVinWithCamera(): Promise<VinScanResult> {
  // 1) Camera permission
  const perm = await ImagePicker.requestCameraPermissionsAsync();
  if (!perm.granted) {
    return {
      ok: false,
      reason: 'permission',
      message: perm.canAskAgain
        ? 'Camera access is required to scan VIN plates.'
        : 'Camera permission was denied. Please enable it in Settings to scan VINs.',
    };
  }

  // 2) Launch camera
  const photo = await ImagePicker.launchCameraAsync({
    mediaTypes: ['images'],
    allowsEditing: true,
    quality: 0.85,
    exif: false,
  });
  if (photo.canceled || !photo.assets || photo.assets.length === 0) {
    return { ok: false, reason: 'cancelled', message: 'Scan cancelled.' };
  }

  const asset = photo.assets[0];
  const uri = asset.uri;

  // 3) Run ML Kit text recognition (native module — APK required)
  let TextRecognition: any;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    TextRecognition = require('@react-native-ml-kit/text-recognition').default;
    if (!TextRecognition || typeof TextRecognition.recognize !== 'function') {
      throw new Error('ML Kit text recognition module not linked.');
    }
  } catch {
    return {
      ok: false,
      reason: 'unavailable',
      message:
        'On-device OCR is not available in this build. Please publish and install the Android APK from Emergent to use VIN scanning.',
    };
  }

  let rawText = '';
  let allLines: string[] = [];
  try {
    const result = await TextRecognition.recognize(uri);
    // result: { text: string, blocks: [{ text, lines: [{ text }] }] }
    rawText = result?.text || '';
    const blocks: any[] = Array.isArray(result?.blocks) ? result.blocks : [];
    for (const block of blocks) {
      const lines: any[] = Array.isArray(block?.lines) ? block.lines : [];
      for (const line of lines) {
        if (typeof line?.text === 'string') allLines.push(line.text);
      }
    }
    if (allLines.length === 0 && rawText) {
      allLines = rawText.split(/\r?\n/);
    }
  } catch (e: any) {
    return {
      ok: false,
      reason: 'error',
      message: `OCR failed: ${e?.message || 'unknown error'}`,
    };
  }

  // 4) Extract VIN candidates
  const candidates = new Set<string>();

  // (a) Look per-line first (most reliable — VINs are usually on a single line)
  for (const line of allLines) {
    findVinIn(line).forEach((v) => candidates.add(v));
  }

  // (b) Look across the joined full text (handles VINs split across lines/blocks)
  findVinIn(allLines.join(' ')).forEach((v) => candidates.add(v));
  findVinIn(rawText).forEach((v) => candidates.add(v));

  const list = Array.from(candidates);

  if (list.length === 0) {
    return {
      ok: false,
      reason: 'no_vin',
      message:
        'No 17-character VIN could be read in this photo. Try again with the VIN better centred, well-lit, and steady.',
      candidates: allLines.map((l) => l.trim()).filter((l) => l.length >= 8),
      rawText,
    };
  }

  // Rank candidates: prefer those starting with a digit/letter common in modern VINs
  // — but as a simple tie-break, take the first found.
  return { ok: true, vin: list[0], candidates: list, rawText };
}

/** Validate a typed/scanned VIN (length 17, allowed charset). */
export function isValidVin(vin: string): boolean {
  if (!vin || vin.length !== 17) return false;
  return /^[A-HJ-NPR-Z0-9]{17}$/.test(vin.toUpperCase());
}

export const VIN_CHARS = VIN_CHARSET;
