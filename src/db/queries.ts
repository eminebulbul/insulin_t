import { db } from "./schema";

// ─── Tipler ───────────────────────────────────────────────────────────────────

export type MealTag = "aclik" | "tokluk" | "yatmadan_once" | "diger";
export type MeasurementType = "glucose" | "blood_pressure";

export interface GlucoseMeasurement {
  id: number;
  recorded_at: string;
  type: "glucose";
  meal_tag: MealTag;
  glucose_mg: number;
  glucose_note: string | null;
}

export interface BloodPressureMeasurement {
  id: number;
  recorded_at: string;
  type: "blood_pressure";
  meal_tag: null;
  bp_systolic: number;
  bp_diastolic: number;
  bp_note: string | null;
}

export type Measurement = GlucoseMeasurement | BloodPressureMeasurement;

// ─── Kaydetme ─────────────────────────────────────────────────────────────────

export async function insertGlucose(params: {
  recordedAt: string;
  mealTag: MealTag;
  glucoseMg: number;
  glucoseNote?: string;
}): Promise<number> {
  const result = await db.runAsync(
    `INSERT INTO measurements
       (recorded_at, type, meal_tag, glucose_mg, glucose_note,
        bp_systolic, bp_diastolic, bp_note)
     VALUES (?, 'glucose', ?, ?, ?, NULL, NULL, NULL)`,
    [
      params.recordedAt,
      params.mealTag,
      params.glucoseMg,
      params.glucoseNote ?? null,
    ]
  );
  return result.lastInsertRowId;
}

export async function insertBloodPressure(params: {
  recordedAt: string;
  bpSystolic: number;
  bpDiastolic: number;
  bpNote?: string;
}): Promise<number> {
  const result = await db.runAsync(
    `INSERT INTO measurements
       (recorded_at, type, meal_tag, glucose_mg, glucose_note,
        bp_systolic, bp_diastolic, bp_note)
     VALUES (?, 'blood_pressure', NULL, NULL, NULL, ?, ?, ?)`,
    [
      params.recordedAt,
      params.bpSystolic,
      params.bpDiastolic,
      params.bpNote ?? null,
    ]
  );
  return result.lastInsertRowId;
}

// ─── Okuma ────────────────────────────────────────────────────────────────────

/** Son N kaydı en yeni önce getirir */
export async function getRecentMeasurements(
  limit = 50
): Promise<Measurement[]> {
  return db.getAllAsync<Measurement>(
    `SELECT * FROM measurements ORDER BY recorded_at DESC LIMIT ?`,
    [limit]
  );
}

/** Belirli tarih aralığındaki tüm kayıtlar (PDF için) */
export async function getMeasurementsByRange(
  fromIso: string,
  toIso: string
): Promise<Measurement[]> {
  return db.getAllAsync<Measurement>(
    `SELECT * FROM measurements
     WHERE recorded_at >= ? AND recorded_at <= ?
     ORDER BY recorded_at ASC`,
    [fromIso, toIso]
  );
}

/** JSON yedek için tüm kayıtlar */
export async function getAllMeasurements(): Promise<Measurement[]> {
  return db.getAllAsync<Measurement>(
    `SELECT * FROM measurements ORDER BY recorded_at ASC`
  );
}

// ─── Water Log ────────────────────────────────────────────────────────────────

export interface WaterEntry {
  id: number;
  recorded_at: string;
  water_ml: number;
}

export async function insertWater(params: {
  recordedAt: string;
  waterMl: number;
}): Promise<number> {
  const result = await db.runAsync(
    `INSERT INTO water_log (recorded_at, water_ml) VALUES (?, ?)`,
    [params.recordedAt, params.waterMl]
  );
  return result.lastInsertRowId;
}

export async function getAllWaterEntries(): Promise<WaterEntry[]> {
  return db.getAllAsync<WaterEntry>(
    `SELECT * FROM water_log ORDER BY recorded_at ASC`
  );
}

// ─── Geçmiş ekranı için gruplu veri ──────────────────────────────────────────

/** Tek bir günün tüm kayıtları (ölçüm + su) */
export interface DayEntry {
  dateKey: string;           // "2026-09-25"
  measurements: Measurement[];
  waterEntries: WaterEntry[];
}

/**
 * Son N güne ait kayıtları tarihe göre gruplar.
 * Sonuç en yeni gün önce sıralıdır.
 */
export async function getGroupedHistory(days = 30): Promise<DayEntry[]> {
  const fromDate = new Date();
  fromDate.setDate(fromDate.getDate() - days + 1);
  fromDate.setHours(0, 0, 0, 0);
  const fromIso = fromDate.toISOString();

  const [measurements, waterEntries] = await Promise.all([
    db.getAllAsync<Measurement>(
      `SELECT * FROM measurements WHERE recorded_at >= ? ORDER BY recorded_at DESC`,
      [fromIso]
    ),
    db.getAllAsync<WaterEntry>(
      `SELECT * FROM water_log WHERE recorded_at >= ? ORDER BY recorded_at DESC`,
      [fromIso]
    ),
  ]);

  // Gün bazlı gruplama
  const map = new Map<string, DayEntry>();

  const getOrCreate = (dateKey: string): DayEntry => {
    if (!map.has(dateKey)) {
      map.set(dateKey, { dateKey, measurements: [], waterEntries: [] });
    }
    return map.get(dateKey)!;
  };

  for (const m of measurements) {
    const key = m.recorded_at.slice(0, 10); // "2026-09-25"
    getOrCreate(key).measurements.push(m);
  }
  for (const w of waterEntries) {
    const key = w.recorded_at.slice(0, 10);
    getOrCreate(key).waterEntries.push(w);
  }

  // En yeni gün önce
  return Array.from(map.values()).sort((a, b) =>
    b.dateKey.localeCompare(a.dateKey)
  );
}

/** Grafik verisi: belirli aralıktaki şeker ölçümleri */
export async function getGlucoseForChart(days = 7): Promise<GlucoseMeasurement[]> {
  const fromDate = new Date();
  fromDate.setDate(fromDate.getDate() - days + 1);
  fromDate.setHours(0, 0, 0, 0);
  return db.getAllAsync<GlucoseMeasurement>(
    `SELECT * FROM measurements WHERE type='glucose' AND recorded_at >= ? ORDER BY recorded_at ASC`,
    [fromDate.toISOString()]
  );
}

/** Grafik verisi: belirli aralıktaki tansiyon ölçümleri */
export async function getBPForChart(days = 7): Promise<BloodPressureMeasurement[]> {
  const fromDate = new Date();
  fromDate.setDate(fromDate.getDate() - days + 1);
  fromDate.setHours(0, 0, 0, 0);
  return db.getAllAsync<BloodPressureMeasurement>(
    `SELECT * FROM measurements WHERE type='blood_pressure' AND recorded_at >= ? ORDER BY recorded_at ASC`,
    [fromDate.toISOString()]
  );
}

/** Grafik verisi: günlük su toplamı */
export interface DailyWater {
  dateKey: string;
  total_ml: number;
}

export async function getDailyWaterForChart(days = 7): Promise<DailyWater[]> {
  const fromDate = new Date();
  fromDate.setDate(fromDate.getDate() - days + 1);
  fromDate.setHours(0, 0, 0, 0);
  return db.getAllAsync<DailyWater>(
    `SELECT substr(recorded_at, 1, 10) as dateKey, SUM(water_ml) as total_ml
     FROM water_log
     WHERE recorded_at >= ?
     GROUP BY dateKey
     ORDER BY dateKey ASC`,
    [fromDate.toISOString()]
  );
}

