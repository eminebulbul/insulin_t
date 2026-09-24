/**
 * Ölçüm giriş doğrulaması — iki katmanlı.
 *
 * Katman 1 (SERT ENGEL): Boş, sayı olmayan, <=0 değer → kayıt yapılamaz.
 * Katman 2 (ONAY DİYALOĞU): Değer girilmiş ama olağandışı aralıkta →
 *   "X girdiniz, doğru mu?" diyaloğu — onaylarsa kayıt yapılır.
 *
 * Tıbbi yorum içermez. Mesajlar sadece hangi alanın sorunlu olduğunu söyler.
 */

// ─── Sabitler ─────────────────────────────────────────────────────────────────

const GLUCOSE_MIN = 20;
const GLUCOSE_MAX = 600;
const SYSTOLIC_MIN = 50;
const SYSTOLIC_MAX = 300;
const DIASTOLIC_MIN = 20;
const DIASTOLIC_MAX = 200;

// ─── Sonuç tipleri ────────────────────────────────────────────────────────────

export type ValidationResult =
  | { status: "ok" }
  | { status: "hard_error"; message: string }
  | { status: "range_warning"; message: string };

// ─── Şeker doğrulaması ────────────────────────────────────────────────────────

export function validateGlucose(raw: string): ValidationResult {
  const trimmed = raw.trim();

  // Katman 1: Boş veya sayı değil
  if (trimmed === "") {
    return { status: "hard_error", message: "Şeker değeri boş bırakılamaz." };
  }

  const value = Number(trimmed);
  if (!Number.isFinite(value) || !Number.isInteger(value)) {
    return {
      status: "hard_error",
      message: "Şeker değeri tam sayı olmalıdır (örn: 95).",
    };
  }
  if (value <= 0) {
    return {
      status: "hard_error",
      message: "Şeker değeri 0'dan büyük olmalıdır.",
    };
  }

  // Katman 2: Aralık uyarısı
  if (value < GLUCOSE_MIN || value > GLUCOSE_MAX) {
    return {
      status: "range_warning",
      message: `${value} mg/dL girdiniz. Bu olağandışı bir değer. Doğru mu?`,
    };
  }

  return { status: "ok" };
}

// ─── Tansiyon doğrulaması ─────────────────────────────────────────────────────

export function validateBloodPressure(
  rawSystolic: string,
  rawDiastolic: string
): ValidationResult {
  const trimS = rawSystolic.trim();
  const trimD = rawDiastolic.trim();

  // Katman 1: Boş kontrol
  if (trimS === "" || trimD === "") {
    return {
      status: "hard_error",
      message: "Tansiyon için büyük ve küçük değerlerin ikisi de girilmeli.",
    };
  }

  const systolic = Number(trimS);
  const diastolic = Number(trimD);

  // Katman 1: Sayı değil
  if (!Number.isFinite(systolic) || !Number.isInteger(systolic)) {
    return {
      status: "hard_error",
      message: "Büyük tansiyon değeri tam sayı olmalıdır (örn: 120).",
    };
  }
  if (!Number.isFinite(diastolic) || !Number.isInteger(diastolic)) {
    return {
      status: "hard_error",
      message: "Küçük tansiyon değeri tam sayı olmalıdır (örn: 80).",
    };
  }

  // Katman 1: <= 0
  if (systolic <= 0) {
    return {
      status: "hard_error",
      message: "Büyük tansiyon değeri 0'dan büyük olmalıdır.",
    };
  }
  if (diastolic <= 0) {
    return {
      status: "hard_error",
      message: "Küçük tansiyon değeri 0'dan büyük olmalıdır.",
    };
  }

  // Katman 1: Küçük >= Büyük (fizyolojik imkânsızlık)
  if (diastolic >= systolic) {
    return {
      status: "hard_error",
      message: `Küçük tansiyon (${diastolic}) büyük tansiyondan (${systolic}) küçük olmalıdır.`,
    };
  }

  // Katman 2: Aralık uyarısı — olağandışı aralıkta
  const systolicOut =
    systolic < SYSTOLIC_MIN || systolic > SYSTOLIC_MAX;
  const diastolicOut =
    diastolic < DIASTOLIC_MIN || diastolic > DIASTOLIC_MAX;

  if (systolicOut || diastolicOut) {
    const parts: string[] = [];
    if (systolicOut) parts.push(`büyük: ${systolic}`);
    if (diastolicOut) parts.push(`küçük: ${diastolic}`);
    return {
      status: "range_warning",
      message: `${parts.join(", ")} — olağandışı değer. Doğru mu?`,
    };
  }

  return { status: "ok" };
}
