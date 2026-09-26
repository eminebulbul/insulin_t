import React, { useEffect } from "react";
import { View, Text, StyleSheet, ActivityIndicator } from "react-native";
import { Tabs, useRouter, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";

import { Colors, FontSize } from "@/constants/theme";
import { setupNotificationChannel } from "@/utils/notifications";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import { subscribeToReminders } from "@/db/firestoreQueries";
import { syncRemindersWithLocalNotifications } from "@/services/reminderSync";

function AppNavigation() {
  const { user, loading } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  // Android bildirim kanalını başlat
  useEffect(() => {
    setupNotificationChannel().catch((err) => {
      console.error("Bildirim kanalı kurulamadı:", err);
    });
  }, []);

  // Hatırlatma arka plan canlı senkronu (kullanıcı giriş yapmışsa aktif)
  useEffect(() => {
    if (!user) return;

    const unsubscribe = subscribeToReminders((reminders) => {
      syncRemindersWithLocalNotifications(reminders).catch((err) => {
        console.error("Hatırlatma canlı senkron hatası:", err);
      });
    });

    return unsubscribe;
  }, [user]);

  // Kimlik doğrulama yönlendirme koruması
  useEffect(() => {
    if (loading) return;

    const inLogin = segments[0] === "login";

    if (!user && !inLogin) {
      router.replace("/login");
    } else if (user && inLogin) {
      router.replace("/");
    }
  }, [user, loading, segments, router]);

  // Yükleme ekranı (oturum durumu belirlenene kadar)
  if (loading) {
    return (
      <View style={styles.splash}>
        <Text style={styles.splashTitle}>Sağlık Takip</Text>
        <ActivityIndicator
          color={Colors.primary}
          size="large"
          style={{ marginTop: 24 }}
        />
      </View>
    );
  }

  return (
    <>
      <StatusBar style="light" />
      <Tabs
        screenOptions={{
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
        <Tabs.Screen
          name="login"
          options={{
            href: null,
            headerShown: false,
            tabBarStyle: { display: "none" },
          }}
        />
      </Tabs>
    </>
  );
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <AppNavigation />
    </AuthProvider>
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
});
