import {
  getFirestore,
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  getDocs,
  onSnapshot,
  query,
  orderBy,
  serverTimestamp,
  QuerySnapshot,
  DocumentData,
} from "@react-native-firebase/firestore";

// ─── Tipler ───────────────────────────────────────────────────────────────────

export type MealTag = "aclik" | "tokluk" | "yatmadan_once" | "diger";
export type MeasurementType = "glucose" | "blood_pressure";

export interface GlucoseMeasurement {
  id: string; // Firestore doküman ID
  recorded_at: string;
  type: "glucose";
  meal_tag: MealTag;
  glucose_mg: number;
  glucose_note: string | null;
  created_at?: any;
}

export interface BloodPressureMeasurement {
  id: string;
  recorded_at: string;
  type: "blood_pressure";
  meal_tag: null;
  bp_systolic: number;
  bp_diastolic: number;
  bp_note: string | null;
  created_at?: any;
}

export type Measurement = GlucoseMeasurement | BloodPressureMeasurement;

export interface WaterEntry {
  id: string;
  recorded_at: string;
  water_ml: number;
  created_at?: any;
}

export type ReminderCategory = "insulin" | "measurement";
export type InsulinColor = "turuncu" | "gri";

export interface Reminder {
  id: string; // Firestore doküman ID
  label: string;
  category: ReminderCategory;
  insulinColor: InsulinColor | null;
  hour: number;
  minute: number;
  daysOfWeek: number[]; // [1..7], 1=Pazartesi
  isActive: boolean;
}

// ─── Koleksiyon Referansları ───────────────────────────────────────────────────

const db = getFirestore();
export const measurementsCollection = collection(db, "measurements");
export const waterLogCollection = collection(db, "water_log");
export const remindersCollection = collection(db, "reminders");

// ─── Kaydetme İşlemleri (İstemci Doğrulaması ile) ─────────────────────────────

export async function insertGlucose(params: {
  recordedAt: string;
  mealTag: MealTag;
  glucoseMg: number;
  glucoseNote?: string;
}): Promise<string> {
  // İstemci tarafı doğrulama
  if (!params.recordedAt) throw new Error("Kayıt zamanı zorunludur.");
  if (!["aclik", "tokluk", "yatmadan_once", "diger"].includes(params.mealTag)) {
    throw new Error("Geçerli bir öğün etiketi seçilmelidir.");
  }
  if (!params.glucoseMg || params.glucoseMg <= 0) {
    throw new Error("Şeker değeri 0'dan büyük olmalıdır.");
  }

  const docRef = await addDoc(measurementsCollection, {
    type: "glucose",
    recorded_at: params.recordedAt,
    meal_tag: params.mealTag,
    glucose_mg: params.glucoseMg,
    glucose_note: params.glucoseNote?.trim() || null,
    bp_systolic: null,
    bp_diastolic: null,
    bp_note: null,
    created_at: serverTimestamp(),
  });

  return docRef.id;
}

export async function insertBloodPressure(params: {
  recordedAt: string;
  bpSystolic: number;
  bpDiastolic: number;
  bpNote?: string;
}): Promise<string> {
  // İstemci tarafı doğrulama
  if (!params.recordedAt) throw new Error("Kayıt zamanı zorunludur.");
  if (!params.bpSystolic || params.bpSystolic <= 0) {
    throw new Error("Büyük tansiyon 0'dan büyük olmalıdır.");
  }
  if (!params.bpDiastolic || params.bpDiastolic <= 0) {
    throw new Error("Küçük tansiyon 0'dan büyük olmalıdır.");
  }

  const docRef = await addDoc(measurementsCollection, {
    type: "blood_pressure",
    recorded_at: params.recordedAt,
    meal_tag: null,
    glucose_mg: null,
    glucose_note: null,
    bp_systolic: params.bpSystolic,
    bp_diastolic: params.bpDiastolic,
    bp_note: params.bpNote?.trim() || null,
    created_at: serverTimestamp(),
  });

  return docRef.id;
}

export async function insertWater(params: {
  recordedAt: string;
  waterMl: number;
}): Promise<string> {
  if (!params.recordedAt) throw new Error("Kayıt zamanı zorunludur.");
  if (!params.waterMl || params.waterMl <= 0) {
    throw new Error("Su miktarı 0'dan büyük olmalıdır.");
  }

  const docRef = await addDoc(waterLogCollection, {
    recorded_at: params.recordedAt,
    water_ml: params.waterMl,
    created_at: serverTimestamp(),
  });

  return docRef.id;
}

