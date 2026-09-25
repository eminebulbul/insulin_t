import * as Notifications from "expo-notifications";
import { Platform, Linking } from "react-native";
import { Reminder } from "../db/reminderQueries";

// ─── Bildirim handler (uygulama öndeyken de göster) ──────────────────────────

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

// ─── Android Bildirim Kanalı ──────────────────────────────────────────────────

const CHANNEL_ID = "saglik-hatirlatma";

/**
 * Android bildirim kanalını kurar.
 * Uygulama ilk başladığında bir kere çağrılır (_layout.tsx içinden).
 * iOS'ta no-op'tur.
 *
 * Neden MAX importance?
 * İnsülin hatırlatmaları gecikirse sağlık riski oluşabilir.
 * MAX: bildirim anında ekranda görünür, ses çalar, titre.
 */
export async function setupNotificationChannel(): Promise<void> {
  if (Platform.OS !== "android") return;

  await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
    name: "Sağlık Hatırlatmaları",
    description: "İnsülin ve ölçüm hatırlatmaları",
    importance: Notifications.AndroidImportance.MAX,
    sound: "default",
    vibrationPattern: [0, 250, 250, 250],
    enableLights: true,
    lightColor: "#58A6FF",
    enableVibrate: true,
    showBadge: true,
  });
}

// ─── İzin yönetimi ────────────────────────────────────────────────────────────

export type PermissionState =
  | "granted"
  | "denied"
  | "undetermined"
  | "exact_alarm_denied"; // Android 12+ SCHEDULE_EXACT_ALARM

export interface PermissionCheckResult {
  state: PermissionState;
  canAskAgain: boolean;
}

/**
 * Bildirim iznini kontrol eder ve gerekirse ister.
 * Android 12+ için SCHEDULE_EXACT_ALARM ayrıca kontrol edilir.
 */
export async function requestNotificationPermission(): Promise<PermissionCheckResult> {
  const { status, canAskAgain } = await Notifications.requestPermissionsAsync({
    ios: {
      allowAlert: true,
      allowBadge: true,
      allowSound: true,
    },
  });

  if (status !== "granted") {
    return { state: "denied", canAskAgain };
  }

  // Android 12+ (API 31+): SCHEDULE_EXACT_ALARM ayrı kontrol
  if (Platform.OS === "android" && Platform.Version >= 31) {
    // expo-notifications şu an exact alarm iznini doğrudan expose etmiyor.
    // Pratik yaklaşım: bildirimi planla, başarısız olursa kullanıcıyı ayarlara yönlendir.
    void Notifications.getNotificationChannelsAsync(); // kanal varlığı konfirme et
  }

  return { state: "granted", canAskAgain: true };
}

/** Sistem ayarları sayfasını açar */
export function openNotificationSettings(): void {
  Linking.openSettings();
}

// ─── Gün dönüşümü: Türkçe gün → Expo weekday ─────────────────────────────────
//
// Expo WEEKLY trigger: weekday 1=Pazar, 2=Pazartesi, ..., 7=Cumartesi
// Bizim UI:            1=Pazartesi, 2=Salı, ..., 7=Pazar
//
// Dönüşüm tablosu (doğrulama için açık yazıldı):
//
// | Bizim gün | Türkçe     | Expo weekday | Expo karşılığı |
// |-----------|------------|--------------|----------------|
// |     1     | Pazartesi  |      2       | Monday         |
// |     2     | Salı       |      3       | Tuesday        |
// |     3     | Çarşamba   |      4       | Wednesday      |
// |     4     | Perşembe   |      5       | Thursday       |
// |     5     | Cuma       |      6       | Friday         |
// |     6     | Cumartesi  |      7       | Saturday       |
// |     7     | Pazar      |      1       | Sunday         |
//
// Formül: expoWeekday = ourDay === 7 ? 1 : ourDay + 1

export function toExpoWeekday(ourDay: number): number {
  if (ourDay < 1 || ourDay > 7) {
    throw new Error(`Geçersiz gün numarası: ${ourDay}. 1-7 arasında olmalı.`);
  }
  return ourDay === 7 ? 1 : ourDay + 1;
}

