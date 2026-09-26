import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  scheduleReminderNotifications,
  cancelReminderNotifications,
} from "@/utils/notifications";
import type { Reminder, ReminderCategory, InsulinColor } from "@/db/firestoreQueries";

export const REMINDER_LOCAL_STORAGE_KEY = "@saglik_reminder_local_state";

export type { ReminderCategory, InsulinColor };

export interface LocalReminderRecord {
  notificationIds: string[];
  lastSynced: {
    label: string;
    category: ReminderCategory;
    insulinColor: InsulinColor | null;
    hour: number;
    minute: number;
    daysOfWeek: number[];
    isActive: boolean;
  };
}

export type LocalReminderStorage = Record<string, LocalReminderRecord>;

/**
 * İki gün listesinin eşit olup olmadığını kontrol eder (sıralı veya sırasız).
 */
export function areDaysEqual(a: number[], b: number[]): boolean {
  if (a.length !== b.length) return false;
  const sortedA = [...a].sort((x, y) => x - y);
  const sortedB = [...b].sort((x, y) => x - y);
  return sortedA.every((val, idx) => val === sortedB[idx]);
}

/**
 * Gelen hatırlatma ile yereldeki son bilinen durum arasında bildirim gerektiren
 * bir değişiklik olup olmadığını test eder.
 */
export function hasReminderChanged(
  incoming: Reminder,
  stored: LocalReminderRecord["lastSynced"] | undefined
): boolean {
  if (!stored) return true;

  if (incoming.hour !== stored.hour) return true;
  if (incoming.minute !== stored.minute) return true;
  if (incoming.isActive !== stored.isActive) return true;
  if (incoming.label !== stored.label) return true;
  if (incoming.category !== stored.category) return true;
  if (incoming.insulinColor !== stored.insulinColor) return true;
  if (!areDaysEqual(incoming.daysOfWeek, stored.daysOfWeek)) return true;

  return false;
}

/**
 * Yerel AsyncStorage'daki hatırlatma durum tablosunu getirir.
 */
export async function getLocalReminderStorage(): Promise<LocalReminderStorage> {
  try {
    const raw = await AsyncStorage.getItem(REMINDER_LOCAL_STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch (err) {
    console.error("[ReminderSync] AsyncStorage okuma hatası:", err);
    return {};
  }
}

/**
 * Yerel AsyncStorage tablosunu kaydeder.
 */
export async function saveLocalReminderStorage(
  storage: LocalReminderStorage
): Promise<void> {
  try {
    await AsyncStorage.setItem(REMINDER_LOCAL_STORAGE_KEY, JSON.stringify(storage));
  } catch (err) {
    console.error("[ReminderSync] AsyncStorage yazma hatası:", err);
  }
}

/**
 * Firestore'dan onSnapshot ile gelen hatırlatma listesini yerel bildirimlerle
 * senkronize eder. Çift kurulumu önler, sadece değişenleri günceller, silinenleri iptal eder.
 */
export async function syncRemindersWithLocalNotifications(
  reminders: Reminder[]
): Promise<{
  updatedCount: number;
  unchangedCount: number;
  deletedCount: number;
}> {
  console.log(`[ReminderSync] Senkronizasyon başladı. Gelen hatırlatma sayısı: ${reminders.length}`);

  const localState = await getLocalReminderStorage();
  const currentDocIds = new Set(reminders.map((r) => r.id));

  let updatedCount = 0;
  let unchangedCount = 0;
  let deletedCount = 0;

  // 1. Gelen dokümanları işle
  for (const reminder of reminders) {
    const existing = localState[reminder.id];
    const changed = hasReminderChanged(reminder, existing?.lastSynced);

    if (!changed) {
      console.log(`[ReminderSync] Değişiklik yok, atlandı: ${reminder.id} ("${reminder.label}")`);
      unchangedCount++;
      continue;
    }

    console.log(
      `[ReminderSync] ${existing ? "Güncelleme tespit edildi" : "Yeni hatırlatma"}: ${reminder.id} ("${reminder.label}")`
    );

    // Eski bildirimleri iptal et
    if (existing?.notificationIds && existing.notificationIds.length > 0) {
      console.log(`[ReminderSync] Eski bildirimler iptal ediliyor: ${existing.notificationIds.join(", ")}`);
      await cancelReminderNotifications(existing.notificationIds);
    }

    let newNotificationIds: string[] = [];

    // Eğer aktifse yeni bildirim planla
    if (reminder.isActive) {
      newNotificationIds = await scheduleReminderNotifications({
        label: reminder.label,
        category: reminder.category,
        insulinColor: reminder.insulinColor,
        hour: reminder.hour,
        minute: reminder.minute,
        daysOfWeek: reminder.daysOfWeek,
      });
      console.log(
        `[ReminderSync] Yeni bildirimler kuruldu (${newNotificationIds.length} adet): ${newNotificationIds.join(", ")}`
      );
    } else {
      console.log(`[ReminderSync] Hatırlatma pasif durumda, yeni bildirim kurulmadı: ${reminder.id}`);
    }

    // Yerel state'i güncelle
    localState[reminder.id] = {
      notificationIds: newNotificationIds,
      lastSynced: {
        label: reminder.label,
        category: reminder.category,
        insulinColor: reminder.insulinColor,
        hour: reminder.hour,
        minute: reminder.minute,
        daysOfWeek: [...reminder.daysOfWeek],
        isActive: reminder.isActive,
      },
    };

    updatedCount++;
  }

  // 2. Firestore'dan silinmiş dokümanları bul ve yerel bildirimlerini iptal et
  for (const storedId of Object.keys(localState)) {
    if (!currentDocIds.has(storedId)) {
      console.log(`[ReminderSync] Doküman Firestore'dan silinmiş, yerel bildirim iptal ediliyor: ${storedId}`);
      const staleRecord = localState[storedId];
      if (staleRecord?.notificationIds && staleRecord.notificationIds.length > 0) {
        await cancelReminderNotifications(staleRecord.notificationIds);
      }
      delete localState[storedId];
      deletedCount++;
    }
  }

  // Güncel tabloyu AsyncStorage'a kaydet
  await saveLocalReminderStorage(localState);

  console.log(
    `[ReminderSync] Senkronizasyon tamamlandı: ${updatedCount} güncellendi/kuruldu, ${unchangedCount} değişmedi, ${deletedCount} silindi.`
  );

  return { updatedCount, unchangedCount, deletedCount };
}
