import { Linking, Platform } from 'react-native';
import type { OilReminderDue } from '../db/database';

/**
 * Sanitises a phone number for use with the wa.me / WhatsApp deep link.
 *  - Strips spaces, dashes, parentheses, and the leading "+".
 *  - If the number doesn't start with a country code, optionally prefixes one.
 */
export function sanitizePhoneForWhatsApp(
  raw: string,
  defaultCountryCode = ''
): string {
  if (!raw) return '';
  // Keep only digits and a possible leading +
  let cleaned = raw.replace(/[^\d+]/g, '');
  if (cleaned.startsWith('+')) cleaned = cleaned.slice(1);

  if (defaultCountryCode) {
    const cc = defaultCountryCode.replace(/[^\d]/g, '');
    if (cc && !cleaned.startsWith(cc)) {
      // Drop a leading 0 (national trunk prefix) if present, then prepend cc
      if (cleaned.startsWith('0')) cleaned = cleaned.slice(1);
      cleaned = cc + cleaned;
    }
  }
  return cleaned;
}

/**
 * Formats the next-service due date in a human-friendly way: "23 Jun 2026".
 * Falls back to the raw string if parsing fails.
 */
export function formatDueDate(iso: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

interface MessageOpts {
  garageName: string;
  garagePhone?: string;
}

/**
 * Builds the WhatsApp message body for an oil-change reminder. WhatsApp supports
 * lightweight markdown: *bold*, _italic_. Emoji form the "logo" line.
 */
export function buildOilReminderMessage(
  r: OilReminderDue,
  opts: MessageOpts
): string {
  const garageName = (opts.garageName || 'Mass Power Auto Services').trim();
  const garagePhone = (opts.garagePhone || '').trim();

  const carBits = [r.vehicle_year, r.vehicle_make, r.vehicle_model]
    .filter((x) => x && String(x).trim() !== '')
    .join(' ');

  const lines: string[] = [];
  lines.push(`🔧 *${garageName}*`);
  lines.push('');
  lines.push(`Hi ${r.customer_name || 'there'},`);
  lines.push('');
  if (r.days_overdue > 0) {
    lines.push(
      `Friendly reminder — your *oil change is overdue by ${r.days_overdue} day${
        r.days_overdue === 1 ? '' : 's'
      }*.`
    );
  } else {
    lines.push(`Friendly reminder — your *oil change is due today*.`);
  }
  lines.push('');
  if (carBits) lines.push(`🚗 Vehicle: *${carBits}*`);
  if (r.vehicle_plate) lines.push(`🔢 Plate: *${r.vehicle_plate}*`);
  if (r.next_service_date) lines.push(`📅 Due date: ${formatDueDate(r.next_service_date)}`);
  if (r.next_service_mileage) {
    lines.push(`🛣 Due mileage: ${r.next_service_mileage.toLocaleString()} km`);
  }
  if (r.oil_grade) lines.push(`🛢 Recommended oil: ${r.oil_grade}`);
  lines.push('');
  if (garagePhone) {
    lines.push(`Call us on *${garagePhone}* to book your next service.`);
  } else {
    lines.push(`Reply to this message to book your next service.`);
  }
  lines.push('');
  lines.push(`Thank you,`);
  lines.push(`— ${garageName}`);

  return lines.join('\n');
}

/**
 * Opens WhatsApp on the user's phone with the message pre-filled and the
 * recipient's number selected. Tries the native scheme first, falls back to
 * wa.me / api.whatsapp.com.
 */
export async function openWhatsAppReminder(
  r: OilReminderDue,
  opts: MessageOpts & { defaultCountryCode?: string }
): Promise<{ ok: boolean; message?: string }> {
  const phone = sanitizePhoneForWhatsApp(
    r.customer_mobile,
    opts.defaultCountryCode || ''
  );
  if (!phone) {
    return { ok: false, message: 'Customer has no phone number saved.' };
  }
  const body = buildOilReminderMessage(r, opts);
  const encoded = encodeURIComponent(body);

  // Try the native scheme on Android first (some installs block universal links)
  const candidates: string[] = [];
  if (Platform.OS === 'android') {
    candidates.push(`whatsapp://send?phone=${phone}&text=${encoded}`);
  }
  candidates.push(`https://wa.me/${phone}?text=${encoded}`);
  candidates.push(`https://api.whatsapp.com/send?phone=${phone}&text=${encoded}`);

  for (const url of candidates) {
    try {
      const can = await Linking.canOpenURL(url);
      if (can) {
        await Linking.openURL(url);
        return { ok: true };
      }
    } catch {
      // try next
    }
  }
  // Last resort — just try the universal link regardless
  try {
    await Linking.openURL(`https://wa.me/${phone}?text=${encoded}`);
    return { ok: true };
  } catch (e: any) {
    return {
      ok: false,
      message:
        e?.message ||
        'WhatsApp could not be opened. Is it installed on this device?',
    };
  }
}
