import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import {
  getFirestore,
  collection,
  query,
  orderBy,
  where,
  getDocs,
} from "@react-native-firebase/firestore";
import type {
  Measurement,
  GlucoseMeasurement,
  BloodPressureMeasurement,
  WaterEntry,
  Reminder,
} from "../db/firestoreQueries";

// ─── Tarih Aralığı ────────────────────────────────────────────────────────────

export type DateRangePreset = "7" | "30" | "90" | "custom";

export interface DateRange {
  from: Date;
  to: Date;
}

export function buildDateRange(
  preset: DateRangePreset,
  customFrom?: Date,
  customTo?: Date
): DateRange {
  const to = new Date();
  to.setHours(23, 59, 59, 999);

  if (preset === "custom" && customFrom && customTo) {
    const from = new Date(customFrom);
    from.setHours(0, 0, 0, 0);
    const toCustom = new Date(customTo);
    toCustom.setHours(23, 59, 59, 999);
    return { from, to: toCustom };
  }

  const days = parseInt(preset, 10);
  const from = new Date();
  from.setDate(from.getDate() - days + 1);
  from.setHours(0, 0, 0, 0);
  return { from, to };
}

// ─── Firestore Tek Seferlik Çekme ─────────────────────────────────────────────

const db = getFirestore();

async function fetchMeasurementsInRange(range: DateRange): Promise<Measurement[]> {
  const fromIso = range.from.toISOString();
  const toIso = range.to.toISOString();

  const q = query(
    collection(db, "measurements"),
    where("recorded_at", ">=", fromIso),
    where("recorded_at", "<=", toIso),
    orderBy("recorded_at", "asc")
  );
  const snapshot = await getDocs(q);

  return snapshot.docs.map((docSnap: any) => {
    const data = docSnap.data();
    if (data.type === "glucose") {
      return {
        id: docSnap.id,
        recorded_at: data.recorded_at,
        type: "glucose",
        meal_tag: data.meal_tag,
        glucose_mg: data.glucose_mg,
        glucose_note: data.glucose_note ?? null,
      } as GlucoseMeasurement;
    } else {
      return {
        id: docSnap.id,
        recorded_at: data.recorded_at,
        type: "blood_pressure",
        meal_tag: null,
        bp_systolic: data.bp_systolic,
        bp_diastolic: data.bp_diastolic,
        bp_note: data.bp_note ?? null,
      } as BloodPressureMeasurement;
    }
  });
}

async function fetchWaterInRange(range: DateRange): Promise<WaterEntry[]> {
  const fromIso = range.from.toISOString();
  const toIso = range.to.toISOString();

  const q = query(
    collection(db, "water_log"),
    where("recorded_at", ">=", fromIso),
    where("recorded_at", "<=", toIso),
    orderBy("recorded_at", "asc")
  );
  const snapshot = await getDocs(q);

  return snapshot.docs.map((docSnap: any) => {
    const data = docSnap.data();
    return {
      id: docSnap.id,
      recorded_at: data.recorded_at,
      water_ml: data.water_ml,
    } as WaterEntry;
  });
}

async function fetchActiveReminders(): Promise<Reminder[]> {
  const q = query(
    collection(db, "reminders"),
    where("is_active", "==", true),
    orderBy("hour", "asc"),
    orderBy("minute", "asc")
  );
  const snapshot = await getDocs(q);

  return snapshot.docs.map((docSnap: any) => {
    const data = docSnap.data();
    return {
      id: docSnap.id,
      label: data.label,
      category: data.category,
      insulinColor: data.insulin_color ?? null,
      hour: data.hour,
      minute: data.minute,
      daysOfWeek: data.days_of_week || [],
      isActive: data.is_active ?? true,
    } as Reminder;
  });
}

