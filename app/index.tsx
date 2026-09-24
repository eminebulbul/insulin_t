import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  ScrollView,
  Alert,
  TouchableOpacity,
  Platform,
  KeyboardAvoidingView,
} from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { useFocusEffect } from "expo-router";

import { Colors, FontSize, Spacing, Radius } from "@/constants/theme";
import { BigButton } from "@/components/BigButton";
import { insertGlucose, insertBloodPressure, insertWater, MealTag } from "@/db/queries";
import { validateGlucose, validateBloodPressure } from "@/utils/validation";
import {
  resolveRecordedAt,
  getCurrentHourMinute,
} from "@/utils/timeHelpers";

// ─── Meal tag seçenekleri ─────────────────────────────────────────────────────

const MEAL_TAGS: { value: MealTag; label: string }[] = [
  { value: "aclik", label: "Açlık" },
  { value: "tokluk", label: "Tokluk" },
  { value: "yatmadan_once", label: "Yatmadan\nÖnce" },
  { value: "diger", label: "Diğer" },
];

// ─── TimePickerRow bileşeni ───────────────────────────────────────────────────

interface TimePickerRowProps {
  hour: number;
  minute: number;
  onChangeHour: (h: number) => void;
  onChangeMinute: (m: number) => void;
}

function TimePickerRow({
  hour,
  minute,
  onChangeHour,
  onChangeMinute,
}: TimePickerRowProps) {
  const [showPicker, setShowPicker] = useState(false);

  // resolveRecordedAt ile "dün mü, bugün mü" hesapla
  const { displayLabel, isYesterday } = resolveRecordedAt(hour, minute);

  const pickerDate = new Date();
  pickerDate.setHours(hour, minute, 0, 0);

  return (
    <View style={tpStyles.container}>
      <TouchableOpacity
        style={tpStyles.button}
        onPress={() => setShowPicker(true)}
        activeOpacity={0.75}
        accessibilityLabel={`Ölçüm saatini değiştir, şu an seçili: ${displayLabel}`}
      >
        <Text style={tpStyles.clock}>🕐</Text>
        <View>
          <Text style={tpStyles.label}>{displayLabel}</Text>
          {isYesterday && (
            <Text style={tpStyles.warningText}>
              ⚠ Seçilen saat şu andan ileride — dünün tarihi kullanılacak
            </Text>
          )}
        </View>
        <Text style={tpStyles.chevron}>›</Text>
      </TouchableOpacity>

      {showPicker && (
        <DateTimePicker
          value={pickerDate}
          mode="time"
          is24Hour={true}
          display={Platform.OS === "ios" ? "spinner" : "default"}
          onChange={(event, date) => {
            if (Platform.OS === "android") setShowPicker(false);
            if (event.type === "dismissed") {
              setShowPicker(false);
              return;
            }
            if (date) {
              onChangeHour(date.getHours());
              onChangeMinute(date.getMinutes());
              if (Platform.OS === "ios") setShowPicker(false);
            }
          }}
        />
      )}
    </View>
  );
}

const tpStyles = StyleSheet.create({
  container: { marginBottom: Spacing.md },
  button: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.surfaceAlt,
    borderRadius: Radius.sm,
    padding: Spacing.md,
    gap: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  clock: { fontSize: 22 },
  label: {
    fontSize: FontSize.md,
    color: Colors.textPrimary,
    fontWeight: "600",
  },
  warningText: {
    fontSize: FontSize.xs,
    color: Colors.warning,
    marginTop: 2,
  },
  chevron: {
    fontSize: 24,
    color: Colors.textSecondary,
    marginLeft: "auto",
  },
});

// ─── GlucoseCard bileşeni ─────────────────────────────────────────────────────

interface GlucoseCardProps {
  onSaved: () => void;
}

