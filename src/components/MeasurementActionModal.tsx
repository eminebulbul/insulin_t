import React, { useState, useEffect } from "react";
import {
  Modal,
  View,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  Platform,
  KeyboardAvoidingView,
} from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { Colors, FontSize, Spacing, Radius } from "@/constants/theme";
import { BigButton } from "@/components/BigButton";
import { AppText } from "@/components/AppText";
import { AppTextInput } from "@/components/AppTextInput";
import {
  GlucoseMeasurement,
  BloodPressureMeasurement,
  WaterEntry,
  MealTag,
  updateMeasurement,
  deleteMeasurement,
  updateWaterEntry,
  deleteWaterEntry,
} from "@/db/firestoreQueries";
import { validateGlucose, validateBloodPressure } from "@/utils/validation";
import { formatTime, formatShortDate, formatMealTag } from "@/utils/dateHelpers";

export type ActionModalItem =
  | { kind: "measurement"; data: GlucoseMeasurement | BloodPressureMeasurement }
  | { kind: "water"; data: WaterEntry };

interface MeasurementActionModalProps {
  visible: boolean;
  item: ActionModalItem | null;
  onClose: () => void;
}

const MEAL_TAGS: { value: MealTag; label: string }[] = [
  { value: "aclik", label: "Açlık" },
  { value: "tokluk", label: "Tokluk" },
  { value: "yatmadan_once", label: "Yatmadan\nÖnce" },
  { value: "diger", label: "Diğer" },
];

