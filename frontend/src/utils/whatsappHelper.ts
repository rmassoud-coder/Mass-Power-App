import { Linking, Platform } from 'react-native';
import { getAllCustomersMobile } from '../db/database';

export function sanitizePhoneForWhatsApp(raw: string, defaultCountryCode = ''): string {
  if (!raw) return '';
  let cleaned = raw.replace(/[^\d+]/g, '');
  if (cleaned.startsWith('+')) cleaned = cleaned.slice(1);

  if (defaultCountryCode) {
    const cc = defaultCountryCode.replace(/[^\d]/g, '');
    if (cc && !cleaned.startsWith(cc)) {
      if (cleaned.startsWith('0')) cleaned = cleaned.slice(1);
      cleaned = cc + cleaned;
    }
  }
  return cleaned;
}

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

export function buildOilReminderMessage(
  r: any,
  opts: { garageName: string; garagePhone?: string }
): string {
  const garageName = (opts.garageName || 'Mass Power Auto Services').trim();
  const garagePhone = (opts.garagePhone || '').trim();

  const carBits = [r.vehicle_year, r.vehicle_make, r.vehicle_model]
    .filter((x: any) => x && String(x).trim() !== '')
    .join(' ');

  const lines: string[] = [];
  lines.push(`🔧 *${garageName}*`);
  lines.push('');
  lines.push(`مرحباً ${r.customer_name || ''}،`);
  lines.push('');
  lines.push(
    `للتذكير — *نظن انه حان وقت تغيير الزيت او ان موعده قد اقترب الرجاء فحص الملصق على الباب للتاكد*.`
  );
  lines.push('');
  if (carBits) lines.push(`🚗 السيارة: *${carBits}*`);
  if (r.vehicle_plate) lines.push(`🔢 رقم اللوحة: *${r.vehicle_plate}*`);
  if (r.next_service_date) lines.push(`📅 تاريخ الاستحقاق: ${formatDueDate(r.next_service_date)}`);
  if (r.next_service_mileage) lines.push(`🛣 العداد عند الاستحقاق: ${r.next_service_mileage.toLocaleString()} كم`);
  if (r.oil_grade) lines.push(`🛢 الزيت الموصى به: ${r.oil_grade}`);
  lines.push('');
  if (garagePhone) lines.push(`للحجز، يمكنكم الاتصال بنا على *${garagePhone}*.`);
  else lines.push(`للحجز، يرجى الرد على هذه الرسالة.`);
  lines.push('');
  lines.push(`شكراً لكم،`);
  lines.push(`— ${garageName}`);

  return lines.join('\n');
}

export async function openWhatsAppReminder(
  r: any,
  opts: { garageName: string; garagePhone?: string; defaultCountryCode?: string }
): Promise<{ ok: boolean; message?: string }> {
  const phone = sanitizePhoneForWhatsApp(r.customer_mobile, opts.defaultCountryCode || '');
  if (!phone) return { ok: false, message: 'Customer has no phone number saved.' };
  const body = buildOilReminderMessage(r, opts);
  const encoded = encodeURIComponent(body);

  const candidates: string[] = [];
  if (Platform.OS === 'android') candidates.push(`whatsapp://send?phone=${phone}&text=${encoded}`);
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
  try {
    await Linking.openURL(`https://wa.me/${phone}?text=${encoded}`);
    return { ok: true };
  } catch (e: any) {
    return { ok: false, message: e?.message || 'WhatsApp could not be opened. Is it installed?' };
  }
}

// 🔥 NEW: For bulk WhatsApp
export async function getBroadcastContacts(): Promise<{ name: string; phone: string }[]> {
  const customers = await getAllCustomersMobile();
  return customers
    .filter((c) => c.mobile_number && c.mobile_number.trim() !== '')
    .map((c) => ({
      name: c.name,
      phone: sanitizePhoneForWhatsApp(c.mobile_number, ''),
    }));
}

export async function openWhatsAppBroadcast(
  phone: string,
  message: string
): Promise<{ ok: boolean; message?: string }> {
  if (!phone) return { ok: false, message: 'No phone number.' };
  const encoded = encodeURIComponent(message);
  const url = `https://wa.me/${phone}?text=${encoded}`;
  try {
    await Linking.openURL(url);
    return { ok: true };
  } catch (e: any) {
    return { ok: false, message: e?.message || 'Could not open WhatsApp.' };
  }
}
