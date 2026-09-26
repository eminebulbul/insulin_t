import React, { useState } from "react";
import {
  View,
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
import { AppText } from "@/components/AppText";
import { exportJSON, exportCSV } from "@/utils/export";
import { useAuth } from "@/context/AuthContext";
import { useFontSize, FontSizeLevel, FONT_LEVEL_LABELS } from "@/context/FontSizeContext";
import {
  generateAndSharePdf,
  buildDateRange,
  type DateRangePreset,
} from "@/utils/pdfExport";

/**
 * Ayarlar ve Dışa Aktarma ekranı.
 * - Yazı boyutu (cihaza özel FontSizeContext ölçeklemesi)
 * - PDF doktor özeti paylaşma
 * - JSON ve CSV veri yedekleme
 * - Aile hesabı oturum yönetimi
 */
export default function ExportScreen() {
  const { user, signOut } = useAuth();
  const { level: fontLevel, setLevel: setFontLevel, scale: fontScale } = useFontSize();

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

  const FONT_LEVELS: FontSizeLevel[] = ["small", "normal", "large", "extra_large"];

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      {/* ── 1. YAZI BOYUTU (GÖRÜNÜM AYARI) ── */}
      <View style={styles.sectionCard}>
        <AppText style={styles.sectionTitle}>👁️ Yazı Boyutu</AppText>
        <AppText style={styles.sectionDesc}>
          Uygulama yazı büyüklüğünü kendinize göre seçin. Sadece bu cihazda geçerlidir.
        </AppText>

        <View style={styles.fontGrid}>
          {FONT_LEVELS.map((lvl) => {
            const isSelected = fontLevel === lvl;
            const info = FONT_LEVEL_LABELS[lvl];
            return (
              <TouchableOpacity
                key={lvl}
                style={[
                  styles.fontBtn,
                  isSelected && styles.fontBtnActive,
                ]}
                onPress={() => setFontLevel(lvl)}
                activeOpacity={0.75}
                accessibilityRole="button"
                accessibilityLabel={`${info.title} yazı boyutu, ${isSelected ? "seçili" : "seçmek için dokunun"}`}
              >
                <AppText
                  style={[
                    styles.fontBtnTitle,
                    isSelected && styles.fontBtnTitleActive,
                  ]}
                >
                  {info.title}
                </AppText>
                <AppText
                  style={[
                    styles.fontBtnSub,
                    isSelected && styles.fontBtnSubActive,
                  ]}
                >
                  {info.subtitle}
                </AppText>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Canlı Önizleme Kutusu */}
        <View style={styles.previewBox}>
          <AppText style={styles.previewHeader}>Canlı Önizleme ({FONT_LEVEL_LABELS[fontLevel].title} - {fontScale}x)</AppText>
          <View style={styles.previewRow}>
            <AppText style={[styles.previewValue, { color: Colors.glucose }]}>
              🩸 Şeker: 120 mg/dL
            </AppText>
            <AppText style={styles.previewTag}>Açlık</AppText>
          </View>
          <View style={styles.previewRow}>
            <AppText style={[styles.previewValue, { color: Colors.bloodPressure }]}>
              💊 Tansiyon: 120/80 mmHg
            </AppText>
          </View>
          <View style={styles.previewRow}>
            <AppText style={[styles.previewValue, { color: "#58A6FF" }]}>
              💧 Su: 200 ml
            </AppText>
          </View>
        </View>
      </View>

      {/* ── 2. DOKTOR PDF ÖZETİ ── */}
      <View style={styles.pdfCard}>
        <AppText style={styles.pdfCardTitle}>📋 Doktor PDF Özeti</AppText>
        <AppText style={styles.pdfCardDesc}>
          Seçilen aralıktaki ölçümler, su tüketimi ve hatırlatma planını
          A4 PDF olarak oluşturur.
        </AppText>

        {/* Hızlı aralık butonları */}
        <View style={styles.presetRow}>
          {(["7", "30", "90", "custom"] as DateRangePreset[]).map((p) => (
            <TouchableOpacity
              key={p}
              id={`preset-${p}`}
              style={[styles.presetBtn, preset === p && styles.presetBtnActive]}
              onPress={() => setPreset(p)}
              activeOpacity={0.75}
            >
              <AppText
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
                  : "Özel Aralık"}
              </AppText>
            </TouchableOpacity>
          ))}
        </View>

        {/* Özel tarih seçiciler */}
        {preset === "custom" && (
          <View style={styles.customRange}>
            <View style={styles.customDateRow}>
              <AppText style={styles.customDateLabel}>Başlangıç:</AppText>
              <TouchableOpacity
                style={styles.datePickerBtn}
                onPress={() => setShowFromPicker(true)}
              >
                <AppText style={styles.datePickerBtnText}>
                  {customFrom.toLocaleDateString("tr-TR")}
                </AppText>
              </TouchableOpacity>
            </View>

            <View style={styles.customDateRow}>
              <AppText style={styles.customDateLabel}>Bitiş:</AppText>
              <TouchableOpacity
                style={styles.datePickerBtn}
                onPress={() => setShowToPicker(true)}
              >
                <AppText style={styles.datePickerBtnText}>
                  {customTo.toLocaleDateString("tr-TR")}
                </AppText>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {showFromPicker && (
          <DateTimePicker
            value={customFrom}
            mode="date"
            display="spinner"
            themeVariant="dark"
            maximumDate={customTo}
            onChange={(_: DateTimePickerEvent, date?: Date) => {
              if (Platform.OS === "android") setShowFromPicker(false);
              if (date) {
                date.setHours(0, 0, 0, 0);
                setCustomFrom(date);
              }
            }}
          />
        )}

        {showToPicker && (
          <DateTimePicker
            value={customTo}
            mode="date"
            display="spinner"
            themeVariant="dark"
            minimumDate={customFrom}
            maximumDate={new Date()}
            onChange={(_: DateTimePickerEvent, date?: Date) => {
              if (Platform.OS === "android") setShowToPicker(false);
              if (date) {
                date.setHours(23, 59, 59, 999);
                setCustomTo(date);
              }
            }}
          />
        )}

        {pdfLoading ? (
          <View style={styles.pdfLoadingRow}>
            <ActivityIndicator color={Colors.primary} size="small" />
            <AppText style={styles.pdfLoadingText}>PDF hazırlanıyor...</AppText>
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

      {/* ── 3. VERİ YEDEĞİ ── */}
      <View style={styles.buttonGroup}>
        <BigButton
          title="📄 JSON Yedek Al"
          onPress={handleJSON}
          variant="secondary"
          size="lg"
        />
        <AppText style={styles.hint}>
          Tüm ölçüm ve su kayıtlarını ham veri olarak aktarır
        </AppText>

        <BigButton
          title="📊 CSV Olarak Aktar"
          onPress={handleCSV}
          variant="secondary"
          size="lg"
          style={{ marginTop: Spacing.md }}
        />
        <AppText style={styles.hint}>
          Excel veya Google E-Tablolar ile açılabilir
        </AppText>
      </View>

      <View style={styles.infoBox}>
        <AppText style={styles.infoText}>
          ☁️ Verileriniz Firebase bulutunda saklanmakta ve bağlı 4 cihazla anlık
          olarak senkronize edilmektedir.
        </AppText>
        {user?.email && (
          <AppText style={styles.emailText}>Aktif Hesap: {user.email}</AppText>
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
  sectionCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.lg,
    marginBottom: Spacing.xxl,
  },
  sectionTitle: {
    fontSize: FontSize.lg,
    fontWeight: "700",
    color: Colors.textPrimary,
    marginBottom: Spacing.xs,
  },
  sectionDesc: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    lineHeight: 20,
    marginBottom: Spacing.md,
  },
  fontGrid: {
    flexDirection: "row",
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  fontBtn: {
    flex: 1,
    minHeight: 56,
    borderRadius: Radius.sm,
    backgroundColor: Colors.surfaceAlt,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.xs,
  },
  fontBtnActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  fontBtnTitle: {
    fontSize: FontSize.sm,
    fontWeight: "700",
    color: Colors.textPrimary,
    textAlign: "center",
  },
  fontBtnTitleActive: {
    color: "#FFFFFF",
  },
  fontBtnSub: {
    fontSize: FontSize.xs,
    color: Colors.textDisabled,
    marginTop: 2,
  },
  fontBtnSubActive: {
    color: "rgba(255,255,255,0.85)",
  },
  previewBox: {
    backgroundColor: Colors.surfaceAlt,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.md,
    gap: Spacing.xs,
  },
  previewHeader: {
    fontSize: FontSize.xs,
    color: Colors.textDisabled,
    marginBottom: Spacing.xs,
    fontWeight: "600",
    textTransform: "uppercase",
  },
  previewRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 2,
    flexWrap: "wrap",
  },
  previewValue: {
    fontSize: FontSize.md,
    fontWeight: "700",
  },
  previewTag: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    backgroundColor: Colors.surface,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: Radius.sm,
    borderWidth: 1,
    borderColor: Colors.border,
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
