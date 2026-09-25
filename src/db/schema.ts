import * as SQLite from "expo-sqlite";

/**
 * Veritabanı şeması ve migration.
 *
 * Tasarım kararları:
 * - Her satır TEK bir ölçüm türü (glucose veya blood_pressure).
 *   Bu sayede babaannem farklı saatlerde ayrı ayrı ölçüm girebilir
 *   ve her kayıt kendi doğru zamanına sahip olur.
 * - meal_tag sadece glucose için zorunlu — CHECK constraint bunu güvence altına alır.
 * - recorded_at ISO 8601 string: timezone-safe, sıralama direkt çalışır.
 * - user_version pragması ile ilerideki migration'lar yönetilebilir.
 */

export let db: SQLite.SQLiteDatabase;

export async function initDatabase(): Promise<void> {
  db = await SQLite.openDatabaseAsync("saglik.db");

  // WAL modu: yazma sırasında okuma engellenmesin
  await db.execAsync("PRAGMA journal_mode = WAL;");

  const version = await db.getFirstAsync<{ user_version: number }>(
    "PRAGMA user_version"
  );
  const currentVersion = version?.user_version ?? 0;

  if (currentVersion < 1) {
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS measurements (
        id            INTEGER PRIMARY KEY AUTOINCREMENT,
        recorded_at   TEXT    NOT NULL,
        type          TEXT    NOT NULL CHECK(type IN ('glucose', 'blood_pressure')),

        -- Şeker alanları: sadece type='glucose' için dolu
        meal_tag      TEXT    CHECK(
                        (type = 'glucose' AND meal_tag IN ('aclik','tokluk','yatmadan_once','diger'))
                        OR
                        (type = 'blood_pressure' AND meal_tag IS NULL)
                      ),
        glucose_mg    INTEGER CHECK(
                        (type = 'glucose' AND glucose_mg IS NOT NULL AND glucose_mg > 0)
                        OR
                        (type = 'blood_pressure' AND glucose_mg IS NULL)
                      ),
        glucose_note  TEXT    CHECK(
                        (type = 'glucose') OR (type = 'blood_pressure' AND glucose_note IS NULL)
                      ),

        -- Tansiyon alanları: sadece type='blood_pressure' için dolu
        bp_systolic   INTEGER CHECK(
                        (type = 'blood_pressure' AND bp_systolic IS NOT NULL AND bp_systolic > 0)
                        OR
                        (type = 'glucose' AND bp_systolic IS NULL)
                      ),
        bp_diastolic  INTEGER CHECK(
                        (type = 'blood_pressure' AND bp_diastolic IS NOT NULL AND bp_diastolic > 0)
                        OR
                        (type = 'glucose' AND bp_diastolic IS NULL)
                      ),
        bp_note       TEXT    CHECK(
                        (type = 'blood_pressure') OR (type = 'glucose' AND bp_note IS NULL)
                      )
      );

      CREATE INDEX IF NOT EXISTS idx_measurements_recorded_at
        ON measurements(recorded_at DESC);

      PRAGMA user_version = 1;
    `);
  }

  // Su takibi — ayrı tablo (measurements'taki CHECK constraint'lerle çakışmasın)
  if (currentVersion < 2) {
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS water_log (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        recorded_at TEXT    NOT NULL,
        water_ml    INTEGER NOT NULL CHECK(water_ml > 0)
      );

      CREATE INDEX IF NOT EXISTS idx_water_log_recorded_at
        ON water_log(recorded_at DESC);

      PRAGMA user_version = 2;
    `);
  }

  // Hatırlatmalar — migration v3
  if (currentVersion < 3) {
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS reminders (
        id                INTEGER PRIMARY KEY AUTOINCREMENT,
        label             TEXT    NOT NULL,
        category          TEXT    NOT NULL CHECK(category IN ('insulin', 'measurement')),

        -- insulin_color: sadece category='insulin' için zorunlu
        insulin_color     TEXT    CHECK(
                            (category = 'insulin'     AND insulin_color IN ('turuncu', 'gri'))
                            OR
                            (category = 'measurement' AND insulin_color IS NULL)
                          ),

        hour              INTEGER NOT NULL CHECK(hour   BETWEEN 0 AND 23),
        minute            INTEGER NOT NULL CHECK(minute BETWEEN 0 AND 59),

        -- days_of_week: JSON array [1..7], 1=Pazartesi, 7=Pazar
        -- Örn: her gün → [1,2,3,4,5,6,7], sadece Pzt-Cum → [1,2,3,4,5]
        days_of_week      TEXT    NOT NULL,

        is_active         INTEGER NOT NULL DEFAULT 1 CHECK(is_active IN (0, 1)),

        -- notification_ids: JSON array — her seçili gün için ayrı expo notification ID
        notification_ids  TEXT    NULL
      );

      PRAGMA user_version = 3;
    `);
  }
}
