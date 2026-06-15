/**
 * Engine oil capacity lookup (with filter change), in litres.
 * Curated for common cars seen in Middle East garages.
 * Matched by case-insensitive substring on the vehicle.make + vehicle.model string.
 * If no entry matches, returns undefined so the UI can hide or show "n/a".
 */

interface OilEntry {
  /** Lowercase substring(s) that must ALL appear in `${make} ${model}` */
  match: string[];
  litres: number;
  note?: string;
}

const TABLE: OilEntry[] = [
  // --- Mercedes-Benz ---
  { match: ['mercedes', 'c-class'], litres: 6.5 },
  { match: ['mercedes', 'c200'], litres: 5.5 },
  { match: ['mercedes', 'c300'], litres: 5.8 },
  { match: ['mercedes', 'e-class'], litres: 6.5 },
  { match: ['mercedes', 'e200'], litres: 5.8 },
  { match: ['mercedes', 'e350'], litres: 8.0 },
  { match: ['mercedes', 'e500'], litres: 8.5 },
  { match: ['mercedes', 's-class'], litres: 8.5 },
  { match: ['mercedes', 'clk'], litres: 7.5 },
  { match: ['mercedes', 'cls'], litres: 8.0 },
  { match: ['mercedes', 'glc'], litres: 6.0 },
  { match: ['mercedes', 'gle'], litres: 8.5 },
  { match: ['mercedes', 'ml'], litres: 8.5 },
  { match: ['mercedes', 'gls'], litres: 8.5 },
  { match: ['mercedes', 'g-class'], litres: 9.0 },
  { match: ['mercedes', 'a-class'], litres: 5.4 },
  { match: ['mercedes', 'b-class'], litres: 5.4 },
  { match: ['mercedes', 'sprinter'], litres: 11.5 },
  { match: ['mercedes', 'vito'], litres: 6.5 },

  // --- BMW ---
  { match: ['bmw', '3 series'], litres: 4.25 },
  { match: ['bmw', '320'], litres: 4.25 },
  { match: ['bmw', '328'], litres: 5.2 },
  { match: ['bmw', '5 series'], litres: 6.5 },
  { match: ['bmw', '520'], litres: 5.2 },
  { match: ['bmw', '525'], litres: 7.0 },
  { match: ['bmw', '528'], litres: 5.2 },
  { match: ['bmw', '530'], litres: 6.5 },
  { match: ['bmw', '535'], litres: 6.5 },
  { match: ['bmw', '7 series'], litres: 7.0 },
  { match: ['bmw', '740'], litres: 7.0 },
  { match: ['bmw', '750'], litres: 8.5 },
  { match: ['bmw', 'x1'], litres: 5.0 },
  { match: ['bmw', 'x3'], litres: 6.5 },
  { match: ['bmw', 'x5'], litres: 6.5 },
  { match: ['bmw', 'x6'], litres: 8.5 },
  { match: ['bmw', 'x7'], litres: 8.5 },

  // --- Toyota / Lexus ---
  { match: ['toyota', 'corolla'], litres: 4.4 },
  { match: ['toyota', 'camry'], litres: 4.7 },
  { match: ['toyota', 'yaris'], litres: 3.7 },
  { match: ['toyota', 'rav4'], litres: 4.4 },
  { match: ['toyota', 'hilux'], litres: 7.5 },
  { match: ['toyota', 'land cruiser'], litres: 8.0 },
  { match: ['toyota', 'prado'], litres: 6.5 },
  { match: ['toyota', 'fortuner'], litres: 6.7 },
  { match: ['toyota', 'hiace'], litres: 7.4 },
  { match: ['toyota', 'avanza'], litres: 3.7 },
  { match: ['toyota', 'innova'], litres: 5.5 },
  { match: ['lexus', 'es'], litres: 5.7 },
  { match: ['lexus', 'is'], litres: 5.5 },
  { match: ['lexus', 'rx'], litres: 6.4 },
  { match: ['lexus', 'lx'], litres: 7.6 },
  { match: ['lexus', 'gx'], litres: 6.0 },

  // --- Honda / Acura ---
  { match: ['honda', 'civic'], litres: 3.7 },
  { match: ['honda', 'accord'], litres: 4.4 },
  { match: ['honda', 'cr-v'], litres: 4.2 },
  { match: ['honda', 'pilot'], litres: 4.5 },
  { match: ['honda', 'odyssey'], litres: 4.5 },

  // --- Nissan / Infiniti ---
  { match: ['nissan', 'sunny'], litres: 3.4 },
  { match: ['nissan', 'altima'], litres: 4.6 },
  { match: ['nissan', 'maxima'], litres: 4.8 },
  { match: ['nissan', 'patrol'], litres: 6.9 },
  { match: ['nissan', 'x-trail'], litres: 4.4 },
  { match: ['nissan', 'qashqai'], litres: 4.3 },
  { match: ['nissan', 'navara'], litres: 5.2 },
  { match: ['infiniti', 'qx'], litres: 5.4 },

  // --- Hyundai / Kia / Genesis ---
  { match: ['hyundai', 'elantra'], litres: 4.0 },
  { match: ['hyundai', 'sonata'], litres: 4.5 },
  { match: ['hyundai', 'accent'], litres: 3.6 },
  { match: ['hyundai', 'tucson'], litres: 4.0 },
  { match: ['hyundai', 'santa fe'], litres: 5.7 },
  { match: ['hyundai', 'h1'], litres: 6.7 },
  { match: ['kia', 'cerato'], litres: 4.0 },
  { match: ['kia', 'sportage'], litres: 4.2 },
  { match: ['kia', 'sorento'], litres: 5.7 },
  { match: ['kia', 'optima'], litres: 4.5 },
  { match: ['kia', 'rio'], litres: 3.6 },

  // --- Mitsubishi ---
  { match: ['mitsubishi', 'lancer'], litres: 4.3 },
  { match: ['mitsubishi', 'pajero'], litres: 5.5 },
  { match: ['mitsubishi', 'outlander'], litres: 4.3 },
  { match: ['mitsubishi', 'l200'], litres: 6.5 },

  // --- Ford / Chevrolet / GMC ---
  { match: ['ford', 'focus'], litres: 4.1 },
  { match: ['ford', 'fusion'], litres: 5.7 },
  { match: ['ford', 'explorer'], litres: 5.7 },
  { match: ['ford', 'f-150'], litres: 6.6 },
  { match: ['ford', 'edge'], litres: 5.7 },
  { match: ['chevrolet', 'spark'], litres: 3.5 },
  { match: ['chevrolet', 'cruze'], litres: 4.7 },
  { match: ['chevrolet', 'tahoe'], litres: 6.6 },
  { match: ['chevrolet', 'suburban'], litres: 6.6 },
  { match: ['chevrolet', 'malibu'], litres: 4.7 },
  { match: ['gmc', 'yukon'], litres: 6.6 },

  // --- Audi / VW / Porsche ---
  { match: ['audi', 'a3'], litres: 4.5 },
  { match: ['audi', 'a4'], litres: 5.7 },
  { match: ['audi', 'a6'], litres: 5.7 },
  { match: ['audi', 'a8'], litres: 8.5 },
  { match: ['audi', 'q3'], litres: 4.6 },
  { match: ['audi', 'q5'], litres: 6.8 },
  { match: ['audi', 'q7'], litres: 8.5 },
  { match: ['volkswagen', 'golf'], litres: 4.2 },
  { match: ['volkswagen', 'passat'], litres: 4.5 },
  { match: ['volkswagen', 'tiguan'], litres: 5.7 },
  { match: ['porsche', 'cayenne'], litres: 8.5 },
  { match: ['porsche', 'macan'], litres: 6.5 },

  // --- Land Rover / Jaguar ---
  { match: ['land rover', 'range rover'], litres: 8.0 },
  { match: ['land rover', 'discovery'], litres: 8.0 },
  { match: ['jaguar', 'xf'], litres: 7.5 },
  { match: ['jaguar', 'xj'], litres: 7.5 },
];

/** Looks up an oil capacity suggestion by vehicle make + model.
 *  Returns undefined if no match found. */
export function suggestOilLitres(
  make?: string | null,
  model?: string | null
): { litres: number; matchedKey: string } | undefined {
  if (!make && !model) return undefined;
  const haystack = `${(make || '').toLowerCase()} ${(model || '').toLowerCase()}`;
  // Iterate in array order — first match wins; specific (e.g. "e350") is listed
  // BEFORE more generic ("e-class") so the more accurate one is chosen.
  // To enforce that, sort matches: longer joined-match length first.
  const ranked = [...TABLE].sort(
    (a, b) => b.match.join('').length - a.match.join('').length
  );
  for (const entry of ranked) {
    if (entry.match.every((m) => haystack.includes(m))) {
      return { litres: entry.litres, matchedKey: entry.match.join(' / ') };
    }
  }
  return undefined;
}
