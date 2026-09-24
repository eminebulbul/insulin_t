import { View, Text, StyleSheet, Alert } from "react-native";
import { Colors, FontSize, Spacing, Radius } from "@/constants/theme";
import { BigButton } from "@/components/BigButton";
import { exportJSON, exportCSV } from "@/utils/export";

/**
 * Dışa Aktarma ekranı — Faz 1'de JSON ve CSV yedek.
 * Faz 4'te PDF (doktor özeti) eklenecek.
 */
export default function ExportScreen() {
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

  return (
    <View style={styles.container}>
      <Text style={styles.icon}>💾</Text>
      <Text style={styles.title}>Veri Yedekleme</Text>
      <Text style={styles.description}>
        Kayıtlarınızı telefonunuzda saklamak veya başka bir cihaza aktarmak için
        dışa aktarın.
      </Text>

      <View style={styles.buttonGroup}>
        <BigButton
          title="📄 JSON Yedek Al"
          onPress={handleJSON}
          variant="secondary"
          size="lg"
        />
        <Text style={styles.hint}>
          Uygulamayı değiştirirken veya telefon sıfırlamadan önce kullanın
        </Text>

        <BigButton
          title="📊 CSV Olarak Aktar"
          onPress={handleCSV}
          variant="secondary"
          size="lg"
          style={{ marginTop: Spacing.lg }}
        />
        <Text style={styles.hint}>
          Excel veya Google Sheets ile açılabilir
        </Text>
      </View>

      <View style={styles.infoBox}>
        <Text style={styles.infoText}>
          ℹ Veriler yalnızca bu telefonda saklanır. Düzenli yedek almanız
          tavsiye edilir.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
    padding: Spacing.xl,
  },
  icon: { fontSize: 48, textAlign: "center", marginTop: Spacing.xl },
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
});