// ─── Ölçüm ve Su Güncelleme / Silme ──────────────────────────────────────────

export type UpdateMeasurementParams =
  | {
      type: "glucose";
      recordedAt: string;
      mealTag: MealTag;
      glucoseMg: number;
      glucoseNote?: string | null;
    }
  | {
      type: "blood_pressure";
      recordedAt: string;
      bpSystolic: number;
      bpDiastolic: number;
      bpNote?: string | null;
    };

/**
 * Ölçüm kaydını günceller.
 * DİKKAT: created_at alanına KESİNLİKLE dokunulmaz (denetim izi için sabit kalmalıdır).
 */
export async function updateMeasurement(
  id: string,
  params: UpdateMeasurementParams
): Promise<void> {
  if (!id) throw new Error("Doküman ID zorunludur.");
  if (!params.recordedAt) throw new Error("Kayıt zamanı zorunludur.");

  const docRef = doc(db, "measurements", id);

  if (params.type === "glucose") {
    if (!["aclik", "tokluk", "yatmadan_once", "diger"].includes(params.mealTag)) {
      throw new Error("Geçerli bir öğün etiketi seçilmelidir.");
    }
    if (!params.glucoseMg || params.glucoseMg <= 0) {
      throw new Error("Şeker değeri 0'dan büyük olmalıdır.");
    }
    await updateDoc(docRef, {
      recorded_at: params.recordedAt,
      meal_tag: params.mealTag,
      glucose_mg: params.glucoseMg,
      glucose_note: params.glucoseNote?.trim() || null,
    });
  } else if (params.type === "blood_pressure") {
    if (!params.bpSystolic || params.bpSystolic <= 0) {
      throw new Error("Büyük tansiyon 0'dan büyük olmalıdır.");
    }
    if (!params.bpDiastolic || params.bpDiastolic <= 0) {
      throw new Error("Küçük tansiyon 0'dan büyük olmalıdır.");
    }
    await updateDoc(docRef, {
      recorded_at: params.recordedAt,
      bp_systolic: params.bpSystolic,
      bp_diastolic: params.bpDiastolic,
      bp_note: params.bpNote?.trim() || null,
    });
  }
}

/**
 * Ölçüm kaydını Firestore'dan siler.
 */
export async function deleteMeasurement(id: string): Promise<void> {
  if (!id) throw new Error("Doküman ID zorunludur.");
  const docRef = doc(db, "measurements", id);
  await deleteDoc(docRef);
}

/**
 * Su kaydını günceller.
 * DİKKAT: created_at alanına KESİNLİKLE dokunulmaz.
 */
export async function updateWaterEntry(params: {
  id: string;
  recordedAt: string;
  waterMl: number;
}): Promise<void> {
  if (!params.id) throw new Error("Doküman ID zorunludur.");
  if (!params.recordedAt) throw new Error("Kayıt zamanı zorunludur.");
  if (!params.waterMl || params.waterMl <= 0) {
    throw new Error("Su miktarı 0'dan büyük olmalıdır.");
  }

  const docRef = doc(db, "water_log", params.id);
  await updateDoc(docRef, {
    recorded_at: params.recordedAt,
    water_ml: params.waterMl,
  });
}

/**
 * Su kaydını Firestore'dan siler.
 */
export async function deleteWaterEntry(id: string): Promise<void> {
  if (!id) throw new Error("Doküman ID zorunludur.");
  const docRef = doc(db, "water_log", id);
  await deleteDoc(docRef);
}

// ─── Hatırlatma CRUD (Firestore Plan Dokümanı) ───────────────────────────────────

export async function insertReminder(params: {
  label: string;
  category: ReminderCategory;
  insulinColor?: InsulinColor | null;
  hour: number;
  minute: number;
  daysOfWeek: number[];
}): Promise<string> {
  if (!params.label.trim()) throw new Error("Hatırlatma etiketi boş olamaz.");
  if (params.category === "insulin" && !params.insulinColor) {
    throw new Error("İnsülin hatırlatmaları için insülin rengi (turuncu/gri) zorunludur.");
  }
  if (params.hour < 0 || params.hour > 23 || params.minute < 0 || params.minute > 59) {
    throw new Error("Geçerli bir saat ve dakika girilmelidir.");
  }
  if (!params.daysOfWeek || params.daysOfWeek.length === 0) {
    throw new Error("En az bir gün seçilmelidir.");
  }

  const docRef = await addDoc(remindersCollection, {
    label: params.label.trim(),
    category: params.category,
    insulin_color: params.category === "insulin" ? params.insulinColor : null,
    hour: params.hour,
    minute: params.minute,
    days_of_week: params.daysOfWeek,
    is_active: true,
    created_at: serverTimestamp(),
  });

  return docRef.id;
}