export function MeasurementActionModal({
  visible,
  item,
  onClose,
}: MeasurementActionModalProps) {
  const [step, setStep] = useState<"actions" | "confirm_delete" | "edit">("actions");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Form State
  const [editDate, setEditDate] = useState<Date>(new Date());
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [fieldError, setFieldError] = useState<string | null>(null);

  // Glucose Form
  const [mealTag, setMealTag] = useState<MealTag>("aclik");
  const [glucoseVal, setGlucoseVal] = useState("");
  const [glucoseNote, setGlucoseNote] = useState("");

  // Blood Pressure Form
  const [bpSystolic, setBpSystolic] = useState("");
  const [bpDiastolic, setBpDiastolic] = useState("");
  const [bpNote, setBpNote] = useState("");

  // Water Form
  const [waterVal, setWaterVal] = useState("");

  // Modal açıldığında state'leri doldur
  useEffect(() => {
    if (!item) return;

    setStep("actions");
    setFieldError(null);
    const parsedDate = new Date(item.data.recorded_at);
    setEditDate(isNaN(parsedDate.getTime()) ? new Date() : parsedDate);

    if (item.kind === "water") {
      setWaterVal(item.data.water_ml.toString());
    } else if (item.data.type === "glucose") {
      const g = item.data as GlucoseMeasurement;
      setMealTag(g.meal_tag || "aclik");
      setGlucoseVal(g.glucose_mg?.toString() || "");
      setGlucoseNote(g.glucose_note || "");
    } else {
      const bp = item.data as BloodPressureMeasurement;
      setBpSystolic(bp.bp_systolic?.toString() || "");
      setBpDiastolic(bp.bp_diastolic?.toString() || "");
      setBpNote(bp.bp_note || "");
    }
  }, [item, visible]);

  if (!item) return null;

  // ─── Silme İşlemi ──────────────────────────────────────────────────────────
  const handleDelete = async () => {
    setDeleting(true);
    try {
      if (item.kind === "water") {
        await deleteWaterEntry(item.data.id);
      } else {
        await deleteMeasurement(item.data.id);
      }
      onClose();
      Alert.alert("✓ Silindi", "Kayıt başarıyla silindi.");
    } catch (err) {
      console.error(err);
      Alert.alert("Hata", "Kayıt silinirken bir sorun oluştu.");
    } finally {
      setDeleting(false);
    }
  };

  // ─── Kaydetme İşlemi (created_at KESİNLİKLE DOKUNULMAZ) ─────────────────────
  const handleSave = async () => {
    setFieldError(null);
    const isoString = editDate.toISOString();

    if (item.kind === "water") {
      const trimmed = waterVal.trim();
      const val = Number(trimmed);
      if (!trimmed || !Number.isFinite(val) || val <= 0 || !Number.isInteger(val)) {
        setFieldError("Geçerli bir su miktarı girin (örn: 200).");
        return;
      }
      if (val > 5000) {
        setFieldError("5000 ml'den fazla girilemez.");
        return;
      }

      setSaving(true);
      try {
        await updateWaterEntry({
          id: item.data.id,
          recordedAt: isoString,
          waterMl: val,
        });
        onClose();
        Alert.alert("✓ Güncellendi", "Su kaydı güncellendi.");
      } catch (err) {
        console.error(err);
        Alert.alert("Hata", "Güncelleme sırasında bir sorun oluştu.");
      } finally {
        setSaving(false);
      }
      return;
    }

    if (item.data.type === "glucose") {
      const res = validateGlucose(glucoseVal);
      if (res.status === "hard_error") {
        setFieldError(res.message);
        return;
      }

      const doUpdateGlucose = async () => {
        setSaving(true);
        try {
          await updateMeasurement(item.data.id, {
            type: "glucose",
            recordedAt: isoString,
            mealTag,
            glucoseMg: Number(glucoseVal.trim()),
            glucoseNote: glucoseNote.trim() || null,
          });
          onClose();
          Alert.alert("✓ Güncellendi", "Şeker ölçümü güncellendi.");
        } catch (err) {
          console.error(err);
          Alert.alert("Hata", "Güncelleme sırasında bir sorun oluştu.");
        } finally {
          setSaving(false);
        }
      };

      if (res.status === "range_warning") {
        Alert.alert(
          "Olağandışı Değer",
          res.message,
          [
            { text: "Hayır, düzelt", style: "cancel" },
            { text: "Evet, güncelle", onPress: doUpdateGlucose },
          ],
          { cancelable: true }
        );
        return;
      }

      await doUpdateGlucose();
      return;
    }

    // Tansiyon
    if (item.data.type === "blood_pressure") {
      const res = validateBloodPressure(bpSystolic, bpDiastolic);
      if (res.status === "hard_error") {
        setFieldError(res.message);
        return;
      }

      const doUpdateBp = async () => {
        setSaving(true);
        try {
          await updateMeasurement(item.data.id, {
            type: "blood_pressure",
            recordedAt: isoString,
            bpSystolic: Number(bpSystolic.trim()),
            bpDiastolic: Number(bpDiastolic.trim()),
            bpNote: bpNote.trim() || null,
          });
          onClose();
          Alert.alert("✓ Güncellendi", "Tansiyon ölçümü güncellendi.");
        } catch (err) {
          console.error(err);
          Alert.alert("Hata", "Güncelleme sırasında bir sorun oluştu.");
        } finally {
          setSaving(false);
        }
      };

      if (res.status === "range_warning") {
        Alert.alert(
          "Olağandışı Değer",
          res.message,
          [
            { text: "Hayır, düzelt", style: "cancel" },
            { text: "Evet, güncelle", onPress: doUpdateBp },
          ],
          { cancelable: true }
        );
        return;
      }

      await doUpdateBp();
    }
  };

  // ─── Özet Bilgi Başlığı ───────────────────────────────────────────────────
  const getItemSummary = () => {
    const timeStr = formatTime(item.data.recorded_at);
    const dateStr = formatShortDate(item.data.recorded_at);

    if (item.kind === "water") {
      return {
        icon: "💧",
        title: "Su Kaydı",
        value: `${item.data.water_ml} ml`,
        time: `${dateStr} Saat ${timeStr}`,
        sub: null,
      };
    }
    if (item.data.type === "glucose") {
      const g = item.data as GlucoseMeasurement;
      return {
        icon: "🩸",
        title: "Şeker Ölçümü",
        value: `${g.glucose_mg} mg/dL`,
        time: `${dateStr} Saat ${timeStr}`,
        sub: formatMealTag(g.meal_tag),
      };
    }
    const bp = item.data as BloodPressureMeasurement;
    return {
      icon: "💊",
      title: "Tansiyon Ölçümü",
      value: `${bp.bp_systolic}/${bp.bp_diastolic} mmHg`,
      time: `${dateStr} Saat ${timeStr}`,
      sub: null,
    };
  };

  const summary = getItemSummary();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.overlay}
      >
        <TouchableOpacity
          style={styles.backdrop}
          activeOpacity={1}
          onPress={onClose}
        />

        <View style={styles.sheetContainer}>
          {/* Adım 1: Aksiyon Seçimi */}
          {step === "actions" && (
            <View>
              <View style={styles.header}>
                <AppText style={styles.headerIcon}>{summary.icon}</AppText>
                <View style={{ flex: 1 }}>
                  <AppText style={styles.headerTitle}>{summary.title}</AppText>
                  <AppText style={styles.headerTime}>{summary.time}</AppText>
                </View>
              </View>

              <View style={styles.summaryBox}>
                <AppText style={styles.summaryValue}>{summary.value}</AppText>
                {summary.sub && <AppText style={styles.summarySub}>{summary.sub}</AppText>}
              </View>

              <View style={styles.buttonGroup}>
                <BigButton
                  title="✏️ Düzenle"
                  variant="primary"
                  onPress={() => setStep("edit")}
                  style={styles.actionBtn}
                />
                <BigButton
                  title="🗑️ Kaydı Sil"
                  variant="danger"
                  onPress={() => setStep("confirm_delete")}
                  style={styles.actionBtn}
                />
                <BigButton
                  title="Vazgeç"
                  variant="secondary"
                  onPress={onClose}
                  style={styles.cancelBtn}
                />
              </View>
            </View>
          )}

          {/* Adım 2: Silme Onayı (Yaşlı dostu, net) */}
          {step === "confirm_delete" && (
            <View style={styles.confirmBox}>
              <AppText style={styles.warningIcon}>⚠️</AppText>
              <AppText style={styles.confirmTitle}>Bu Kayıt Silinsin mi?</AppText>
              <AppText style={styles.confirmDesc}>
                {summary.value} ({summary.time}) kaydı kalıcı olarak silinecek. Bu işlem geri alınamaz.
              </AppText>

              <View style={styles.buttonGroup}>
                <BigButton
                  title="Evet, Sil"
                  variant="danger"
                  loading={deleting}
                  onPress={handleDelete}
                  style={styles.actionBtn}
                />
                <BigButton
                  title="Vazgeç"
                  variant="secondary"
                  disabled={deleting}
                  onPress={() => setStep("actions")}
                  style={styles.cancelBtn}
                />
              </View>
            </View>
          )}

          {/* Adım 3: Düzenleme Formu */}
          {step === "edit" && (
            <ScrollView
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={{ paddingBottom: Spacing.xl }}
            >
              <View style={styles.editHeader}>
                <AppText style={styles.headerTitle}>
                  {summary.icon} {summary.title} Düzenle
                </AppText>
              </View>

              {/* Saat Seçimi Butonu */}
              <AppText style={styles.inputLabel}>Ölçüm Saati</AppText>
              <TouchableOpacity
                style={styles.timePickerButton}
                onPress={() => setShowTimePicker(true)}
                activeOpacity={0.75}
              >
                <AppText style={styles.clockIcon}>🕐</AppText>
                <AppText style={styles.timeText}>
                  {formatTime(editDate.toISOString())} ({formatShortDate(editDate.toISOString())})
                </AppText>
                <AppText style={styles.changeTimeText}>Değiştir</AppText>
              </TouchableOpacity>

              {showTimePicker && (
                <DateTimePicker
                  value={editDate}
                  mode="time"
                  is24Hour={true}
                  display="spinner"
                  themeVariant="dark"
                  positiveButton={{ label: "Tamam", textColor: Colors.primary }}
                  negativeButton={{ label: "İptal", textColor: Colors.textSecondary }}
                  onChange={(event, selectedDate) => {
                    if (Platform.OS === "android") setShowTimePicker(false);
                    if (event.type === "dismissed") {
                      setShowTimePicker(false);
                      return;
                    }
                    if (selectedDate) {
                      setEditDate(selectedDate);
                      if (Platform.OS === "ios") setShowTimePicker(false);
                    }
                  }}
                />
              )}

              {/* Şeker Alanları */}
              {item.kind === "measurement" && item.data.type === "glucose" && (
                <>
                  <AppText style={styles.inputLabel}>Öğün Durumu</AppText>
                  <View style={styles.tagGrid}>
                    {MEAL_TAGS.map((tag) => {
                      const selected = mealTag === tag.value;
                      return (
                        <TouchableOpacity
                          key={tag.value}
                          style={[
                            styles.tagBtn,
                            selected && styles.tagBtnSelected,
                          ]}
                          onPress={() => setMealTag(tag.value)}
                        >
                          <AppText
                            style={[
                              styles.tagBtnText,
                              selected && styles.tagBtnTextSelected,
                            ]}
                          >
                            {tag.label}
                          </AppText>
                        </TouchableOpacity>
                      );
                    })}
                  </View>

                  <AppText style={styles.inputLabel}>Şeker Değeri (mg/dL)</AppText>
                  <AppTextInput
                    style={styles.largeInput}
                    value={glucoseVal}
                    onChangeText={setGlucoseVal}
                    keyboardType="number-pad"
                    maxLength={3}
                    placeholder="120"
                    placeholderTextColor={Colors.textDisabled}
                  />

                  <AppText style={styles.inputLabel}>Not (isteğe bağlı)</AppText>
                  <AppTextInput
                    style={styles.noteInput}
                    value={glucoseNote}
                    onChangeText={setGlucoseNote}
                    placeholder="Örn: Yemekten 2 saat sonra"
                    placeholderTextColor={Colors.textDisabled}
                    multiline
                  />
                </>
              )}

              {/* Tansiyon Alanları */}
              {item.kind === "measurement" && item.data.type === "blood_pressure" && (
                <>
                  <AppText style={styles.inputLabel}>Tansiyon Değerleri (mmHg)</AppText>
                  <View style={styles.bpRow}>
                    <View style={{ flex: 1 }}>
                      <AppText style={styles.bpSubLabel}>Büyük (Sistolik)</AppText>
                      <AppTextInput
                        style={styles.largeInput}
                        value={bpSystolic}
                        onChangeText={setBpSystolic}
                        keyboardType="number-pad"
                        maxLength={3}
                        placeholder="120"
                        placeholderTextColor={Colors.textDisabled}
                      />
                    </View>
                    <AppText style={styles.bpSlash}>/</AppText>
                    <View style={{ flex: 1 }}>
                      <AppText style={styles.bpSubLabel}>Küçük (Diyastolik)</AppText>
                      <AppTextInput
                        style={styles.largeInput}
                        value={bpDiastolic}
                        onChangeText={setBpDiastolic}
                        keyboardType="number-pad"
                        maxLength={3}
                        placeholder="80"
                        placeholderTextColor={Colors.textDisabled}
                      />
                    </View>
                  </View>

                  <AppText style={styles.inputLabel}>Not (isteğe bağlı)</AppText>
                  <AppTextInput
                    style={styles.noteInput}
                    value={bpNote}
                    onChangeText={setBpNote}
                    placeholder="Örn: Dinlendikten sonra"
                    placeholderTextColor={Colors.textDisabled}
                    multiline
                  />
                </>
              )}

              {/* Su Alanı */}
              {item.kind === "water" && (
                <>
                  <AppText style={styles.inputLabel}>Su Miktarı (ml)</AppText>
                  <AppTextInput
                    style={styles.largeInput}
                    value={waterVal}
                    onChangeText={setWaterVal}
                    keyboardType="number-pad"
                    maxLength={4}
                    placeholder="200"
                    placeholderTextColor={Colors.textDisabled}
                  />
                </>
              )}

              {/* Hata Metni */}
              {fieldError && <AppText style={styles.errorText}>{fieldError}</AppText>}


              {/* Kaydet / İptal Butonları */}
              <View style={[styles.buttonGroup, { marginTop: Spacing.lg }]}>
                <BigButton
                  title="Değişiklikleri Kaydet"
                  variant="primary"
                  loading={saving}
                  onPress={handleSave}
                  style={styles.actionBtn}
                />
                <BigButton
                  title="İptal"
                  variant="secondary"
                  disabled={saving}
                  onPress={() => setStep("actions")}
                  style={styles.cancelBtn}
                />
              </View>
            </ScrollView>
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.65)",
    justifyContent: "flex-end",
  },
  backdrop: {
    flex: 1,
  },
  sheetContainer: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    padding: Spacing.xl,
    paddingBottom: Platform.OS === "ios" ? 40 : Spacing.xl,
    borderWidth: 1,
    borderColor: Colors.border,
    maxHeight: "85%",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    marginBottom: Spacing.md,
  },
  headerIcon: {
    fontSize: 32,
  },
  headerTitle: {
    fontSize: FontSize.xl,
    fontWeight: "700",
    color: Colors.textPrimary,
  },
  headerTime: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  summaryBox: {
    backgroundColor: Colors.surfaceAlt,
    borderRadius: Radius.md,
    padding: Spacing.lg,
    alignItems: "center",
    marginBottom: Spacing.xl,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  summaryValue: {
    fontSize: FontSize.xxl,
    fontWeight: "800",
    color: Colors.textPrimary,
  },
  summarySub: {
    fontSize: FontSize.md,
    color: Colors.textSecondary,
    marginTop: Spacing.xs,
    fontWeight: "500",
  },
  buttonGroup: {
    gap: Spacing.md,
  },
  actionBtn: {
    height: 60,
  },
  cancelBtn: {
    height: 54,
  },
  confirmBox: {
    alignItems: "center",
    paddingVertical: Spacing.md,
  },
  warningIcon: {
    fontSize: 48,
    marginBottom: Spacing.sm,
  },
  confirmTitle: {
    fontSize: FontSize.xl,
    fontWeight: "700",
    color: Colors.textPrimary,
    marginBottom: Spacing.sm,
    textAlign: "center",
  },
  confirmDesc: {
    fontSize: FontSize.md,
    color: Colors.textSecondary,
    textAlign: "center",
    marginBottom: Spacing.xl,
    lineHeight: 24,
  },
  editHeader: {
    marginBottom: Spacing.lg,
  },
  inputLabel: {
    fontSize: FontSize.md,
    fontWeight: "600",
    color: Colors.textSecondary,
    marginBottom: Spacing.xs,
    marginTop: Spacing.sm,
  },
  timePickerButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.surfaceAlt,
    borderRadius: Radius.sm,
    padding: Spacing.md,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  clockIcon: {
    fontSize: 22,
    marginRight: Spacing.sm,
  },
  timeText: {
    flex: 1,
    fontSize: FontSize.md,
    fontWeight: "700",
    color: Colors.textPrimary,
  },
  changeTimeText: {
    fontSize: FontSize.sm,
    fontWeight: "600",
    color: Colors.primary,
  },
  tagGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  tagBtn: {
    flex: 1,
    minWidth: "45%",
    height: 52,
    borderRadius: Radius.sm,
    backgroundColor: Colors.tagUnselected,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: Colors.border,
  },
  tagBtnSelected: {
    backgroundColor: Colors.tagSelected,
    borderColor: Colors.primary,
  },
  tagBtnText: {
    fontSize: FontSize.sm,
    fontWeight: "600",
    color: Colors.tagUnselectedText,
    textAlign: "center",
  },
  tagBtnTextSelected: {
    color: Colors.tagSelectedText,
  },
  largeInput: {
    height: 64,
    backgroundColor: Colors.surfaceAlt,
    borderRadius: Radius.sm,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: Spacing.lg,
    fontSize: FontSize.xxl,
    color: Colors.textPrimary,
    fontWeight: "700",
    textAlign: "center",
    marginBottom: Spacing.md,
  },
  bpRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    marginBottom: Spacing.xs,
  },
  bpSubLabel: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    marginBottom: 4,
    textAlign: "center",
  },
  bpSlash: {
    fontSize: 32,
    color: Colors.textSecondary,
    fontWeight: "300",
    paddingTop: 16,
  },
  noteInput: {
    backgroundColor: Colors.surfaceAlt,
    borderRadius: Radius.sm,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.md,
    fontSize: FontSize.md,
    color: Colors.textPrimary,
    minHeight: 50,
    marginBottom: Spacing.md,
  },
  errorText: {
    fontSize: FontSize.sm,
    color: Colors.danger,
    marginBottom: Spacing.md,
    lineHeight: 20,
  },
});
