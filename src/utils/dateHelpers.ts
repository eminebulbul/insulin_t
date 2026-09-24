import { MealTag } from "../db/queries";

/** "2026-09-25" → "25 Eylül 2026, Perşembe" */
export function formatDateKey(dateKey: string): string {
  const date = new Date(dateKey + "T12:00:00"); // öğlen saati: timezone kayması yok
  return date.toLocaleDateString("tr-TR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

/** "2026-09-25T08:30:00.000Z" → "08:30" (cihaz yerel saati) */
export function formatTime(isoString: string): string {
  const date = new Date(isoString);
  const h = String(date.getHours()).padStart(2, "0");
  const m = String(date.getMinutes()).padStart(2, "0");
  return `${h}:${m}`;
}

/** "2026-09-25" → "25/09" (grafik ekseni için kısa format) */
export function formatShortDate(dateKey: string): string {
  return dateKey.slice(8, 10) + "/" + dateKey.slice(5, 7);
}

/** Öğün etiketi Türkçe karşılığı */
export function formatMealTag(tag: MealTag | null | undefined): string {
  if (!tag) return "";
  const map: Record<MealTag, string> = {
    aclik: "Açlık",
    tokluk: "Tokluk",
    yatmadan_once: "Yatmadan Önce",
    diger: "Diğer",
  };
  return map[tag] ?? tag;
}

/** Bugünden kaç gün önce olduğunu döner ("Bugün", "Dün", veya "N gün önce") */
export function relativeDayLabel(dateKey: string): string {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(dateKey + "T00:00:00");
  const diff = Math.round(
    (today.getTime() - target.getTime()) / (1000 * 60 * 60 * 24)
  );
  if (diff === 0) return "Bugün";
  if (diff === 1) return "Dün";
  return `${diff} gün önce`;
}
