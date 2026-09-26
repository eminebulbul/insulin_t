import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Alert,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
} from "react-native";
import DateTimePicker, { DateTimePickerEvent } from "@react-native-community/datetimepicker";
import { Colors, FontSize, Spacing, Radius } from "@/constants/theme";
import { BigButton } from "@/components/BigButton";
import { exportJSON, exportCSV } from "@/utils/export";
import { useAuth } from "@/context/AuthContext";
import {
  generateAndSharePdf,
  buildDateRange,
  type DateRangePreset,
} from "@/utils/pdfExport";

/**
 * Dışa Aktarma ve Ayarlar ekranı.
 * Firestore üzerindeki verileri JSON ve CSV olarak dışa aktarır.
 * Aile hesabından çıkış yapma seçeneği sunar.
 */
export default function ExportScreen() {
  const { user, signOut } = useAuth();

  // ── PDF özeti durumu
  const [preset, setPreset] = useState<DateRangePreset>("30");
  const [customFrom, setCustomFrom] = useState<Date>(() => {
    const d = new Date();
    d.setDate(d.getDate() - 29);
    d.setHours(0, 0, 0, 0);
    return d;
  });
  const [customTo, setCustomTo] = useState<Date>(() => {
    const d = new Date();
    d.setHours(23, 59, 59, 999);
    return d;
  });
  const [showFromPicker, setShowFromPicker] = useState(false);
  const [showToPicker, setShowToPicker] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);

  async function handleJSON() {
    try {
      await exportJSON();
    } catch (err) {
      Alert.alert("Hata", "JSON dışa aktarma başarısız. Tekrar deneyin.");
      console.error(err);
    }
  }

  async function handleCSV() {
    try {
      await exportCSV();
    } catch (err) {
      Alert.alert("Hata", "CSV dışa aktarma başarısız. Tekrar deneyin.");
      console.error(err);
    }
  }

  async function handlePdf() {
    setPdfLoading(true);
    try {
      const range = buildDateRange(preset, customFrom, customTo);
      await generateAndSharePdf(range);
    } catch (err) {
      console.error("PDF hatası:", err);
      Alert.alert("Hata", "PDF oluşturulurken bir sorun çıktı. Tekrar deneyin.");
    } finally {
      setPdfLoading(false);
    }
  }

  function handleSignOut() {
    Alert.alert(
      "Oturumu Kapat",
      "Aile hesabından çıkış yapmak istediğinize emin misiniz?",
      [
        { text: "Vazgeç", style: "cancel" },
        {
          text: "Çıkış Yap",
          style: "destructive",
          onPress: async () => {
            try {
              await signOut();
            } catch (err) {
              console.error("Çıkış hatası:", err);
              Alert.alert("Hata", "Çıkış yapılırken bir sorun oluştu.");
            }
          },
        },
      ]
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <Text style={styles.icon}>💾</Text>
      <Text style={styles.title}>Veri & Hesap</Text>
      <Text style={styles.description}>
        Kayıtlarınızı telefonunuzda saklamak veya aile/doktor ile paylaşmak için
        dışa aktarın.
      </Text>

      {/* ── DOKTOR PDF ÖZETİ ── */}
      <View style={styles.pdfCard}>
        <Text style={styles.pdfCardTitle}>📋 Doktor PDF Özeti</Text>
        <Text style={styles.pdfCardDesc}>
          Seçilen aralıktaki ölçümler, su tüketimi ve hatırlatma planını
          A4 PDF olarak oluşturur.
        </Text>

        {/* Hızlı aralık butonları */}
        <View style={styles.presetRow}>
          {(["7", "30", "90", "custom"] as DateRangePreset[]).map((p) => (
            <TouchableOpacity
              key={p}
              id={`preset-${p}`}
              style={[styles.presetBtn, preset === p && styles.presetBtnActive]}
              onPress={() => setPreset(p)}
            >
              <Text
                style={[
                  styles.presetBtnText,
                  preset === p && styles.presetBtnTextActive,
                ]}
              >
                {p === "7"
                  ? "Son 7 gün"
                  : p === "30"
                  ? "Son 30 gün"
                  : p === "90"
                  ? "Son 90 gün"
                  : "Özel"}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Özel aralık seçici */}
        {preset === "custom" && (
          <View style={styles.customRange}>
            <View style={styles.customDateRow}>
              <Text style={styles.customDateLabel}>Başlangıç:</Text>
              <TouchableOpacity
                id="custom-from-btn"
                style={styles.datePickerBtn}
                onPress={() => setShowFromPicker(true)}
              >
                <Text style={styles.datePickerBtnText}>
                  {customFrom.toLocaleDateString("tr-TR")}
                </Text>
              </TouchableOpacity>
            </View>
            <View style={styles.customDateRow}>
              <Text style={styles.customDateLabel}>Bitiş:</Text>
              <TouchableOpacity
                id="custom-to-btn"
                style={styles.datePickerBtn}
                onPress={() => setShowToPicker(true)}
              >
                <Text style={styles.datePickerBtnText}>
                  {customTo.toLocaleDateString("tr-TR")}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {showFromPicker && (
          <DateTimePicker
            value={customFrom}
            mode="date"
            display={Platform.OS === "android" ? "default" : "spinner"}
            maximumDate={customTo}
            onChange={(_: DateTimePickerEvent, date?: Date) => {
              setShowFromPicker(false);
              if (date) setCustomFrom(date);
            }}
          />
        )}
        {showToPicker && (
          <DateTimePicker
            value={customTo}
            mode="date"
            display={Platform.OS === "android" ? "default" : "spinner"}
            minimumDate={customFrom}
            maximumDate={new Date()}
            onChange={(_: DateTimePickerEvent, date?: Date) => {
              setShowToPicker(false);
              if (date) setCustomTo(date);
            }}
          />
        )}

        {pdfLoading ? (
          <View style={styles.pdfLoadingRow}>
            <ActivityIndicator color={Colors.primary} size="small" />
            <Text style={styles.pdfLoadingText}>PDF hazırlanıyor…</Text>
          </View>
        ) : (
          <BigButton
            title="📄 PDF Oluştur ve Paylaş"
            onPress={handlePdf}
            variant="primary"
            size="lg"
            style={{ marginTop: Spacing.lg }}
          />
        )}
      </View>

      {/* ── VERİ YEDEĞİ ── */}
      <View style={styles.buttonGroup}>

        <BigButton
          title="📄 JSON Yedek Al"
          onPress={handleJSON}
          variant="secondary"
          size="lg"
        />
        <Text style={styles.hint}>
          Tüm ölçüm ve su kayıtlarını ham veri olarak aktarır
        </Text>

        <BigButton
          title="📊 CSV Olarak Aktar"
          onPress={handleCSV}
          variant="secondary"
          size="lg"
          style={{ marginTop: Spacing.md }}
        />
        <Text style={styles.hint}>
          Excel veya Google E-Tablolar ile açılabilir
        </Text>
      </View>

      <View style={styles.infoBox}>
        <Text style={styles.infoText}>
          ☁️ Verileriniz Firebase bulutunda saklanmakta ve bağlı 4 cihazla anlık
          olarak senkronize edilmektedir.
        </Text>
        {user?.email && (
          <Text style={styles.emailText}>Aktif Hesap: {user.email}</Text>
        )}
      </View>

      <View style={styles.signOutWrapper}>
        <BigButton
          title="🚪 Oturumu Kapat"
          onPress={handleSignOut}
          variant="danger"
          size="md"
        />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    padding: Spacing.xl,
    paddingBottom: Spacing.xxxl * 2,
  },
  icon: { fontSize: 48, textAlign: "center", marginTop: Spacing.lg },
  title: {
    fontSize: FontSize.xl,
    fontWeight: "700",
    color: Colors.textPrimary,
    textAlign: "center",
    marginVertical: Spacing.md,
  },
  description: {
    fontSize: FontSize.md,
    color: Colors.textSecondary,
    textAlign: "center",
    lineHeight: 26,
    marginBottom: Spacing.xxl,
  },
  buttonGroup: { gap: Spacing.sm },
  hint: {
    fontSize: FontSize.sm,
    color: Colors.textDisabled,
    textAlign: "center",
    marginTop: Spacing.xs,
  },
  infoBox: {
    marginTop: Spacing.xxl,
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  infoText: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    lineHeight: 22,
  },
  emailText: {
    fontSize: FontSize.xs,
    color: Colors.primary,
    marginTop: Spacing.sm,
    fontWeight: "600",
  },
  signOutWrapper: {
    marginTop: Spacing.xxl,
  },
  // ── PDF Özet Kartı
  pdfCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.primary,
    padding: Spacing.lg,
    marginBottom: Spacing.xxl,
  },
  pdfCardTitle: {
    fontSize: FontSize.lg,
    fontWeight: "700",
    color: Colors.textPrimary,
    marginBottom: Spacing.sm,
  },
  pdfCardDesc: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    lineHeight: 22,
    marginBottom: Spacing.lg,
  },
  presetRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
  },
  presetBtn: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.sm,
    backgroundColor: Colors.surfaceAlt,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  presetBtnActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  presetBtnText: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    fontWeight: "500",
  },
  presetBtnTextActive: {
    color: "#fff",
    fontWeight: "700",
  },
  customRange: {
    marginTop: Spacing.md,
    gap: Spacing.sm,
  },
  customDateRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
  },
  customDateLabel: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    width: 80,
  },
  datePickerBtn: {
    flex: 1,
    backgroundColor: Colors.surfaceAlt,
    borderRadius: Radius.sm,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  datePickerBtnText: {
    fontSize: FontSize.sm,
    color: Colors.textPrimary,
  },
  pdfLoadingRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.sm,
    marginTop: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  pdfLoadingText: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
  },
});