export async function updateReminder(params: {
  id: string;
  label: string;
  category: ReminderCategory;
  insulinColor?: InsulinColor | null;
  hour: number;
  minute: number;
  daysOfWeek: number[];
}): Promise<void> {
  if (!params.label.trim()) throw new Error("Hatırlatma etiketi boş olamaz.");
  if (params.category === "insulin" && !params.insulinColor) {
    throw new Error("İnsülin hatırlatmaları için insülin rengi zorunludur.");
  }

  const docRef = doc(db, "reminders", params.id);
  await updateDoc(docRef, {
    label: params.label.trim(),
    category: params.category,
    insulin_color: params.category === "insulin" ? params.insulinColor : null,
    hour: params.hour,
    minute: params.minute,
    days_of_week: params.daysOfWeek,
  });
}

export async function setReminderActive(id: string, isActive: boolean): Promise<void> {
  const docRef = doc(db, "reminders", id);
  await updateDoc(docRef, {
    is_active: isActive,
  });
}

export async function deleteReminder(id: string): Promise<void> {
  const docRef = doc(db, "reminders", id);
  await deleteDoc(docRef);
}

// ─── Canlı Senkronizasyon (onSnapshot Dinleyicileri) ───────────────────────────

/**
 * Ölçümleri canlı olarak dinler (en yeni tarih önce sıralı).
 */
export function subscribeToMeasurements(
  callback: (measurements: Measurement[]) => void,
  onError?: (error: Error) => void
): () => void {
  const q = query(measurementsCollection, orderBy("recorded_at", "desc"));
  return onSnapshot(
    q,
    (snapshot: QuerySnapshot<DocumentData>) => {
      if (!snapshot) return;
      const list: Measurement[] = snapshot.docs.map((docSnap: any) => {
        const data = docSnap.data();
        if (data.type === "glucose") {
          return {
            id: docSnap.id,
            recorded_at: data.recorded_at,
            type: "glucose",
            meal_tag: data.meal_tag,
            glucose_mg: data.glucose_mg,
            glucose_note: data.glucose_note ?? null,
            created_at: data.created_at,
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
            created_at: data.created_at,
          } as BloodPressureMeasurement;
        }
      });
      callback(list);
    },
    (error: Error) => {
      console.error("Ölçümler canlı dinleme hatası:", error);
      if (onError) onError(error);
    }
  );
}

/**
 * Su kayıtlarını canlı olarak dinler (en yeni önce).
 */
export function subscribeToWaterLog(
  callback: (entries: WaterEntry[]) => void,
  onError?: (error: Error) => void
): () => void {
  const q = query(waterLogCollection, orderBy("recorded_at", "desc"));
  return onSnapshot(
    q,
    (snapshot: QuerySnapshot<DocumentData>) => {
      if (!snapshot) return;
      const list: WaterEntry[] = snapshot.docs.map((docSnap: any) => {
        const data = docSnap.data();
        return {
          id: docSnap.id,
          recorded_at: data.recorded_at,
          water_ml: data.water_ml,
          created_at: data.created_at,
        };
      });
      callback(list);
    },
    (error: Error) => {
      console.error("Su kayıtları canlı dinleme hatası:", error);
      if (onError) onError(error);
    }
  );
}

/**
 * Hatırlatmaları canlı olarak dinler (saat ve dakikaya göre sıralı).
 */
export function subscribeToReminders(
  callback: (reminders: Reminder[]) => void,
  onError?: (error: Error) => void
): () => void {
  const q = query(remindersCollection, orderBy("hour", "asc"), orderBy("minute", "asc"));
  return onSnapshot(
    q,
    (snapshot: QuerySnapshot<DocumentData>) => {
      if (!snapshot) return;
      const list: Reminder[] = snapshot.docs.map((docSnap: any) => {
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
        };
      });
      callback(list);
    },
    (error: Error) => {
      console.error("Hatırlatmalar canlı dinleme hatası:", error);
      if (onError) onError(error);
    }
  );
}

// ─── Dışa Aktarma / Raporlama İçin Tek Seferlik Okuma (Offline Cache Destekli) ──

