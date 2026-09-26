import React, { useState, useCallback, useEffect } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  Alert,
  Modal,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Linking,
} from "react-native";
import { useFocusEffect } from "expo-router";

import { Colors, FontSize, Spacing, Radius } from "@/constants/theme";
import { BigButton } from "@/components/BigButton";
import { AppText } from "@/components/AppText";
import { AppTextInput } from "@/components/AppTextInput";
import {
  Reminder,
  ReminderCategory,
  InsulinColor,
  insertReminder,
  updateReminder,
  deleteReminder,
  setReminderActive,
  subscribeToReminders,
} from "@/db/firestoreQueries";
import {
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
      <AppText style={bannerStyles.icon}>{isExact ? "⏰" : "🔕"}</AppText>
      <View style={{ flex: 1 }}>
        <AppText style={bannerStyles.title}>
          {isExact
            ? "Kesin zamanlı hatırlatma için izin gerekli"
            : "Bildirimler kapalı"}
        </AppText>
        <AppText style={bannerStyles.desc}>
          {isExact
            ? "Android 12+ için kesin alarm izni Ayarlar'dan açılmalı."
            : "Hatırlatmaların çalışması için bildirim iznine ihtiyaç var."}
        </AppText>
        <TouchableOpacity
          style={bannerStyles.btn}
          onPress={openNotificationSettings}
          activeOpacity={0.75}
        >
          <AppText style={bannerStyles.btnText}>Ayarları Aç</AppText>
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
      <AppText style={rowStyles.icon}>{icon}</AppText>
      <View style={{ flex: 1, paddingRight: Spacing.xs }}>
        <AppText style={rowStyles.label} numberOfLines={2}>
          {item.label}
        </AppText>
        <AppText style={rowStyles.meta}>
          {hourStr}:{minStr} · {dayLabel}
        </AppText>
      </View>
      <View style={rowStyles.actions}>
        <TouchableOpacity
          onPress={() => onEdit(item)}
          style={rowStyles.editBtn}
          accessibilityLabel={`${item.label} düzenle`}
        >
          <AppText style={rowStyles.editIcon}>✏️</AppText>
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
          <AppText style={rowStyles.deleteIcon}>🗑</AppText>
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
        await updateReminder({
          id: editingReminder.id,
          label: form.label.trim(),
          category: form.category,
          insulinColor: form.insulinColor,
          hour,
          minute,
          daysOfWeek: form.daysOfWeek,
        });
      } else {
        await insertReminder({
          label: form.label.trim(),
          category: form.category,
          insulinColor: form.insulinColor,
          hour,
          minute,
          daysOfWeek: form.daysOfWeek,
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
            <AppText style={formStyles.cancelText}>İptal</AppText>
          </TouchableOpacity>
          <AppText style={formStyles.title}>
            {editingReminder ? "Düzenle" : "Yeni Hatırlatma"}
          </AppText>
          <View style={{ width: 56 }} />
        </View>

        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={formStyles.content}
          keyboardShouldPersistTaps="handled"
        >
          {/* Kategori */}
          <AppText style={formStyles.sectionLabel}>Kategori</AppText>
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
                <AppText style={formStyles.segmentIcon}>
                  {cat === "measurement" ? "🩸" : "💉"}
                </AppText>
                <AppText
                  style={[
                    formStyles.segmentText,
                    form.category === cat && formStyles.segmentTextActive,
                  ]}
                >
                  {cat === "measurement" ? "Ölçüm" : "İnsülin"}
                </AppText>
              </TouchableOpacity>
            ))}
          </View>

          {/* İnsülin rengi (sadece insulin seçiliyse) */}
          {form.category === "insulin" && (
            <>
              <AppText style={formStyles.sectionLabel}>
                İnsülin Rengi{" "}
                <AppText style={{ color: Colors.danger }}>*</AppText>
              </AppText>
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
                    <AppText style={{ fontSize: 28 }}>
                      {color === "turuncu" ? "🟠" : "⚫"}
                    </AppText>
                    <AppText
                      style={[
                        formStyles.segmentText,
                        form.insulinColor === color &&
                          formStyles.segmentTextActive,
                      ]}
                    >
                      {color === "turuncu" ? "Turuncu" : "Gri"}
                    </AppText>
                  </TouchableOpacity>
                ))}
              </View>
              {errors.insulinColor && (
                <AppText style={formStyles.errorText}>{errors.insulinColor}</AppText>
              )}
            </>
          )}

          {/* Etiket */}
          <AppText style={formStyles.sectionLabel}>Etiket</AppText>
          <AppTextInput
            style={[formStyles.input, errors.label ? formStyles.inputError : {}]}
            value={form.label}
            onChangeText={(t) => setField("label", t)}
            placeholder="Örn: Sabah insülini"
            placeholderTextColor={Colors.textDisabled}
            maxLength={60}
            returnKeyType="done"
          />
          {errors.label && (
            <AppText style={formStyles.errorText}>{errors.label}</AppText>
          )}

          {/* Saat */}
          <AppText style={formStyles.sectionLabel}>Saat</AppText>
          <View style={formStyles.timeRow}>
            <AppTextInput
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
            <AppText style={formStyles.timeSep}>:</AppText>
            <AppTextInput
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
            <AppText style={formStyles.errorText}>{errors.time}</AppText>
          )}

          {/* Günler */}
          <AppText style={formStyles.sectionLabel}>Günler</AppText>
          <TouchableOpacity
            style={[
              formStyles.everyDayBtn,
              isEveryDay && formStyles.everyDayBtnActive,
            ]}
            onPress={toggleAllDays}
            activeOpacity={0.75}
          >
            <AppText
              style={[
                formStyles.everyDayText,
                isEveryDay && formStyles.everyDayTextActive,
              ]}
            >
              Her Gün
            </AppText>
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
                  <AppText
                    style={[
                      formStyles.dayBtnText,
                      selected && formStyles.dayBtnTextActive,
                    ]}
                  >
                    {TR_DAYS[day - 1]}
                  </AppText>
                </TouchableOpacity>
              );
            })}
          </View>
          {errors.daysOfWeek && (
            <AppText style={formStyles.errorText}>{errors.daysOfWeek}</AppText>
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

  const checkPermissions = useCallback(async () => {
    const result = await requestNotificationPermission();
    setPermState(result.state === "granted" ? "granted" : "denied");
  }, []);

  useFocusEffect(
    useCallback(() => {
      checkPermissions();
    }, [checkPermissions])
  );

  // Canlı abonelik (Firestore onSnapshot)
  useEffect(() => {
    const unsubscribe = subscribeToReminders((list) => {
      setReminders(list);
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  const handleToggle = useCallback(
    async (reminder: Reminder, isActive: boolean) => {
      try {
        await setReminderActive(reminder.id, isActive);
      } catch (err) {
        console.error("Toggle hatası:", err);
        Alert.alert("Hata", "Hatırlatma güncellenemedi.");
      }
    },
    []
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
                await deleteReminder(reminder.id);
              } catch (err) {
                Alert.alert("Hata", "Silme işlemi başarısız.");
              }
            },
          },
        ]
      );
    },
    []
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
    // onSnapshot otomatik günceller
  }, []);

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
            <AppText style={styles.emptyIcon}>🔔</AppText>
            <AppText style={styles.emptyTitle}>Hatırlatma yok</AppText>
            <AppText style={styles.emptyHint}>
              Sağ alttaki ➕ butonuna basarak yeni hatırlatma ekleyin.
            </AppText>
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
        <AppText style={styles.fabIcon}>➕</AppText>
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
