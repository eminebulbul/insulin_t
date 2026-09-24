/**
 * Saat seçici yardımcıları.
 *
 * Kural: Kullanıcı şu andan ileride bir saat seçerse,
 * kayıt "dünün o saati" olarak oluşturulur.
 * Kullanım senaryosu: Babaannem gece 23:00'de ölçtü ama kaydetmeyi unuttu,
 * sabah 08:00'de giriyor → "dünün 23:00'i" olarak kaydedilir.
 */

/**
 * Seçilen saat + dakikaya göre ISO 8601 timestamp üretir.
 * Eğer seçilen zaman şu andan ilerideyse, dünkü tarihe geri alır.
 *
 * @returns { isoString, isYesterday, displayLabel }
 */
export function resolveRecordedAt(
  selectedHour: number,
  selectedMinute: number
): {
  isoString: string;
  isYesterday: boolean;
  displayLabel: string;
} {
  const now = new Date();

  // Bugünün seçilen saatini oluştur
  const candidate = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
    selectedHour,
    selectedMinute,
    0,
    0
  );

  const isYesterday = candidate > now;

  if (isYesterday) {
    // Bir gün geri al
    candidate.setDate(candidate.getDate() - 1);
  }

  const isoString = candidate.toISOString();

  const displayLabel = formatDisplayLabel(candidate, isYesterday);

  return { isoString, isYesterday, displayLabel };
}

/**
 * Kullanıcıya gösterilecek zaman etiketi.
 * Örn: "Bugün 08:30" veya "Dün 23:00 (önceki güne kaydedildi)"
 */
function formatDisplayLabel(date: Date, isYesterday: boolean): string {
  const h = String(date.getHours()).padStart(2, "0");
  const m = String(date.getMinutes()).padStart(2, "0");
  const timeStr = `${h}:${m}`;

  if (isYesterday) {
    return `Dün ${timeStr} (önceki güne kaydedilecek)`;
  }
  return `Bugün ${timeStr}`;
}

/**
 * Şu anki saat ve dakikayı döner (başlangıç değeri için).
 */
export function getCurrentHourMinute(): { hour: number; minute: number } {
  const now = new Date();
  return { hour: now.getHours(), minute: now.getMinutes() };
}
