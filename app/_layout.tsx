import { useEffect, useState } from "react";
import { View, Text, StyleSheet, ActivityIndicator } from "react-native";
import { Tabs } from "expo-router";
import { StatusBar } from "expo-status-bar";

import { initDatabase } from "@/db/schema";
import { Colors, FontSize } from "@/constants/theme";

/**
 * Root layout — uygulamanın en dış katmanı.
 *
 * Görevleri:
 * 1. SQLite veritabanını başlatır (uygulama açılırken).
 * 2. Yükleme sırasında splash benzeri bir ekran gösterir.
 * 3. expo-router Tabs navigasyonunu yapılandırır.
 *
 * Neden Tabs? MVP'de 4 sekme var (Giriş, Geçmiş, Hatırlatmalar, Dışa Aktar).
 * Alt sekme çubuğu yaşlı kullanıcı için en sezgisel navigasyon yöntemi.
 */
export default function RootLayout() {
  const [dbReady, setDbReady] = useState(false);
  const [dbError, setDbError] = useState<string | null>(null);

  useEffect(() => {
    initDatabase()
      .then(() => setDbReady(true))
      .catch((err) => {
        console.error("Veritabanı başlatılamadı:", err);
        setDbError("Uygulama başlatılamadı. Lütfen yeniden deneyin.");
      });
  }, []);

  // Yükleme ekranı
  if (!dbReady && !dbError) {
    return (
      <View style={styles.splash}>
        <Text style={styles.splashTitle}>Sağlık Takip</Text>
        <ActivityIndicator color={Colors.primary} size="large" style={{ marginTop: 24 }} />
      </View>
    );
  }

  // Kritik hata ekranı
  if (dbError) {
    return (
      <View style={styles.splash}>
        <Text style={styles.errorTitle}>⚠ Hata</Text>
        <Text style={styles.errorText}>{dbError}</Text>
      </View>
    );
  }

  return (
    <>
      <StatusBar style="light" />
      <Tabs
        screenOptions={{
          // Tab bar görünümü
          tabBarStyle: {
            backgroundColor: Colors.surface,
            borderTopColor: Colors.border,
            borderTopWidth: 1,
            height: 72,
            paddingBottom: 10,
            paddingTop: 8,
          },
          tabBarActiveTintColor: Colors.primary,
          tabBarInactiveTintColor: Colors.textSecondary,
          tabBarLabelStyle: {
            fontSize: FontSize.xs,
            fontWeight: "600",
          },
          // Header görünümü
          headerStyle: { backgroundColor: Colors.background },
          headerTintColor: Colors.textPrimary,
          headerTitleStyle: {
            fontSize: FontSize.lg,
            fontWeight: "700",
          },
          headerShadowVisible: false,
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: "Ölçüm Gir",
            tabBarLabel: "Giriş",
            tabBarIcon: ({ color }) => (
              <Text style={{ fontSize: 24, color }}>📝</Text>
            ),
          }}
        />
        <Tabs.Screen
          name="history"
          options={{
            title: "Geçmiş",
            tabBarLabel: "Geçmiş",
            tabBarIcon: ({ color }) => (
              <Text style={{ fontSize: 24, color }}>📊</Text>
            ),
          }}
        />
        <Tabs.Screen
          name="reminders"
          options={{
            title: "Hatırlatmalar",
            tabBarLabel: "Hatırlatma",
            tabBarIcon: ({ color }) => (
              <Text style={{ fontSize: 24, color }}>🔔</Text>
            ),
          }}
        />
        <Tabs.Screen
          name="export"
          options={{
            title: "Dışa Aktar",
            tabBarLabel: "Yedek",
            tabBarIcon: ({ color }) => (
              <Text style={{ fontSize: 24, color }}>💾</Text>
            ),
          }}
        />
      </Tabs>
    </>
  );
}

const styles = StyleSheet.create({
  splash: {
    flex: 1,
    backgroundColor: Colors.background,
    alignItems: "center",
    justifyContent: "center",
    padding: 32,
  },
  splashTitle: {
    fontSize: 32,
    fontWeight: "800",
    color: Colors.textPrimary,
  },
  errorTitle: {
    fontSize: 28,
    fontWeight: "700",
    color: Colors.danger,
    marginBottom: 16,
  },
  errorText: {
    fontSize: FontSize.md,
    color: Colors.textSecondary,
    textAlign: "center",
    lineHeight: 28,
  },
});
