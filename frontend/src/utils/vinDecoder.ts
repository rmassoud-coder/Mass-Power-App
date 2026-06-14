export interface VinDecodeResult {
  vin: string;
  make?: string;
  model?: string;
  year?: string;
  country?: string;
  source?: 'nhtsa' | 'wmi' | 'merged' | 'offline-wmi';
  offline?: boolean;
  error?: string;
}

// ============================================================================
// Local VIN parsing  (no network — always works, very accurate for make + year)
// ============================================================================

// Position 10 of VIN → model year. The cycle repeats every 30 years (1980-2009, 2010-2039).
// We assume modern vehicles (2010-2039) since older cars don't usually need this.
// Position 10 of VIN → model year. The cycle repeats every 30 years.
// Position 7 disambiguates: alpha → 2010-2039 cycle, numeric → 1980-2009 cycle.
const YEAR_CODES_NEW: Record<string, number> = {
  A: 2010, B: 2011, C: 2012, D: 2013, E: 2014, F: 2015, G: 2016, H: 2017,
  J: 2018, K: 2019, L: 2020, M: 2021, N: 2022, P: 2023, R: 2024, S: 2025,
  T: 2026, V: 2027, W: 2028, X: 2029, Y: 2030,
  '1': 2031, '2': 2032, '3': 2033, '4': 2034, '5': 2035,
  '6': 2036, '7': 2037, '8': 2038, '9': 2039,
};
const YEAR_CODES_OLD: Record<string, number> = {
  A: 1980, B: 1981, C: 1982, D: 1983, E: 1984, F: 1985, G: 1986, H: 1987,
  J: 1988, K: 1989, L: 1990, M: 1991, N: 1992, P: 1993, R: 1994, S: 1995,
  T: 1996, V: 1997, W: 1998, X: 1999, Y: 2000,
  '1': 2001, '2': 2002, '3': 2003, '4': 2004, '5': 2005,
  '6': 2006, '7': 2007, '8': 2008, '9': 2009,
};

function resolveYear(vin: string): { year?: string; uncertain?: boolean } {
  if (vin.length !== 17) return {};
  const yearChar = vin.charAt(9);
  const pos7 = vin.charAt(6);
  const isNewCycle = /[A-Z]/.test(pos7); // letter at pos 7 → 2010-2039
  const wmi = vin.substring(0, 3);

  // German/European manufacturers (Mercedes-Benz, BMW, Audi, VW, Porsche) often
  // don't follow ISO 3779 strictly for cars sold outside North America — position 10
  // can be the body version, not the year. So for these WMIs we ONLY trust the
  // year when it's clearly in the 2010-2039 cycle (post-2010 cars).
  const isGermanWmi =
    wmi.startsWith('WD') || // Mercedes (WDB/WDC/WDD/WDF)
    wmi.startsWith('WB') || // BMW
    wmi.startsWith('WA') || // Audi
    wmi === 'WVW' || wmi.startsWith('WV1') || wmi.startsWith('WV2') || // VW
    wmi.startsWith('WP') || // Porsche
    wmi === 'TRU'; // Audi Hungary
  if (isGermanWmi && !isNewCycle) {
    // Old cycle + German WMI = unreliable. Don't guess.
    return {};
  }

  const table = isNewCycle ? YEAR_CODES_NEW : YEAR_CODES_OLD;
  const y = table[yearChar];
  return y ? { year: String(y) } : {};
}

// Position 1 of VIN → country/region (first digit identifies the country of origin)
const COUNTRY_CODES: Record<string, string> = {
  '1': 'United States', '4': 'United States', '5': 'United States',
  '2': 'Canada',
  '3': 'Mexico',
  '6': 'Australia',
  '7': 'New Zealand',
  '8': 'South America', '9': 'Brazil',
  J: 'Japan',
  K: 'South Korea',
  L: 'China',
  M: 'India',
  N: 'Turkey',
  P: 'Philippines',
  R: 'Taiwan',
  S: 'United Kingdom',
  T: 'Czech Republic / Hungary',
  U: 'Romania / Slovakia',
  V: 'France / Austria',
  W: 'Germany',
  X: 'Russia',
  Y: 'Sweden / Finland',
  Z: 'Italy',
};

