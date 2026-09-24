import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import { getAllMeasurements, getAllWaterEntries, Measurement } from "../db/queries";

// ─── JSON Yedek ───────────────────────────────────────────────────────────────

/**
 * Tüm ölçümleri JSON olarak dışa aktar.
 * Dosya geçici dizine yazılır, ardından paylaşım sayfası açılır.
 */
export async function exportJSON(): Promise<void> {
  const [measurements, waterEntries] = await Promise.all([
    getAllMeasurements(),
    getAllWaterEntries(),
  ]);

  const payload = {
    exportedAt: new Date().toISOString(),
    appVersion: "1.0.0",
    measurementCount: measurements.length,
    waterCount: waterEntries.length,
    measurements,
    waterEntries,
  };

  const json = JSON.stringify(payload, null, 2);
  const fileName = `saglik_yedek_${formatDateForFile(new Date())}.json`;
  const filePath = FileSystem.cacheDirectory + fileName;

  await FileSystem.writeAsStringAsync(filePath, json, {
    encoding: FileSystem.EncodingType.UTF8,
  });

  await Sharing.shareAsync(filePath, {
    mimeType: "application/json",
    dialogTitle: "JSON Yedeği Paylaş",
    UTI: "public.json",
  });
}

// ─── CSV Yedek ────────────────────────────────────────────────────────────────

/**
 * Tüm ölçümleri CSV olarak dışa aktar.
 * Doktor veya aile üyesiyle paylaşmak için kullanışlı.
 */
export async function exportCSV(): Promise<void> {
  const measurements = await getAllMeasurements();

  const header = [
    "id",
    "recorded_at",
    "type",
    "meal_tag",
    "glucose_mg",
    "glucose_note",
    "bp_systolic",
    "bp_diastolic",
    "bp_note",
  ].join(",");

  const rows = measurements.map((m) => {
    return [
      m.id,
      m.recorded_at,
      m.type,
      "meal_tag" in m && m.meal_tag ? m.meal_tag : "",
      "glucose_mg" in m && m.glucose_mg != null ? m.glucose_mg : "",
      "glucose_note" in m && m.glucose_note
        ? `"${m.glucose_note.replace(/"/g, '""')}"` // CSV escape
        : "",
      "bp_systolic" in m && m.bp_systolic != null ? m.bp_systolic : "",
      "bp_diastolic" in m && m.bp_diastolic != null ? m.bp_diastolic : "",
      "bp_note" in m && m.bp_note
        ? `"${m.bp_note.replace(/"/g, '""')}"`
        : "",
    ].join(",");
  });

  const csv = [header, ...rows].join("\n");
  const fileName = `saglik_yedek_${formatDateForFile(new Date())}.csv`;
  const filePath = FileSystem.cacheDirectory + fileName;

  await FileSystem.writeAsStringAsync(filePath, csv, {
    encoding: FileSystem.EncodingType.UTF8,
  });

  await Sharing.shareAsync(filePath, {
    mimeType: "text/csv",
    dialogTitle: "CSV Yedeği Paylaş",
    UTI: "public.comma-separated-values-text",
  });
}

// ─── Yardımcı ─────────────────────────────────────────────────────────────────

function formatDateForFile(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}${m}${d}`;
}
