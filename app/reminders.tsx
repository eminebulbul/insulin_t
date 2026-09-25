import React, { useState, useCallback, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  Alert,
  Modal,
  TextInput,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Linking,
} from "react-native";
import { useFocusEffect } from "expo-router";

import { Colors, FontSize, Spacing, Radius } from "@/constants/theme";
import { BigButton } from "@/components/BigButton";
import {
  Reminder,
  ReminderCategory,
  InsulinColor,
  getAllReminders,
  insertReminder,
  updateReminder,
  deleteReminder,
  setReminderActive,
} from "@/db/reminderQueries";
import {
  scheduleReminderNotifications,
  cancelReminderNotifications,
  requestNotificationPermission,
  openNotificationSettings,
  logDayConversionTable,
} from "@/utils/notifications";

// ─── Sabitler ─────────────────────────────────────────────────────────────────

const TR_DAYS = ["Pzt", "Sal", "Çar", "Per", "Cum", "Cmt", "Paz"] as const;
const ALL_DAYS = [1, 2, 3, 4, 5, 6, 7];

// ─── İzin Banner ─────────────────────────────────────────────────────────────

function PermissionBanner({
  type,
}: {
  type: "notification" | "exact_alarm";
}) {
  const isExact = type === "exact_alarm";
  return (
    <View style={bannerStyles.container}>
      <Text style={bannerStyles.icon}>{isExact ? "⏰" : "🔕"}</Text>
      <View style={{ flex: 1 }}>
        <Text style={bannerStyles.title}>
          {isExact
            ? "Kesin zamanlı hatırlatma için izin gerekli"
            : "Bildirimler kapalı"}
        </Text>
        <Text style={bannerStyles.desc}>
          {isExact
            ? "Android 12+ için kesin alarm izni Ayarlar'dan açılmalı."
            : "Hatırlatmaların çalışması için bildirim iznine ihtiyaç var."}
        </Text>
        <TouchableOpacity
          style={bannerStyles.btn}
          onPress={openNotificationSettings}
          activeOpacity={0.75}
        >
          <Text style={bannerStyles.btnText}>Ayarları Aç</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const bannerStyles = StyleSheet.create({
  container: {
    flexDirection: "row",
    backgroundColor: "#2D1B00",
    borderRadius: Radius.md,
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
    borderWidth: 1,
    borderColor: "#F59E0B",
    gap: Spacing.md,
    alignItems: "flex-start",
  },
  icon: { fontSize: 28, marginTop: 2 },
  title: {
    fontSize: FontSize.md,
    fontWeight: "700",
    color: "#F59E0B",
    marginBottom: 4,
  },
  desc: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    lineHeight: 20,
    marginBottom: Spacing.md,
  },
  btn: {
    alignSelf: "flex-start",
    backgroundColor: "#F59E0B",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.sm,
  },
  btnText: { fontSize: FontSize.sm, fontWeight: "700", color: "#000" },
});

// ─── Hatırlatma satırı ────────────────────────────────────────────────────────

interface ReminderRowProps {
  item: Reminder;
  onToggle: (r: Reminder, val: boolean) => void;
  onEdit: (r: Reminder) => void;
  onDelete: (r: Reminder) => void;
}

function ReminderRow({ item, onToggle, onEdit, onDelete }: ReminderRowProps) {
  const icon =
    item.category === "insulin"
      ? item.insulinColor === "turuncu"
        ? "🟠"
        : "⚫"
      : "🩸";

  const hourStr = String(item.hour).padStart(2, "0");
  const minStr = String(item.minute).padStart(2, "0");

  const isEveryDay = item.daysOfWeek.length === 7;
  const dayLabel = isEveryDay
    ? "Her gün"
    : item.daysOfWeek.map((d) => TR_DAYS[d - 1]).join(" ");

  return (
    <View style={rowStyles.card}>
      <Text style={rowStyles.icon}>{icon}</Text>
      <View style={{ flex: 1 }}>
        <Text style={rowStyles.label} numberOfLines={1}>
          {item.label}
        </Text>
        <Text style={rowStyles.meta}>
          {hourStr}:{minStr} · {dayLabel}
        </Text>
      </View>
      <View style={rowStyles.actions}>
        <TouchableOpacity
          onPress={() => onEdit(item)}
          style={rowStyles.editBtn}
          accessibilityLabel={`${item.label} düzenle`}
        >
          <Text style={rowStyles.editIcon}>✏️</Text>
        </TouchableOpacity>
        <Switch
          value={item.isActive}
          onValueChange={(val) => onToggle(item, val)}
          trackColor={{ false: Colors.border, true: Colors.primary }}
          thumbColor="#fff"
          accessibilityLabel={`${item.label} ${item.isActive ? "devre dışı bırak" : "etkinleştir"}`}
        />
        <TouchableOpacity
          onPress={() => onDelete(item)}
          style={rowStyles.deleteBtn}
          accessibilityLabel={`${item.label} sil`}
        >
          <Text style={rowStyles.deleteIcon}>🗑</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const rowStyles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: Spacing.md,
  },
  icon: { fontSize: 28, width: 36, textAlign: "center" },
  label: {
    fontSize: FontSize.lg,
    fontWeight: "700",
    color: Colors.textPrimary,
  },
  meta: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  actions: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  editBtn: { padding: 6 },
  editIcon: { fontSize: 18 },
  deleteBtn: { padding: 6 },
  deleteIcon: { fontSize: 18 },
});