// World Manufacturer Identifier (first 3 chars → make). Curated for the makes
// most likely to show up in a Middle-East / European garage.
const WMI_MAKE: Record<string, string> = {
  // BMW
  WBA: 'BMW', WBS: 'BMW M', WBY: 'BMW i', WBX: 'BMW',
  '4US': 'BMW', '5UX': 'BMW', '5YM': 'BMW M',
  // Mercedes-Benz
  WDB: 'Mercedes-Benz', WDC: 'Mercedes-Benz', WDD: 'Mercedes-Benz',
  WDF: 'Mercedes-Benz', WMX: 'Mercedes-Benz', '4JG': 'Mercedes-Benz',
  '55S': 'Mercedes-Benz',
  // Audi
  WAU: 'Audi', WA1: 'Audi', TRU: 'Audi',
  // Volkswagen
  WVW: 'Volkswagen', WV1: 'Volkswagen', WV2: 'Volkswagen', '3VW': 'Volkswagen',
  '1VW': 'Volkswagen',
  // Porsche
  WP0: 'Porsche', WP1: 'Porsche',
  // Toyota
  JTD: 'Toyota', JTE: 'Toyota', JT2: 'Toyota', JT3: 'Toyota', JTH: 'Lexus',
  '4T1': 'Toyota', '4T3': 'Toyota', '5TD': 'Toyota', '5TE': 'Toyota',
  '5TF': 'Toyota', '5TB': 'Toyota', JTJ: 'Lexus', JTL: 'Lexus',
  '2T1': 'Toyota',
  // Nissan / Infiniti
  JN1: 'Nissan', JN6: 'Nissan', JN8: 'Nissan', '1N4': 'Nissan', '1N6': 'Nissan',
  '3N1': 'Nissan', '5N1': 'Nissan', JNK: 'Infiniti', JNR: 'Infiniti',
  // Honda / Acura
  JHM: 'Honda', JH4: 'Acura', '1HG': 'Honda', '2HG': 'Honda', '5FN': 'Honda',
  '19U': 'Acura', '19V': 'Acura',
  // Mazda
  JM1: 'Mazda', JM3: 'Mazda',
  // Mitsubishi
  JA3: 'Mitsubishi', JA4: 'Mitsubishi', '4A3': 'Mitsubishi', '4A4': 'Mitsubishi',
  // Subaru
  JF1: 'Subaru', JF2: 'Subaru', '4S3': 'Subaru', '4S4': 'Subaru',
  // Hyundai / Kia / Genesis
  KMH: 'Hyundai', KM8: 'Hyundai', '5NM': 'Hyundai', '5NP': 'Hyundai',
  KNA: 'Kia', KND: 'Kia', '5XX': 'Kia', '5XY': 'Kia',
  KMT: 'Genesis',
  // Ford / Lincoln
  '1FA': 'Ford', '1FB': 'Ford', '1FC': 'Ford', '1FD': 'Ford', '1FE': 'Ford',
  '1FM': 'Ford', '1FT': 'Ford', '2FA': 'Ford', '3FA': 'Ford',
  '1LN': 'Lincoln',
  // GM (Chevrolet / Cadillac / Buick / GMC)
  '1G1': 'Chevrolet', '1G6': 'Cadillac', '1G4': 'Buick', '1GC': 'Chevrolet',
  '1GT': 'GMC', '2G1': 'Chevrolet', '3GN': 'Chevrolet', '3GT': 'GMC',
  // Chrysler / Dodge / Jeep / Ram
  '1C3': 'Chrysler', '1C4': 'Jeep', '1C6': 'Ram', '1D7': 'Dodge',
  '2C3': 'Chrysler', '2C4': 'Chrysler', '3C4': 'Chrysler', '3D4': 'Dodge',
  '1J4': 'Jeep', '1J8': 'Jeep',
  // Land Rover / Jaguar
  SAL: 'Land Rover', SAJ: 'Jaguar',
  // Peugeot / Citroën
  VF3: 'Peugeot', VF7: 'Citroen',
  // Renault / Dacia
  VF1: 'Renault', VF8: 'Renault', UU1: 'Dacia',
  // Fiat / Alfa / Lancia
  ZFA: 'Fiat', ZAR: 'Alfa Romeo', ZLA: 'Lancia',
  // Volvo
  YV1: 'Volvo', YV4: 'Volvo',
  // Saab
  YS3: 'Saab',
  // Tesla
  '5YJ': 'Tesla', '7SA': 'Tesla',
};