export async function getAllMeasurements(): Promise<Measurement[]> {
  const q = query(measurementsCollection, orderBy("recorded_at", "asc"));
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

export async function getAllWaterEntries(): Promise<WaterEntry[]> {
  const q = query(waterLogCollection, orderBy("recorded_at", "asc"));
  const snapshot = await getDocs(q);
  return snapshot.docs.map((docSnap: any) => {
    const data = docSnap.data();
    return {
      id: docSnap.id,
      recorded_at: data.recorded_at,
      water_ml: data.water_ml,
    };
  });
}

export async function getAllReminders(): Promise<Reminder[]> {
  const q = query(remindersCollection, orderBy("hour", "asc"), orderBy("minute", "asc"));
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
    };
  });
}

// ─── Geçmiş Ekranı İçin Gruplama ve Grafik Yardımcıları ────────────────────────

export interface DayEntry {
  dateKey: string; // "2026-09-25"
  measurements: Measurement[];
  waterEntries: WaterEntry[];
}

export interface DailyWater {
  dateKey: string;
  total_ml: number;
}

/**
 * Gelen canlı ölçüm ve su listelerini son N güne göre gruplar (en yeni gün önce).
 */
export function groupMeasurementsAndWater(
  measurements: Measurement[],
  waterEntries: WaterEntry[],
  days = 30
): DayEntry[] {
  const fromDate = new Date();
  fromDate.setDate(fromDate.getDate() - days + 1);
  fromDate.setHours(0, 0, 0, 0);
  const fromIso = fromDate.toISOString();

  const map = new Map<string, DayEntry>();

  const getOrCreate = (dateKey: string): DayEntry => {
    if (!map.has(dateKey)) {
      map.set(dateKey, { dateKey, measurements: [], waterEntries: [] });
    }
    return map.get(dateKey)!;
  };

  for (const m of measurements) {
    if (m.recorded_at >= fromIso) {
      const key = m.recorded_at.slice(0, 10);
      getOrCreate(key).measurements.push(m);
    }
  }

  for (const w of waterEntries) {
    if (w.recorded_at >= fromIso) {
      const key = w.recorded_at.slice(0, 10);
      getOrCreate(key).waterEntries.push(w);
    }
  }

  return Array.from(map.values()).sort((a, b) => b.dateKey.localeCompare(a.dateKey));
}

/**
 * Son N günün şeker ölçümlerini filtreler ve eskiden yeniye sıralar.
 */
export function getGlucoseForChartFromList(
  measurements: Measurement[],
  days = 7
): GlucoseMeasurement[] {
  const fromDate = new Date();
  fromDate.setDate(fromDate.getDate() - days + 1);
  fromDate.setHours(0, 0, 0, 0);
  const fromIso = fromDate.toISOString();

  return measurements
    .filter((m): m is GlucoseMeasurement => m.type === "glucose" && m.recorded_at >= fromIso)
    .sort((a, b) => a.recorded_at.localeCompare(b.recorded_at));
}

/**
 * Son N günün tansiyon ölçümlerini filtreler ve eskiden yeniye sıralar.
 */
export function getBPForChartFromList(
  measurements: Measurement[],
  days = 7
): BloodPressureMeasurement[] {
  const fromDate = new Date();
  fromDate.setDate(fromDate.getDate() - days + 1);
  fromDate.setHours(0, 0, 0, 0);
  const fromIso = fromDate.toISOString();

  return measurements
    .filter((m): m is BloodPressureMeasurement => m.type === "blood_pressure" && m.recorded_at >= fromIso)
    .sort((a, b) => a.recorded_at.localeCompare(b.recorded_at));
}

/**
 * Son N günün günlük toplam su miktarını hesaplar ve tarihe göre sıralar.
 */
export function getDailyWaterForChartFromList(
  waterEntries: WaterEntry[],
  days = 7
): DailyWater[] {
  const fromDate = new Date();
  fromDate.setDate(fromDate.getDate() - days + 1);
  fromDate.setHours(0, 0, 0, 0);
  const fromIso = fromDate.toISOString();

  const dayTotals = new Map<string, number>();

  for (const entry of waterEntries) {
    if (entry.recorded_at >= fromIso) {
      const dateKey = entry.recorded_at.slice(0, 10);
      dayTotals.set(dateKey, (dayTotals.get(dateKey) || 0) + entry.water_ml);
    }
  }

  const result: DailyWater[] = [];
  for (const [dateKey, total_ml] of dayTotals.entries()) {
    result.push({ dateKey, total_ml });
  }

  return result.sort((a, b) => a.dateKey.localeCompare(b.dateKey));
}