// ─── Yardımcı Formatlayıcılar ──────────────────────────────────────────────────

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function fmtDate(isoStr: string): string {
  const d = new Date(isoStr);
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}`;
}

function fmtTime(isoStr: string): string {
  const d = new Date(isoStr);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fmtDateHuman(date: Date): string {
  return `${pad(date.getDate())}.${pad(date.getMonth() + 1)}.${date.getFullYear()}`;
}

function fmtNow(): string {
  const now = new Date();
  return `${fmtDateHuman(now)} saat ${pad(now.getHours())}:${pad(now.getMinutes())}`;
}

const MEAL_TAG_TR: Record<string, string> = {
  aclik: "Açlık",
  tokluk: "Tokluk",
  yatmadan_once: "Yatmadan önce",
  diger: "Diğer",
};

const DAY_SHORT: Record<number, string> = {
  1: "Pzt", 2: "Sal", 3: "Çar", 4: "Per", 5: "Cum", 6: "Cmt", 7: "Paz",
};

function formatDays(days: number[]): string {
  if (days.length === 7) return "Her gün";
  return days.map((d) => DAY_SHORT[d] ?? "?").join(", ");
}

// ─── Özet Hesaplama ───────────────────────────────────────────────────────────

function buildGlucoseSummary(list: GlucoseMeasurement[]): string {
  const values = list.map((m) => m.glucose_mg);
  const avg = Math.round(values.reduce((a, b) => a + b, 0) / values.length);
  const min = Math.min(...values);
  const max = Math.max(...values);
  return `<div class="summary-box">
    <span>Ortalama: <strong>${avg} mg/dL</strong></span>&nbsp;&nbsp;
    <span>Min: <strong>${min} mg/dL</strong></span>&nbsp;&nbsp;
    <span>Maks: <strong>${max} mg/dL</strong></span>
  </div>`;
}

function buildBpSummary(list: BloodPressureMeasurement[]): string {
  const sys = list.map((m) => m.bp_systolic);
  const dia = list.map((m) => m.bp_diastolic);
  const avgSys = Math.round(sys.reduce((a, b) => a + b, 0) / sys.length);
  const avgDia = Math.round(dia.reduce((a, b) => a + b, 0) / dia.length);
  const minSys = Math.min(...sys);
  const maxSys = Math.max(...sys);
  const minDia = Math.min(...dia);
  const maxDia = Math.max(...dia);
  return `<div class="summary-box">
    <span>Büyük ort: <strong>${avgSys} mmHg</strong> (min ${minSys} / maks ${maxSys})</span>&nbsp;&nbsp;
    <span>Küçük ort: <strong>${avgDia} mmHg</strong> (min ${minDia} / maks ${maxDia})</span>
  </div>`;
}

// ─── HTML Oluşturma ────────────────────────────────────────────────────────────

function buildHtml(
  range: DateRange,
  measurements: Measurement[],
  waterEntries: WaterEntry[],
  reminders: Reminder[]
): string {
  const glucoseList = measurements.filter(
    (m): m is GlucoseMeasurement => m.type === "glucose"
  );
  const bpList = measurements.filter(
    (m): m is BloodPressureMeasurement => m.type === "blood_pressure"
  );

  // Şeker bölümü
  const glucoseSummaryHtml =
    glucoseList.length === 0
      ? `<p class="empty">Bu aralıkta şeker ölçümü kaydedilmemiş.</p>`
      : buildGlucoseSummary(glucoseList);

  const glucoseRowsHtml =
    glucoseList.length === 0
      ? ""
      : `<table>
          <thead><tr><th>Tarih</th><th>Saat</th><th>Öğün</th><th>Şeker (mg/dL)</th><th>Not</th></tr></thead>
          <tbody>
            ${glucoseList
              .map(
                (m) => `<tr>
                  <td>${fmtDate(m.recorded_at)}</td>
                  <td>${fmtTime(m.recorded_at)}</td>
                  <td>${MEAL_TAG_TR[m.meal_tag] ?? m.meal_tag}</td>
                  <td><strong>${m.glucose_mg}</strong></td>
                  <td>${m.glucose_note ?? "—"}</td>
                </tr>`
              )
              .join("")}
          </tbody>
        </table>`;

  // Tansiyon bölümü
  const bpSummaryHtml =
    bpList.length === 0
      ? `<p class="empty">Bu aralıkta tansiyon ölçümü kaydedilmemiş.</p>`
      : buildBpSummary(bpList);

  const bpRowsHtml =
    bpList.length === 0
      ? ""
      : `<table>
          <thead><tr><th>Tarih</th><th>Saat</th><th>Büyük (mmHg)</th><th>Küçük (mmHg)</th><th>Not</th></tr></thead>
          <tbody>
            ${bpList
              .map(
                (m) => `<tr>
                  <td>${fmtDate(m.recorded_at)}</td>
                  <td>${fmtTime(m.recorded_at)}</td>
                  <td><strong>${m.bp_systolic}</strong></td>
                  <td><strong>${m.bp_diastolic}</strong></td>
                  <td>${m.bp_note ?? "—"}</td>
                </tr>`
              )
              .join("")}
          </tbody>
        </table>`;

  // Su bölümü
  const dailyWaterMap = new Map<string, number>();
  for (const w of waterEntries) {
    const key = w.recorded_at.slice(0, 10);
    dailyWaterMap.set(key, (dailyWaterMap.get(key) ?? 0) + w.water_ml);
  }
  const waterDays = Array.from(dailyWaterMap.entries()).sort(([a], [b]) =>
    b.localeCompare(a)
  );

  const waterSectionHtml =
    waterDays.length === 0
      ? `<p class="empty">Bu aralıkta su tüketimi kaydedilmemiş.</p>`
      : `<table>
          <thead><tr><th>Tarih</th><th>Günlük Toplam</th></tr></thead>
          <tbody>
            ${waterDays
              .map(
                ([dateKey, total]) => `<tr>
                  <td>${fmtDate(dateKey + "T00:00:00")}</td>
                  <td>${total} ml</td>
                </tr>`
              )
              .join("")}
          </tbody>
        </table>`;

  // Hatırlatmalar bölümü
  const remindersHtml =
    reminders.length === 0
      ? `<p class="empty">Aktif hatırlatma planlanmamış.</p>`
      : `<table>
          <thead><tr><th>Etiket</th><th>Kategori</th><th>Saat</th><th>Günler</th></tr></thead>
          <tbody>
            ${reminders
              .map(
                (r) => `<tr>
                  <td>${r.label}${r.insulinColor ? ` (${r.insulinColor})` : ""}</td>
                  <td>${r.category === "insulin" ? "İnsülin" : "Ölçüm"}</td>
                  <td>${pad(r.hour)}:${pad(r.minute)}</td>
                  <td>${formatDays(r.daysOfWeek)}</td>
                </tr>`
              )
              .join("")}
          </tbody>
        </table>`;

  return `<!DOCTYPE html>
