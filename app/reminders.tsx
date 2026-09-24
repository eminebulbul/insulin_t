import { View, Text, StyleSheet } from "react-native";
import { Colors, FontSize, Spacing } from "@/constants/theme";

export default function RemindersScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.icon}>🔔</Text>
      <Text style={styles.title}>Hatırlatmalar</Text>
      <Text style={styles.subtitle}>Faz 2'de eklenecek</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
    alignItems: "center",
    justifyContent: "center",
    padding: Spacing.xxl,
  },
  icon: { fontSize: 64, marginBottom: Spacing.lg },
  title: {
    fontSize: FontSize.xl,
    fontWeight: "700",
    color: Colors.textPrimary,
    marginBottom: Spacing.sm,
  },
  subtitle: {
    fontSize: FontSize.md,
    color: Colors.textSecondary,
  },
});