// ─── Form — Yeni / Düzenle ────────────────────────────────────────────────────

interface ReminderFormData {
  label: string;
  category: ReminderCategory;
  insulinColor: InsulinColor | null;
  hour: string;       // boş string ile başlar
  minute: string;
  daysOfWeek: number[];
}

const EMPTY_FORM: ReminderFormData = {
  label: "",
  category: "measurement",
  insulinColor: null,
  hour: "",
  minute: "",
  daysOfWeek: ALL_DAYS,
};

interface ReminderFormProps {
  visible: boolean;
  editingReminder: Reminder | null;
  onClose: () => void;
  onSaved: () => void;
}

function ReminderForm({
  visible,
  editingReminder,
  onClose,
  onSaved,
}: ReminderFormProps) {
  const [form, setForm] = useState<ReminderFormData>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<keyof ReminderFormData | "time", string>>>({});

  // Form edit modunda açılırken mevcut değerlerle doldur
  useEffect(() => {
    if (visible) {
      if (editingReminder) {
        setForm({
          label: editingReminder.label,
          category: editingReminder.category,
          insulinColor: editingReminder.insulinColor,
          hour: String(editingReminder.hour),
          minute: String(editingReminder.minute).padStart(2, "0"),
          daysOfWeek: [...editingReminder.daysOfWeek],
        });
      } else {
        setForm(EMPTY_FORM);
      }
      setErrors({});
    }
  }, [visible, editingReminder]);

  const setField = <K extends keyof ReminderFormData>(
    key: K,
    value: ReminderFormData[K]
  ) => {
    setForm((f) => ({ ...f, [key]: value }));
    setErrors((e) => ({ ...e, [key]: undefined }));
  };

  const toggleDay = (day: number) => {
    setForm((f) => {
      const current = f.daysOfWeek;
      const next = current.includes(day)
        ? current.filter((d) => d !== day)
        : [...current, day].sort((a, b) => a - b);
      return { ...f, daysOfWeek: next };
    });
  };

  const toggleAllDays = () => {
    setForm((f) => ({
      ...f,
      daysOfWeek:
        f.daysOfWeek.length === 7 ? [] : [...ALL_DAYS],
    }));
  };

  const validate = (): boolean => {
    const newErrors: typeof errors = {};

    if (form.label.trim() === "") {
      newErrors.label = "Etiket boş bırakılamaz.";
    }
    if (form.category === "insulin" && !form.insulinColor) {
      newErrors.insulinColor = "İnsülin rengi seçilmeli.";
    }

    const h = Number(form.hour);
    const m = Number(form.minute);
    if (form.hour.trim() === "" || !Number.isInteger(h) || h < 0 || h > 23) {
      newErrors.time = "Geçerli bir saat girin (0–23).";
    } else if (form.minute.trim() === "" || !Number.isInteger(m) || m < 0 || m > 59) {
      newErrors.time = "Geçerli bir dakika girin (0–59).";
    }

    if (form.daysOfWeek.length === 0) {
      newErrors.daysOfWeek = "En az bir gün seçilmeli.";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;
    setSaving(true);

    try {
      const hour = Number(form.hour);
      const minute = Number(form.minute);

      if (editingReminder) {
        // Eski bildirimleri iptal et
        await cancelReminderNotifications(editingReminder.notificationIds);

        // Yeni bildirimleri planla
        const newIds = editingReminder.isActive
          ? await scheduleReminderNotifications({
              label: form.label.trim(),
              category: form.category,
              insulinColor: form.insulinColor,
              hour,
              minute,
              daysOfWeek: form.daysOfWeek,
            })
          : [];

        await updateReminder({
          id: editingReminder.id,
          label: form.label.trim(),
          category: form.category,
          insulinColor: form.insulinColor ?? undefined,
          hour,
          minute,
          daysOfWeek: form.daysOfWeek,
          notificationIds: newIds,
        });
      } else {
        // Bildirim planla
        const ids = await scheduleReminderNotifications({
          label: form.label.trim(),
          category: form.category,
          insulinColor: form.insulinColor,
          hour,
          minute,
          daysOfWeek: form.daysOfWeek,
        });

        await insertReminder({
          label: form.label.trim(),
          category: form.category,
          insulinColor: form.insulinColor ?? undefined,
          hour,
          minute,
          daysOfWeek: form.daysOfWeek,
          notificationIds: ids,
        });
      }

      onSaved();
      onClose();
    } catch (err) {
      console.error("Hatırlatma kaydedilemedi:", err);
      Alert.alert("Hata", "Hatırlatma kaydedilemedi. Tekrar deneyin.");
    } finally {
      setSaving(false);
    }
  };

  const isEveryDay = form.daysOfWeek.length === 7;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        style={{ flex: 1, backgroundColor: Colors.background }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        {/* Header */}
        <View style={formStyles.header}>
          <TouchableOpacity onPress={onClose} style={formStyles.cancelBtn}>
            <Text style={formStyles.cancelText}>İptal</Text>
          </TouchableOpacity>
          <Text style={formStyles.title}>
            {editingReminder ? "Düzenle" : "Yeni Hatırlatma"}
          </Text>
          <View style={{ width: 56 }} />
        </View>

        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={formStyles.content}
          keyboardShouldPersistTaps="handled"
        >
          {/* Kategori */}
          <Text style={formStyles.sectionLabel}>Kategori</Text>
          <View style={formStyles.segmentRow}>
            {(["measurement", "insulin"] as ReminderCategory[]).map((cat) => (
              <TouchableOpacity
                key={cat}
                style={[
                  formStyles.segment,
                  form.category === cat && formStyles.segmentActive,
                ]}
                onPress={() => {
                  setField("category", cat);
                  if (cat === "measurement") setField("insulinColor", null);
                }}
                activeOpacity={0.75}
              >
                <Text style={formStyles.segmentIcon}>
                  {cat === "measurement" ? "🩸" : "💉"}
                </Text>
                <Text
                  style={[
                    formStyles.segmentText,
                    form.category === cat && formStyles.segmentTextActive,
                  ]}
                >
                  {cat === "measurement" ? "Ölçüm" : "İnsülin"}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* İnsülin rengi (sadece insulin seçiliyse) */}
          {form.category === "insulin" && (
            <>
              <Text style={formStyles.sectionLabel}>
                İnsülin Rengi{" "}
                <Text style={{ color: Colors.danger }}>*</Text>
              </Text>
              <View style={formStyles.segmentRow}>
                {(["turuncu", "gri"] as InsulinColor[]).map((color) => (
                  <TouchableOpacity
                    key={color}
                    style={[
                      formStyles.colorSegment,
                      form.insulinColor === color &&
                        formStyles.colorSegmentActive,
                    ]}
                    onPress={() => setField("insulinColor", color)}
                    activeOpacity={0.75}
                  >
                    <Text style={{ fontSize: 28 }}>
                      {color === "turuncu" ? "🟠" : "⚫"}
                    </Text>
                    <Text
                      style={[
                        formStyles.segmentText,
                        form.insulinColor === color &&
                          formStyles.segmentTextActive,
                      ]}
                    >
                      {color === "turuncu" ? "Turuncu" : "Gri"}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              {errors.insulinColor && (
                <Text style={formStyles.errorText}>{errors.insulinColor}</Text>
              )}
            </>
          )}

          {/* Etiket */}
          <Text style={formStyles.sectionLabel}>Etiket</Text>
          <TextInput
            style={[formStyles.input, errors.label ? formStyles.inputError : {}]}
            value={form.label}
            onChangeText={(t) => setField("label", t)}
            placeholder="Örn: Sabah insülini"
            placeholderTextColor={Colors.textDisabled}
            maxLength={60}
            returnKeyType="done"
          />
          {errors.label && (
            <Text style={formStyles.errorText}>{errors.label}</Text>
          )}

          {/* Saat */}
          <Text style={formStyles.sectionLabel}>Saat</Text>
          <View style={formStyles.timeRow}>
            <TextInput
              style={[
                formStyles.timeInput,
                errors.time ? formStyles.inputError : {},
              ]}
              value={form.hour}
              onChangeText={(t) => setField("hour", t.replace(/\D/g, "").slice(0, 2))}
              placeholder="SS"
              placeholderTextColor={Colors.textDisabled}
              keyboardType="number-pad"
              maxLength={2}
              accessibilityLabel="Saat"
            />
            <Text style={formStyles.timeSep}>:</Text>
            <TextInput
              style={[
                formStyles.timeInput,
                errors.time ? formStyles.inputError : {},
              ]}
              value={form.minute}
              onChangeText={(t) => setField("minute", t.replace(/\D/g, "").slice(0, 2))}
              placeholder="DD"
              placeholderTextColor={Colors.textDisabled}
              keyboardType="number-pad"
              maxLength={2}
              accessibilityLabel="Dakika"
            />
          </View>
          {errors.time && (
            <Text style={formStyles.errorText}>{errors.time}</Text>
          )}

          {/* Günler */}
          <Text style={formStyles.sectionLabel}>Günler</Text>
          <TouchableOpacity
            style={[
              formStyles.everyDayBtn,
              isEveryDay && formStyles.everyDayBtnActive,
            ]}
            onPress={toggleAllDays}
            activeOpacity={0.75}
          >
            <Text
              style={[
                formStyles.everyDayText,
                isEveryDay && formStyles.everyDayTextActive,
              ]}
            >
              Her Gün
            </Text>
          </TouchableOpacity>

          <View style={formStyles.daysRow}>
            {ALL_DAYS.map((day) => {
              const selected = form.daysOfWeek.includes(day);
              return (
                <TouchableOpacity
                  key={day}
                  style={[
                    formStyles.dayBtn,
                    selected && formStyles.dayBtnActive,
                  ]}
                  onPress={() => toggleDay(day)}
                  activeOpacity={0.75}
                  accessibilityLabel={`${TR_DAYS[day - 1]} ${selected ? "seçili" : "seçili değil"}`}
                >
                  <Text
                    style={[
                      formStyles.dayBtnText,
                      selected && formStyles.dayBtnTextActive,
                    ]}
                  >
                    {TR_DAYS[day - 1]}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
          {errors.daysOfWeek && (
            <Text style={formStyles.errorText}>{errors.daysOfWeek}</Text>
          )}

          <BigButton
            title={editingReminder ? "Güncelle" : "Kaydet"}
            onPress={handleSave}
            loading={saving}
            disabled={saving}
            style={{ marginTop: Spacing.xl }}
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const formStyles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.xl,
    paddingBottom: Spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  cancelBtn: { padding: 4, minWidth: 56 },
  cancelText: {
    fontSize: FontSize.md,
    color: Colors.primary,
    fontWeight: "600",
  },
  title: {
    fontSize: FontSize.lg,
    fontWeight: "700",
    color: Colors.textPrimary,
  },
  content: {
    padding: Spacing.xl,
    paddingBottom: 80,
  },
  sectionLabel: {
    fontSize: FontSize.sm,
    fontWeight: "700",
    color: Colors.textSecondary,
    marginTop: Spacing.lg,
    marginBottom: Spacing.sm,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  segmentRow: {
    flexDirection: "row",
    gap: Spacing.sm,
  },
  segment: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.sm,
    height: 56,
    borderRadius: Radius.md,
    backgroundColor: Colors.surfaceAlt,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  segmentActive: {
    backgroundColor: Colors.primary + "22",
    borderColor: Colors.primary,
  },
  segmentIcon: { fontSize: 22 },
  segmentText: {
    fontSize: FontSize.md,
    fontWeight: "600",
    color: Colors.textSecondary,
  },
  segmentTextActive: { color: Colors.primary },
  colorSegment: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    height: 80,
    borderRadius: Radius.md,
    backgroundColor: Colors.surfaceAlt,
    borderWidth: 2,
    borderColor: Colors.border,
  },
  colorSegmentActive: {
    backgroundColor: Colors.primary + "22",
    borderColor: Colors.primary,
  },
  input: {
    height: 56,
    backgroundColor: Colors.surfaceAlt,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: Spacing.lg,
    fontSize: FontSize.lg,
    color: Colors.textPrimary,
  },
  inputError: { borderColor: Colors.danger },
  timeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  timeInput: {
    flex: 1,
    height: 72,
    backgroundColor: Colors.surfaceAlt,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    fontSize: 32,
    fontWeight: "700",
    color: Colors.textPrimary,
    textAlign: "center",
  },
  timeSep: {
    fontSize: 32,
    fontWeight: "700",
    color: Colors.textSecondary,
    paddingHorizontal: 4,
  },
  everyDayBtn: {
    height: 48,
    borderRadius: Radius.md,
    backgroundColor: Colors.surfaceAlt,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.sm,
  },
  everyDayBtnActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  everyDayText: {
    fontSize: FontSize.md,
    fontWeight: "700",
    color: Colors.textSecondary,
  },
  everyDayTextActive: { color: "#fff" },
  daysRow: {
    flexDirection: "row",
    gap: 6,
    flexWrap: "nowrap",
  },
  dayBtn: {
    flex: 1,
    height: 48,
    borderRadius: Radius.sm,
    backgroundColor: Colors.surfaceAlt,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  dayBtnActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  dayBtnText: {
    fontSize: 11,
    fontWeight: "700",
    color: Colors.textSecondary,
  },
  dayBtnTextActive: { color: "#fff" },
  errorText: {
    fontSize: FontSize.xs,
    color: Colors.danger,
    marginTop: 4,
  },
});

// ─── Ana Ekran ────────────────────────────────────────────────────────────────

export default function RemindersScreen() {
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [loading, setLoading] = useState(true);
  const [permState, setPermState] = useState<"granted" | "denied" | "checking">("checking");
  const [formVisible, setFormVisible] = useState(false);
  const [editingReminder, setEditingReminder] = useState<Reminder | null>(null);

  // Geliştirici yardımcısı — dönüşüm tablosunu logla
  useEffect(() => {
    logDayConversionTable();
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const all = await getAllReminders();
      setReminders(all);
    } finally {
      setLoading(false);
    }
  }, []);

  const checkPermissions = useCallback(async () => {
    const result = await requestNotificationPermission();
    setPermState(result.state === "granted" ? "granted" : "denied");
  }, []);

  useFocusEffect(
    useCallback(() => {
      checkPermissions();
      load();
    }, [checkPermissions, load])
  );

  const handleToggle = useCallback(
    async (reminder: Reminder, isActive: boolean) => {
      try {
        let newIds: string[] = [];

        if (isActive) {
          // Yeniden planla
          newIds = await scheduleReminderNotifications(reminder);
        } else {
          // İptal et
          await cancelReminderNotifications(reminder.notificationIds);
        }

        await setReminderActive(reminder.id, isActive, newIds);
        await load();
      } catch (err) {
        console.error("Toggle hatası:", err);
        Alert.alert("Hata", "Hatırlatma güncellenemedi.");
      }
    },
    [load]
  );

  const handleDelete = useCallback(
    async (reminder: Reminder) => {
      Alert.alert(
        "Hatırlatmayı Sil",
        `"${reminder.label}" silinsin mi?`,
        [
          { text: "Vazgeç", style: "cancel" },
          {
            text: "Sil",
            style: "destructive",
            onPress: async () => {
              try {
                await cancelReminderNotifications(reminder.notificationIds);
                await deleteReminder(reminder.id);
                await load();
              } catch (err) {
                Alert.alert("Hata", "Silme işlemi başarısız.");
              }
            },
          },
        ]
      );
    },
    [load]
  );

  const handleEdit = useCallback((reminder: Reminder) => {
    setEditingReminder(reminder);
    setFormVisible(true);
  }, []);

  const handleAddNew = useCallback(() => {
    setEditingReminder(null);
    setFormVisible(true);
  }, []);

  const handleFormClose = useCallback(() => {
    setFormVisible(false);
    setEditingReminder(null);
  }, []);

  const handleFormSaved = useCallback(() => {
    load();
  }, [load]);

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* İzin uyarısı */}
        {permState === "denied" && (
          <PermissionBanner type="notification" />
        )}

        {/* Yükleniyor */}
        {loading ? (
          <ActivityIndicator
            color={Colors.primary}
            size="large"
            style={{ marginTop: 60 }}
          />
        ) : reminders.length === 0 ? (
          /* Boş durum */
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyIcon}>🔔</Text>
            <Text style={styles.emptyTitle}>Hatırlatma yok</Text>
            <Text style={styles.emptyHint}>
              Sağ alttaki ➕ butonuna basarak yeni hatırlatma ekleyin.
            </Text>
          </View>
        ) : (
          reminders.map((r) => (
            <ReminderRow
              key={r.id}
              item={r}
              onToggle={handleToggle}
              onEdit={handleEdit}
              onDelete={handleDelete}
            />
          ))
        )}
      </ScrollView>

      {/* FAB */}
      <TouchableOpacity
        style={styles.fab}
        onPress={handleAddNew}
        activeOpacity={0.85}
        accessibilityLabel="Yeni hatırlatma ekle"
      >
        <Text style={styles.fabIcon}>➕</Text>
      </TouchableOpacity>

      {/* Form Modal */}
      <ReminderForm
        visible={formVisible}
        editingReminder={editingReminder}
        onClose={handleFormClose}
        onSaved={handleFormSaved}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  scroll: { flex: 1 },
  content: {
    padding: Spacing.xl,
    paddingBottom: 100, // FAB için boşluk
  },
  emptyContainer: {
    alignItems: "center",
    paddingTop: 80,
  },
  emptyIcon: { fontSize: 64, marginBottom: Spacing.lg },
  emptyTitle: {
    fontSize: FontSize.xl,
    fontWeight: "700",
    color: Colors.textPrimary,
    marginBottom: Spacing.sm,
  },
  emptyHint: {
    fontSize: FontSize.md,
    color: Colors.textSecondary,
    textAlign: "center",
    lineHeight: 26,
    paddingHorizontal: Spacing.xl,
  },
  fab: {
    position: "absolute",
    right: Spacing.xl,
    bottom: 28,
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: Colors.primary,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 8,
  },
  fabIcon: { fontSize: 28 },
});
