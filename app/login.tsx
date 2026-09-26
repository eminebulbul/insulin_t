import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import { router } from "expo-router";
import { Colors, FontSize, Spacing, Radius, ButtonHeight } from "@/constants/theme";
import { BigButton } from "@/components/BigButton";
import { useAuth } from "@/context/AuthContext";

export default function LoginScreen() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleLogin = async () => {
    const trimmedEmail = email.trim();
    if (!trimmedEmail || !password) {
      setErrorMessage("Lütfen e-posta ve şifrenizi girin.");
      return;
    }

    setLoading(true);
    setErrorMessage(null);

    try {
      await signIn(trimmedEmail, password);
      // Başarılı giriş sonrası ana ekrana yönlendir
      router.replace("/");
    } catch (err: any) {
      console.error("Giriş hatası:", err);
      const code = err?.code || "";
      if (
        code === "auth/invalid-email" ||
        code === "auth/user-not-found" ||
        code === "auth/wrong-password" ||
        code === "auth/invalid-credential"
      ) {
        setErrorMessage("E-posta adresi veya şifre hatalı.");
      } else if (code === "auth/network-request-failed") {
        setErrorMessage("İnternet bağlantısı kurulamadı. Lütfen ağınızı kontrol edin.");
      } else if (code === "auth/too-many-requests") {
        setErrorMessage("Çok fazla hatalı deneme yapıldı. Lütfen biraz bekleyin.");
      } else {
        setErrorMessage("Giriş yapılamadı. Lütfen bilgilerinizi kontrol edip tekrar deneyin.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.keyboardView}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Text style={styles.icon}>🏥</Text>
          <Text style={styles.title}>Aile Sağlık Takip</Text>
          <Text style={styles.subtitle}>
            Devam etmek için aile hesabıyla giriş yapın
          </Text>
        </View>

        {errorMessage && (
          <View style={styles.errorBox}>
            <Text style={styles.errorIcon}>⚠️</Text>
            <Text style={styles.errorText}>{errorMessage}</Text>
          </View>
        )}

        <View style={styles.form}>
          <Text style={styles.label}>E-Posta</Text>
          <TextInput
            style={styles.input}
            value={email}
            onChangeText={(text) => {
              setEmail(text);
              if (errorMessage) setErrorMessage(null);
            }}
            placeholder="ornek@aile.com"
            placeholderTextColor={Colors.textDisabled}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            editable={!loading}
          />

          <Text style={[styles.label, { marginTop: Spacing.xl }]}>Şifre</Text>
          <View style={styles.passwordContainer}>
            <TextInput
              style={[styles.input, styles.passwordInput]}
              value={password}
              onChangeText={(text) => {
                setPassword(text);
                if (errorMessage) setErrorMessage(null);
              }}
              placeholder="Şifreniz"
              placeholderTextColor={Colors.textDisabled}
              secureTextEntry={!showPassword}
              autoCapitalize="none"
              autoCorrect={false}
              editable={!loading}
            />
            <TouchableOpacity
              style={styles.eyeButton}
              onPress={() => setShowPassword((prev) => !prev)}
              activeOpacity={0.7}
              accessibilityLabel={showPassword ? "Şifreyi gizle" : "Şifreyi göster"}
            >
              <Text style={styles.eyeIcon}>{showPassword ? "🙈" : "👁️"}</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.buttonWrapper}>
            <BigButton
              title="Giriş Yap"
              onPress={handleLogin}
              variant="primary"
              size="lg"
              loading={loading}
              disabled={loading}
            />
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  keyboardView: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  container: {
    flexGrow: 1,
    padding: Spacing.xl,
    justifyContent: "center",
  },
  header: {
    alignItems: "center",
    marginBottom: Spacing.xxl,
  },
  icon: {
    fontSize: 56,
    marginBottom: Spacing.md,
  },
  title: {
    fontSize: FontSize.xl,
    fontWeight: "800",
    color: Colors.textPrimary,
    textAlign: "center",
    marginBottom: Spacing.xs,
  },
  subtitle: {
    fontSize: FontSize.md,
    color: Colors.textSecondary,
    textAlign: "center",
    lineHeight: 28,
  },
  errorBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#3A1010",
    borderColor: Colors.danger,
    borderWidth: 1,
    borderRadius: Radius.md,
    padding: Spacing.lg,
    marginBottom: Spacing.xl,
    gap: Spacing.md,
  },
  errorIcon: {
    fontSize: 24,
  },
  errorText: {
    flex: 1,
    fontSize: FontSize.md,
    color: "#FFA198",
    fontWeight: "600",
    lineHeight: 26,
  },
  form: {
    width: "100%",
  },
  label: {
    fontSize: FontSize.md,
    fontWeight: "700",
    color: Colors.textPrimary,
    marginBottom: Spacing.sm,
  },
  input: {
    height: 64,
    backgroundColor: Colors.surface,
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.lg,
    fontSize: FontSize.md,
    color: Colors.textPrimary,
  },
  passwordContainer: {
    position: "relative",
    justifyContent: "center",
  },
  passwordInput: {
    paddingRight: 64,
  },
  eyeButton: {
    position: "absolute",
    right: 8,
    height: 48,
    width: 48,
    alignItems: "center",
    justifyContent: "center",
  },
  eyeIcon: {
    fontSize: 24,
  },
  buttonWrapper: {
    marginTop: Spacing.xxxl,
  },
});