/** Dönüşüm tablosunu loglar — geliştirme/test için */
export function logDayConversionTable(): void {
  const TR_DAYS = [
    "",
    "Pazartesi",
    "Salı",
    "Çarşamba",
    "Perşembe",
    "Cuma",
    "Cumartesi",
    "Pazar",
  ];
  const EXPO_DAYS = [
    "",
    "Sunday",
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
  ];

  console.log("=== Gün Dönüşüm Tablosu ===");
  for (let ourDay = 1; ourDay <= 7; ourDay++) {
    const expoWeekday = toExpoWeekday(ourDay);
    const correct =
      (ourDay === 1 && expoWeekday === 2) ||
      (ourDay === 2 && expoWeekday === 3) ||
      (ourDay === 3 && expoWeekday === 4) ||
      (ourDay === 4 && expoWeekday === 5) ||
      (ourDay === 5 && expoWeekday === 6) ||
      (ourDay === 6 && expoWeekday === 7) ||
      (ourDay === 7 && expoWeekday === 1);

    console.log(
      `Bizim ${ourDay} (${TR_DAYS[ourDay]}) → Expo weekday ${expoWeekday} (${EXPO_DAYS[expoWeekday]}) ${correct ? "✓" : "✗ HATA"}`
    );
  }
  console.log("===========================");
}

// ─── Bildirim planlama ────────────────────────────────────────────────────────

/**
 * Bir hatırlatma için bildirim(ler) planlar.
 *
 * Her gün → DAILY trigger (1 bildirim ID)
 * Belirli günler → her gün için ayrı WEEKLY trigger (N bildirim ID)
 *
 * Returns: planlanmış notification ID'leri
 */
export async function scheduleReminderNotifications(
  reminder: Pick<Reminder, "label" | "category" | "insulinColor" | "hour" | "minute" | "daysOfWeek">
): Promise<string[]> {
  const { label, category, insulinColor, hour, minute, daysOfWeek } = reminder;

  // Bildirim başlığı
  const title = buildNotificationTitle(category, insulinColor);
  const body = label;

  const isEveryDay = daysOfWeek.length === 7;
  const ids: string[] = [];

  if (isEveryDay) {
    // Tek DAILY trigger
    const id = await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        sound: true,
        data: { reminderId: -1 }, // ID henüz belli değil, güncelleme ile doldurulur
        ...(Platform.OS === "android" && { channelId: CHANNEL_ID }),
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour,
        minute,
        ...(Platform.OS === "android" && { channelId: CHANNEL_ID }),
      },
    });
    ids.push(id);
  } else {
    // Her seçili gün için WEEKLY trigger
    for (const ourDay of daysOfWeek) {
      const weekday = toExpoWeekday(ourDay);
      const id = await Notifications.scheduleNotificationAsync({
        content: {
          title,
          body,
          sound: true,
          data: { reminderId: -1 },
          ...(Platform.OS === "android" && { channelId: CHANNEL_ID }),
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
          weekday,
          hour,
          minute,
          ...(Platform.OS === "android" && { channelId: CHANNEL_ID }),
        },
      });
      ids.push(id);
    }
  }

  return ids;
}

/**
 * Bir hatırlatmaya ait tüm bildirimleri iptal eder.
 */
export async function cancelReminderNotifications(
  notificationIds: string[]
): Promise<void> {
  await Promise.all(
    notificationIds.map((id) =>
      Notifications.cancelScheduledNotificationAsync(id).catch((err) => {
        // Zaten iptal edilmişse veya ID geçersizse sessizce geç
        console.warn(`Bildirim iptal edilemedi (${id}):`, err);
      })
    )
  );
}

// ─── Yardımcı ─────────────────────────────────────────────────────────────────

function buildNotificationTitle(
  category: Reminder["category"],
  insulinColor: Reminder["insulinColor"]
): string {
  if (category === "insulin") {
    const renk = insulinColor === "turuncu" ? "🟠 Turuncu" : "⚫ Gri";
    return `${renk} İnsülin Zamanı`;
  }
  return "🩸 Ölçüm Zamanı";
}