// ============================================================================
// Make-specific model resolution from VDS (positions 4-6 / 4-8)
// ============================================================================

// Mercedes-Benz chassis code → model line. The 3 digits at positions 4-6 of any
// modern Mercedes VIN identify the platform/chassis.
const MERCEDES_CHASSIS: Record<string, string> = {
  '124': 'E-Class (W124)', '210': 'E-Class (W210)', '211': 'E-Class (W211)',
  '212': 'E-Class (W212)', '213': 'E-Class (W213)', '214': 'E-Class (W214)',
  '207': 'E-Class Coupe (C207)',
  '202': 'C-Class (W202)', '203': 'C-Class (W203)', '204': 'C-Class (W204)',
  '205': 'C-Class (W205)', '206': 'C-Class (W206)',
  '208': 'CLK (W208)', '209': 'CLK (W209)',
  '218': 'CLS (W218)', '219': 'CLS (W219)', '257': 'CLS (C257)',
  '220': 'S-Class (W220)', '221': 'S-Class (W221)', '222': 'S-Class (W222)',
  '223': 'S-Class (W223)',
  '215': 'CL (C215)', '216': 'CL (C216)',
  '129': 'SL (R129)', '230': 'SL (R230)', '231': 'SL (R231)', '232': 'SL (R232)',
  '170': 'SLK (R170)', '171': 'SLK (R171)', '172': 'SLK (R172)',
  '199': 'SLR McLaren', '197': 'SLS AMG', '190': 'AMG GT',
  '163': 'M-Class (W163)', '164': 'M-Class (W164)', '166': 'M-Class (W166)',
  '167': 'GLE (W167)',
  '156': 'GL (X156)', '253': 'GLC (X253)', '254': 'GLC (X254)',
  '169': 'A-Class (W169)', '176': 'A-Class (W176)', '177': 'A-Class (W177)',
  '245': 'B-Class (W245)', '246': 'B-Class (W246)', '247': 'B-Class (W247)',
  '242': 'B-Class Electric',
  '251': 'R-Class (W251)',
  '463': 'G-Class (W463)',
  '156-AMG': 'GLA',
  '117': 'CLA (C117)', '118': 'CLA (C118)',
  '156X': 'GLA (X156)',
  '639': 'Vito / V-Class',
  '447': 'V-Class (W447)',
  '906': 'Sprinter',
};

// BMW chassis code (VDS positions 4-7 → "E"/"F"/"G" series). Detected from the
// 4th and 5th characters of the VIN combined with the WMI.
function decodeBmwModel(vin: string): string | undefined {
  if (!vin.startsWith('WBA') && !vin.startsWith('WBS') && !vin.startsWith('WBY') && !vin.startsWith('WBX')) {
    return undefined;
  }
  const c4 = vin.charAt(3);
  // The series letter is in pos 4 for many BMW VINs (e.g. WBA**5**…  = 5-Series)
  const seriesByChar: Record<string, string> = {
    '1': '1 Series', '2': '2 Series', '3': '3 Series', '4': '4 Series',
    '5': '5 Series', '6': '6 Series', '7': '7 Series', '8': '8 Series',
    A: '3 Series', B: '5 Series', C: '7 Series',
    F: 'X3', G: 'X5', H: 'X6', J: 'X7',
    K: 'i3', L: 'i8', N: 'X1', P: 'X2', R: 'X4',
  };
  return seriesByChar[c4];
}

