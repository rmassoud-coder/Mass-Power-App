/**
 * Arabic display labels for SERVICE_CATEGORIES.
 *
 * RULES:
 *  - Keys MUST exactly match the English strings in SERVICE_CATEGORIES
 *    (see src/db/database.ts).
 *  - The value shown in a <Picker> label is Arabic.
 *  - The value SAVED to the DB is always the English key (via value={cat}).
 *  - Never store these Arabic strings in the database — reports group by
 *    the English strings and mixing languages would split them.
 *
 * If a category is missing here, the Picker falls back to English —
 * nothing breaks, it just isn't translated.
 */
export const CATEGORY_LABELS_AR: Record<string, string> = {
  'Oil Services': 'خدمات الزيت',
  'Battery Replacement': 'استبدال البطارية',
  'HVAC Services': 'خدمات التكييف',
  'Locksmith Services': 'خدمات الأقفال',
  'Electrical Services': 'الخدمات الكهربائية',
  'Mechanical Services': 'الخدمات الميكانيكية',
  'Other Services': 'خدمات أخرى',
};

export const getCategoryLabelAr = (cat: string): string =>
  CATEGORY_LABELS_AR[cat] ?? cat;