function GlucoseCard({ onSaved }: GlucoseCardProps) {
  const init = getCurrentHourMinute();
  const [hour, setHour] = useState(init.hour);
  const [minute, setMinute] = useState(init.minute);
  const [mealTag, setMealTag] = useState<MealTag>("aclik");
  const [glucoseValue, setGlucoseValue] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [fieldError, setFieldError] = useState<string | null>(null);

  const reset = useCallback(() => {
    const t = getCurrentHourMinute();
    setHour(t.hour);
    setMinute(t.minute);
    setMealTag("aclik");
    setGlucoseValue("");
    setNote("");
    setFieldError(null);
  }, []);

  // Ekran her odaklandığında saati sıfırla
  useFocusEffect(
    useCallback(() => {
      const t = getCurrentHourMinute();
      setHour(t.hour);
      setMinute(t.minute);
    }, [])
  );

  const handleSave = useCallback(async () => {
    setFieldError(null);
    const result = validateGlucose(glucoseValue);

    if (result.status === "hard_error") {
      setFieldError(result.message);
      return;
    }

    const doSave = async () => {
      setSaving(true);
      try {
        const { isoString } = resolveRecordedAt(hour, minute);
        await insertGlucose({
          recordedAt: isoString,
          mealTag,
          glucoseMg: Number(glucoseValue.trim()),
          glucoseNote: note.trim() || undefined,
        });
        reset();
        onSaved();
        Alert.alert("✓ Kaydedildi", "Şeker ölçümü başarıyla kaydedildi.");
      } catch (err) {
        Alert.alert("Hata", "Kayıt sırasında bir sorun oluştu. Tekrar deneyin.");
        console.error(err);
      } finally {
        setSaving(false);
      }
    };

    if (result.status === "range_warning") {
      Alert.alert(
        "Olağandışı Değer",
        result.message,
        [
          { text: "Hayır, düzelt", style: "cancel" },
          { text: "Evet, kaydet", onPress: doSave },
        ],
        { cancelable: true }
      );
      return;
    }

    await doSave();
  }, [glucoseValue, hour, minute, mealTag, note, reset, onSaved]);

  const { displayLabel, isYesterday } = resolveRecordedAt(hour, minute);

  return (
    <View style={cardStyles.card}>
      {/* Başlık */}
      <View style={cardStyles.header}>
        <Text style={[cardStyles.dot, { backgroundColor: Colors.glucose }]} />
        <Text style={cardStyles.title}>🩸 Şeker</Text>
      </View>

      {/* Saat seçici */}
      <TimePickerRow
        hour={hour}
        minute={minute}
        onChangeHour={setHour}
        onChangeMinute={setMinute}
      />

      {/* Meal tag seçimi */}
      <Text style={cardStyles.label}>Ölçüm zamanı</Text>
      <View style={cardStyles.tagRow}>
        {MEAL_TAGS.map((tag) => (
          <TouchableOpacity
            key={tag.value}
            style={[
              cardStyles.tagButton,
              mealTag === tag.value && cardStyles.tagButtonSelected,
            ]}
            onPress={() => setMealTag(tag.value)}
            activeOpacity={0.75}
            accessibilityLabel={tag.label}
            accessibilityState={{ selected: mealTag === tag.value }}
          >
            <Text
              style={[
                cardStyles.tagText,
                mealTag === tag.value && cardStyles.tagTextSelected,
              ]}
            >
              {tag.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Şeker değeri girişi */}
      <Text style={cardStyles.label}>Şeker değeri (mg/dL)</Text>
      <View style={cardStyles.inputRow}>
        <TextInput
          style={[cardStyles.input, fieldError ? cardStyles.inputError : {}]}
          value={glucoseValue}
          onChangeText={(t) => {
            setGlucoseValue(t);
            if (fieldError) setFieldError(null);
          }}
          placeholder="Örn: 95"
          placeholderTextColor={Colors.textDisabled}
          keyboardType="number-pad"
          maxLength={4}
          accessibilityLabel="Şeker değeri"
        />
        <Text style={cardStyles.unit}>mg/dL</Text>
      </View>
      {fieldError && <Text style={cardStyles.errorText}>{fieldError}</Text>}

      {/* Not */}
      <Text style={cardStyles.label}>Not (isteğe bağlı)</Text>
      <TextInput
        style={cardStyles.noteInput}
        value={note}
        onChangeText={setNote}
        placeholder="Örn: İlaç içmeden önce"
        placeholderTextColor={Colors.textDisabled}
        multiline
        numberOfLines={2}
        accessibilityLabel="Şeker notu"
      />

      {/* Kaydet butonu */}
      <BigButton
        title="Şekeri Kaydet"
        onPress={handleSave}
        loading={saving}
        disabled={glucoseValue.trim() === ""}
        style={cardStyles.saveButton}
      />
    </View>
  );
}

// ─── BloodPressureCard bileşeni ───────────────────────────────────────────────

interface BloodPressureCardProps {
  onSaved: () => void;
}

function BloodPressureCard({ onSaved }: BloodPressureCardProps) {
  const init = getCurrentHourMinute();
  const [hour, setHour] = useState(init.hour);
  const [minute, setMinute] = useState(init.minute);
  const [systolic, setSystolic] = useState("");
  const [diastolic, setDiastolic] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [fieldError, setFieldError] = useState<string | null>(null);

  const reset = useCallback(() => {
    const t = getCurrentHourMinute();
    setHour(t.hour);
    setMinute(t.minute);
    setSystolic("");
    setDiastolic("");
    setNote("");
    setFieldError(null);
  }, []);

  useFocusEffect(
    useCallback(() => {
      const t = getCurrentHourMinute();
      setHour(t.hour);
      setMinute(t.minute);
    }, [])
  );

  const handleSave = useCallback(async () => {
    setFieldError(null);
    const result = validateBloodPressure(systolic, diastolic);

    if (result.status === "hard_error") {
      setFieldError(result.message);
      return;
    }

    const doSave = async () => {
      setSaving(true);
      try {
        const { isoString } = resolveRecordedAt(hour, minute);
        await insertBloodPressure({
          recordedAt: isoString,
          bpSystolic: Number(systolic.trim()),
          bpDiastolic: Number(diastolic.trim()),
          bpNote: note.trim() || undefined,
        });
        reset();
        onSaved();
        Alert.alert("✓ Kaydedildi", "Tansiyon ölçümü başarıyla kaydedildi.");
      } catch (err) {
        Alert.alert("Hata", "Kayıt sırasında bir sorun oluştu. Tekrar deneyin.");
        console.error(err);
      } finally {
        setSaving(false);
      }
    };

    if (result.status === "range_warning") {
      Alert.alert(
        "Olağandışı Değer",
        result.message,
        [
          { text: "Hayır, düzelt", style: "cancel" },
          { text: "Evet, kaydet", onPress: doSave },
        ],
        { cancelable: true }
      );
      return;
    }

    await doSave();
  }, [systolic, diastolic, hour, minute, note, reset, onSaved]);

  const isEmpty = systolic.trim() === "" || diastolic.trim() === "";

  return (
    <View style={cardStyles.card}>
      {/* Başlık */}
      <View style={cardStyles.header}>
        <Text
          style={[cardStyles.dot, { backgroundColor: Colors.bloodPressure }]}
        />
        <Text style={cardStyles.title}>💊 Tansiyon</Text>
      </View>

      {/* Saat seçici */}
      <TimePickerRow
        hour={hour}
        minute={minute}
        onChangeHour={setHour}
        onChangeMinute={setMinute}
      />

      {/* Tansiyon değer girişleri */}
      <Text style={cardStyles.label}>Tansiyon (mmHg)</Text>
      <View style={cardStyles.bpRow}>
        <View style={cardStyles.bpField}>
          <Text style={cardStyles.bpFieldLabel}>Büyük</Text>
          <TextInput
            style={[
              cardStyles.bpInput,
              fieldError && systolic.trim() === "" ? cardStyles.inputError : {},
            ]}
            value={systolic}
            onChangeText={(t) => {
              setSystolic(t);
              if (fieldError) setFieldError(null);
            }}
            placeholder="120"
            placeholderTextColor={Colors.textDisabled}
            keyboardType="number-pad"
            maxLength={3}
            accessibilityLabel="Büyük tansiyon değeri"
          />
        </View>

        <Text style={cardStyles.bpSeparator}>/</Text>

        <View style={cardStyles.bpField}>
          <Text style={cardStyles.bpFieldLabel}>Küçük</Text>
          <TextInput
            style={[
              cardStyles.bpInput,
              fieldError && diastolic.trim() === ""
                ? cardStyles.inputError
                : {},
            ]}
            value={diastolic}
            onChangeText={(t) => {
              setDiastolic(t);
              if (fieldError) setFieldError(null);
            }}
            placeholder="80"
            placeholderTextColor={Colors.textDisabled}
            keyboardType="number-pad"
            maxLength={3}
            accessibilityLabel="Küçük tansiyon değeri"
          />
        </View>

        <Text style={cardStyles.unit}>mmHg</Text>
      </View>

      {fieldError && <Text style={cardStyles.errorText}>{fieldError}</Text>}

      {/* Not */}
      <Text style={cardStyles.label}>Not (isteğe bağlı)</Text>
      <TextInput
        style={cardStyles.noteInput}
        value={note}
        onChangeText={setNote}
        placeholder="Örn: Oturur hâlde ölçüldü"
        placeholderTextColor={Colors.textDisabled}
        multiline
        numberOfLines={2}
        accessibilityLabel="Tansiyon notu"
      />

      {/* Kaydet butonu */}
      <BigButton
        title="Tansiyonu Kaydet"
        onPress={handleSave}
        loading={saving}
        disabled={isEmpty}
        style={cardStyles.saveButton}
      />
    </View>
  );
}

// ─── Paylaşılan kart stilleri ─────────────────────────────────────────────────

const cardStyles = StyleSheet.create({
  card: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    padding: Spacing.xl,
    marginBottom: Spacing.xl,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: Spacing.lg,
    gap: Spacing.sm,
  },
  dot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  title: {
    fontSize: FontSize.xl,
    fontWeight: "700",
    color: Colors.textPrimary,
  },
  label: {
    fontSize: FontSize.md,
    color: Colors.textSecondary,
    marginBottom: Spacing.sm,
    fontWeight: "500",
  },
  tagRow: {
    flexDirection: "row",
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
    flexWrap: "wrap",
  },
  tagButton: {
    flex: 1,
    minWidth: "45%",
    height: 60,
    borderRadius: Radius.sm,
    backgroundColor: Colors.tagUnselected,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: Colors.border,
  },
  tagButtonSelected: {
    backgroundColor: Colors.tagSelected,
    borderColor: Colors.primary,
  },
  tagText: {
    fontSize: FontSize.sm,
    fontWeight: "600",
    color: Colors.tagUnselectedText,
    textAlign: "center",
  },
  tagTextSelected: {
    color: Colors.tagSelectedText,
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    marginBottom: Spacing.sm,
  },
  input: {
    flex: 1,
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
  },
  inputError: {
    borderColor: Colors.danger,
    borderWidth: 2,
  },
  unit: {
    fontSize: FontSize.md,
    color: Colors.textSecondary,
    fontWeight: "500",
    minWidth: 50,
  },
  errorText: {
    fontSize: FontSize.sm,
    color: Colors.danger,
    marginBottom: Spacing.md,
    lineHeight: 22,
  },
  noteInput: {
    backgroundColor: Colors.surfaceAlt,
    borderRadius: Radius.sm,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    fontSize: FontSize.md,
    color: Colors.textPrimary,
    minHeight: 72,
    textAlignVertical: "top",
    marginBottom: Spacing.lg,
  },
  saveButton: {
    width: "100%",
  },
  bpRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  bpField: {
    flex: 1,
  },
  bpFieldLabel: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    marginBottom: Spacing.xs,
    textAlign: "center",
  },
  bpInput: {
    height: 64,
    backgroundColor: Colors.surfaceAlt,
    borderRadius: Radius.sm,
    borderWidth: 1,
    borderColor: Colors.border,
    fontSize: FontSize.xxl,
    color: Colors.textPrimary,
    fontWeight: "700",
    textAlign: "center",
  },
  bpSeparator: {
    fontSize: FontSize.xxl,
    color: Colors.textSecondary,
    fontWeight: "300",
    paddingBottom: 10,
  },
});

// ─── WaterCard bileşeni ───────────────────────────────────────────────────────

interface WaterCardProps {
  onSaved: () => void;
}

function WaterCard({ onSaved }: WaterCardProps) {
  const init = getCurrentHourMinute();
  const [hour, setHour] = useState(init.hour);
  const [minute, setMinute] = useState(init.minute);
  const [waterValue, setWaterValue] = useState("");
  const [saving, setSaving] = useState(false);
  const [fieldError, setFieldError] = useState<string | null>(null);

  const reset = useCallback(() => {
    const t = getCurrentHourMinute();
    setHour(t.hour);
    setMinute(t.minute);
    setWaterValue("");
    setFieldError(null);
  }, []);

  useFocusEffect(
    useCallback(() => {
      const t = getCurrentHourMinute();
      setHour(t.hour);
      setMinute(t.minute);
    }, [])
  );

  const handleSave = useCallback(async () => {
    setFieldError(null);
    const trimmed = waterValue.trim();

    if (trimmed === "") {
      setFieldError("Su miktarı boş bırakılamaz.");
      return;
    }
    const val = Number(trimmed);
    if (!Number.isFinite(val) || !Number.isInteger(val) || val <= 0) {
      setFieldError("Geçerli bir miktar girin (örn: 200).");
      return;
    }
    if (val > 5000) {
      setFieldError("5000 ml'den fazla girilemez.");
      return;
    }

    setSaving(true);
    try {
      const { isoString } = resolveRecordedAt(hour, minute);
      await insertWater({ recordedAt: isoString, waterMl: val });
      reset();
      onSaved();
      Alert.alert("✓ Kaydedildi", "Su kaydı başarıyla eklendi.");
    } catch (err) {
      Alert.alert("Hata", "Kayıt sırasında bir sorun oluştu. Tekrar deneyin.");
      console.error(err);
    } finally {
      setSaving(false);
    }
  }, [waterValue, hour, minute, reset, onSaved]);

  return (
    <View style={cardStyles.card}>
      {/* Başlık */}
      <View style={cardStyles.header}>
        <Text style={[cardStyles.dot, { backgroundColor: "#58A6FF" }]} />
        <Text style={cardStyles.title}>💧 Su</Text>
      </View>

      {/* Saat seçici */}
      <TimePickerRow
        hour={hour}
        minute={minute}
        onChangeHour={setHour}
        onChangeMinute={setMinute}
      />

      {/* Miktar girişi */}
      <Text style={cardStyles.label}>İçilen su miktarı (ml)</Text>
      <View style={cardStyles.inputRow}>
        <TextInput
          style={[cardStyles.input, fieldError ? cardStyles.inputError : {}]}
          value={waterValue}
          onChangeText={(t) => {
            setWaterValue(t);
            if (fieldError) setFieldError(null);
          }}
          placeholder="Örn: 200"
          placeholderTextColor={Colors.textDisabled}
          keyboardType="number-pad"
          maxLength={4}
          accessibilityLabel="Su miktarı ml"
        />
        <Text style={cardStyles.unit}>ml</Text>
      </View>
      {fieldError && <Text style={cardStyles.errorText}>{fieldError}</Text>}

      {/* Kısa yol butonları */}
      <View style={waterStyles.shortcuts}>
        {[100, 150, 200, 250, 300, 500].map((ml) => (
          <TouchableOpacity
            key={ml}
            style={waterStyles.shortcutBtn}
            onPress={() => {
              setWaterValue(String(ml));
              setFieldError(null);
            }}
            activeOpacity={0.75}
          >
            <Text style={waterStyles.shortcutText}>{ml} ml</Text>
          </TouchableOpacity>
        ))}
      </View>

      <BigButton
        title="Suyu Kaydet"
        onPress={handleSave}
        loading={saving}
        disabled={waterValue.trim() === ""}
        style={cardStyles.saveButton}
      />
    </View>
  );
}

const waterStyles = StyleSheet.create({
  shortcuts: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  shortcutBtn: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    backgroundColor: Colors.surfaceAlt,
    borderRadius: Radius.sm,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  shortcutText: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    fontWeight: "600",
  },
});