function decodeMercedesModel(vin: string): string | undefined {
  if (!vin.length || vin.length < 6) return undefined;
  const wmi = vin.substring(0, 3);
  if (!['WDB', 'WDC', 'WDD', 'WDF', 'WMX', '4JG', '55S'].includes(wmi)) return undefined;
  const chassis = vin.substring(3, 6); // positions 4-6
  return MERCEDES_CHASSIS[chassis];
}

function decodeModelFromVin(vin: string): string | undefined {
  return decodeMercedesModel(vin) || decodeBmwModel(vin);
}

function parseVinLocally(vin: string): {
  make?: string;
  model?: string;
  year?: string;
  country?: string;
} {
  const v = vin.trim().toUpperCase();
  if (v.length !== 17) return {};
  const wmi = v.substring(0, 3);
  const countryChar = v.charAt(0);

  const make = WMI_MAKE[wmi];
  const model = decodeModelFromVin(v);
  const year = resolveYear(v).year;
  const country = COUNTRY_CODES[countryChar];

  return { make, model, year, country };
}

// ============================================================================
// NHTSA vPIC — use the "Extended" endpoint which returns richer detail
// ============================================================================
async function decodeViaNhtsa(vin: string): Promise<Partial<VinDecodeResult>> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 8000);
  try {
    const res = await fetch(
      `https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVinValuesExtended/${encodeURIComponent(vin)}?format=json`,
      { signal: controller.signal }
    );
    clearTimeout(timeoutId);
    if (!res.ok) return { offline: true };
    const data = await res.json();
    const row = data?.Results?.[0];
    if (!row) return { offline: true };

    // Normalise: empty strings → undefined
    const clean = (s: any) => (typeof s === 'string' && s.trim() ? s.trim() : undefined);
    return {
      make: clean(row.Make),
      model: clean(row.Model),
      year: clean(row.ModelYear),
      country: clean(row.PlantCountry),
    };
  } catch {
    clearTimeout(timeoutId);
    return { offline: true };
  }
}

// ============================================================================
// Public API — merges local WMI parse with NHTSA, preferring whichever has data
// ============================================================================
export async function decodeVin(vin: string): Promise<VinDecodeResult> {
  const trimmed = vin.trim().toUpperCase();
  if (trimmed.length < 11) {
    return { vin: trimmed, error: 'VIN must be at least 11 characters' };
  }

  // 1. Always do the local parse first (free, instant, works offline)
  const local = parseVinLocally(trimmed);

  // 2. Try NHTSA in parallel for richer info (model + extras)
  const nhtsa = await decodeViaNhtsa(trimmed);

  // 3. Merge — prefer NHTSA where it has values, fall back to local
  const make = nhtsa.make || local.make;
  const model = nhtsa.model;
  const year = nhtsa.year || local.year;
  const country = nhtsa.country || local.country;

  if (nhtsa.offline) {
    // Offline / NHTSA unavailable — return what we can from the VIN itself
    if (make || year || country) {
      return { vin: trimmed, make, year, country, offline: true, source: 'offline-wmi' };
    }
    return { vin: trimmed, offline: true };
  }

  if (!make && !model && !year) {
    return { vin: trimmed, error: 'Could not decode VIN', country };
  }

  // Determine which source contributed
  const source: VinDecodeResult['source'] =
    nhtsa.make && local.make
      ? 'merged'
      : nhtsa.make
      ? 'nhtsa'
      : local.make
      ? 'wmi'
      : 'nhtsa';

  return { vin: trimmed, make, model, year, country, source };
}