<html lang="tr">
<head>
  <meta charset="UTF-8" />
  <title>Sağlık Takip Özeti</title>
  <style>
    @page { size: A4; margin: 20mm 15mm; }
    * { box-sizing: border-box; }
    body {
      font-family: Arial, Helvetica, sans-serif;
      font-size: 11px;
      color: #1a1a1a;
      line-height: 1.5;
      margin: 0;
      padding: 0;
    }
    .header {
      text-align: center;
      border-bottom: 2px solid #333;
      padding-bottom: 10px;
      margin-bottom: 16px;
    }
    .header h1 { font-size: 20px; margin: 0 0 4px 0; }
    .header .subtitle { font-size: 13px; color: #444; margin: 2px 0; }
    .header .generated { font-size: 10px; color: #777; margin-top: 6px; }
    .disclaimer {
      background: #fff8e1;
      border: 1px solid #f0b429;
      border-radius: 4px;
      padding: 8px 12px;
      font-size: 10px;
      color: #7a5c00;
      margin-bottom: 20px;
    }
    .section { margin-bottom: 22px; page-break-inside: avoid; }
    .section h2 {
      font-size: 14px;
      font-weight: bold;
      border-bottom: 1px solid #ccc;
      padding-bottom: 4px;
      margin: 0 0 8px 0;
    }
    .summary-box {
      background: #f5f5f5;
      border-radius: 4px;
      padding: 6px 10px;
      margin-bottom: 8px;
      font-size: 10.5px;
    }
    table { width: 100%; border-collapse: collapse; font-size: 10.5px; }
    th {
      background: #e8e8e8;
      text-align: left;
      padding: 5px 7px;
      border: 1px solid #ccc;
      font-weight: bold;
    }
    td { padding: 4px 7px; border: 1px solid #ddd; vertical-align: top; }
    tr:nth-child(even) td { background: #fafafa; }
    .empty { color: #888; font-style: italic; font-size: 10.5px; margin: 6px 0; }
    .reminders-note { font-size: 9.5px; color: #777; font-style: italic; margin-bottom: 6px; }
  </style>
</head>
<body>
  <div class="header">
    <h1>Sağlık Takip Özeti</h1>
    <div class="subtitle">${fmtDateHuman(range.from)} – ${fmtDateHuman(range.to)}</div>
    <div class="generated">Oluşturulma: ${fmtNow()}</div>
  </div>

  <div class="disclaimer">
    Bu belge kişisel sağlık takibine yöneliktir. Tanı veya tedavi kararı için
    lütfen doktorunuza danışınız.
  </div>

  <div class="section">
    <h2>Seker Olcumleri (${glucoseList.length} kayit)</h2>
    ${glucoseSummaryHtml}
    ${glucoseRowsHtml}
  </div>

  <div class="section">
    <h2>Tansiyon Olcumleri (${bpList.length} kayit)</h2>
    ${bpSummaryHtml}
    ${bpRowsHtml}
  </div>

  <div class="section">
    <h2>Su Tuketimi (gunluk)</h2>
    ${waterSectionHtml}
  </div>

  <div class="section">
    <h2>Planlanan Hatirlatmalar</h2>
    <p class="reminders-note">
      Bu bolum gerceklesen kayitlari degil, kisisel hatirlatma planini gostermektedir.
    </p>
    ${remindersHtml}
  </div>
</body>
</html>`;
}

// ─── Ana İşlev ────────────────────────────────────────────────────────────────

export async function generateAndSharePdf(range: DateRange): Promise<void> {
  const [measurements, waterEntries, reminders] = await Promise.all([
    fetchMeasurementsInRange(range),
    fetchWaterInRange(range),
    fetchActiveReminders(),
  ]);

  const html = buildHtml(range, measurements, waterEntries, reminders);
  const { uri } = await Print.printToFileAsync({ html, base64: false });

  await Sharing.shareAsync(uri, {
    mimeType: "application/pdf",
    dialogTitle: "PDF Ozeti Paylas",
    UTI: "com.adobe.pdf",
  });
}