// ─── Ana ekran ────────────────────────────────────────────────────────────────

export default function HomeScreen() {
  const [savedCount, setSavedCount] = useState(0);

  const handleSaved = useCallback(() => {
    setSavedCount((n) => n + 1);
  }, []);

  const today = new Date().toLocaleDateString("tr-TR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Başlık */}
        <View style={styles.header}>
          <Text style={styles.appTitle}>Sağlık Takip</Text>
          <Text style={styles.date}>{today}</Text>
          {savedCount > 0 && (
            <Text style={styles.savedHint}>
              {savedCount} kayıt bu oturumda eklendi
            </Text>
          )}
        </View>

        {/* Şeker kartı */}
        <GlucoseCard onSaved={handleSaved} />

        {/* Tansiyon kartı */}
        <BloodPressureCard onSaved={handleSaved} />

        {/* Su kartı */}
        <WaterCard onSaved={handleSaved} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: Colors.background },
  scroll: { flex: 1 },
  content: {
    padding: Spacing.xl,
    paddingBottom: Spacing.xxxl,
  },
  header: {
    marginBottom: Spacing.xl,
  },
  appTitle: {
    fontSize: FontSize.xxl,
    fontWeight: "800",
    color: Colors.textPrimary,
    marginBottom: Spacing.xs,
  },
  date: {
    fontSize: FontSize.md,
    color: Colors.textSecondary,
    textTransform: "capitalize",
  },
  savedHint: {
    fontSize: FontSize.sm,
    color: Colors.success,
    marginTop: Spacing.xs,
    fontWeight: "600",
  },
});
