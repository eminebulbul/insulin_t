import { db } from "./schema";

// ─── Tipler ───────────────────────────────────────────────────────────────────

export type ReminderCategory = "insulin" | "measurement";
export type InsulinColor = "turuncu" | "gri";

/** DB'den gelen ham satır */
interface ReminderRow {
  id: number;
  label: string;
  category: ReminderCategory;
  insulin_color: InsulinColor | null;
  hour: number;
  minute: number;
  days_of_week: string;       // JSON string: "[1,2,3,4,5]"
  is_active: number;          // 0 | 1
  notification_ids: string | null; // JSON string: '["id1","id2"]'
}

/** Uygulama içinde kullanılan tip */
export interface Reminder {
  id: number;
  label: string;
  category: ReminderCategory;
  insulinColor: InsulinColor | null;
  hour: number;
  minute: number;
  daysOfWeek: number[];       // [1..7], 1=Pzt, 7=Paz
  isActive: boolean;
  notificationIds: string[];  // expo-notifications ID'leri
}

// ─── Dönüşüm ─────────────────────────────────────────────────────────────────

function rowToReminder(row: ReminderRow): Reminder {
  return {
    id: row.id,
    label: row.label,
    category: row.category,
    insulinColor: row.insulin_color,
    hour: row.hour,
    minute: row.minute,
    daysOfWeek: JSON.parse(row.days_of_week) as number[],
    isActive: row.is_active === 1,
    notificationIds: row.notification_ids
      ? (JSON.parse(row.notification_ids) as string[])
      : [],
  };
}

// ─── CRUD ─────────────────────────────────────────────────────────────────────

export async function getAllReminders(): Promise<Reminder[]> {
  const rows = await db.getAllAsync<ReminderRow>(
    `SELECT * FROM reminders ORDER BY hour ASC, minute ASC`
  );
  return rows.map(rowToReminder);
}

export async function insertReminder(params: {
  label: string;
  category: ReminderCategory;
  insulinColor?: InsulinColor;
  hour: number;
  minute: number;
  daysOfWeek: number[];
  notificationIds?: string[];
}): Promise<number> {
  const result = await db.runAsync(
    `INSERT INTO reminders
       (label, category, insulin_color, hour, minute, days_of_week, is_active, notification_ids)
     VALUES (?, ?, ?, ?, ?, ?, 1, ?)`,
    [
      params.label,
      params.category,
      params.insulinColor ?? null,
      params.hour,
      params.minute,
      JSON.stringify(params.daysOfWeek),
      params.notificationIds ? JSON.stringify(params.notificationIds) : null,
    ]
  );
  return result.lastInsertRowId;
}

export async function updateReminder(params: {
  id: number;
  label: string;
  category: ReminderCategory;
  insulinColor?: InsulinColor;
  hour: number;
  minute: number;
  daysOfWeek: number[];
  notificationIds?: string[];
}): Promise<void> {
  await db.runAsync(
    `UPDATE reminders SET
       label = ?, category = ?, insulin_color = ?,
       hour = ?, minute = ?, days_of_week = ?, notification_ids = ?
     WHERE id = ?`,
    [
      params.label,
      params.category,
      params.insulinColor ?? null,
      params.hour,
      params.minute,
      JSON.stringify(params.daysOfWeek),
      params.notificationIds ? JSON.stringify(params.notificationIds) : null,
      params.id,
    ]
  );
}

export async function setReminderActive(
  id: number,
  isActive: boolean,
  notificationIds?: string[]
): Promise<void> {
  await db.runAsync(
    `UPDATE reminders SET is_active = ?, notification_ids = ? WHERE id = ?`,
    [
      isActive ? 1 : 0,
      notificationIds ? JSON.stringify(notificationIds) : null,
      id,
    ]
  );
}

export async function deleteReminder(id: number): Promise<void> {
  await db.runAsync(`DELETE FROM reminders WHERE id = ?`, [id]);
}
