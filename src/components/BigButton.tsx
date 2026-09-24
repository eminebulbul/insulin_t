import React from "react";
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  ViewStyle,
  TextStyle,
  ActivityIndicator,
} from "react-native";
import { Colors, FontSize, Radius, ButtonHeight } from "@/constants/theme";

interface BigButtonProps {
  title: string;
  onPress: () => void;
  variant?: "primary" | "secondary" | "danger" | "ghost";
  size?: "sm" | "md" | "lg";
  disabled?: boolean;
  loading?: boolean;
  style?: ViewStyle;
}

/**
 * BigButton — uygulamada tek elle kullanım için tasarlanmış büyük buton.
 *
 * Neden ayrı bileşen?
 * Yaşlı kullanıcı için minimum dokunma alanı 60px (WCAG 2.5.5 tavsiyesi).
 * Tüm butonlarda tutarlı boyut ve kontrast sağlamak için merkezi bir bileşen.
 */
export function BigButton({
  title,
  onPress,
  variant = "primary",
  size = "md",
  disabled = false,
  loading = false,
  style,
}: BigButtonProps) {
  const containerStyle: ViewStyle[] = [
    styles.base,
    styles[`size_${size}`],
    styles[`variant_${variant}`],
    disabled || loading ? styles.disabled : {},
    style ?? {},
  ];

  const textStyle: TextStyle[] = [
    styles.text,
    styles[`textSize_${size}`],
    styles[`textVariant_${variant}`],
    disabled ? styles.textDisabled : {},
  ];

  return (
    <TouchableOpacity
      style={containerStyle}
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.75}
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityState={{ disabled: disabled || loading }}
    >
      {loading ? (
        <ActivityIndicator
          color={variant === "primary" ? "#FFF" : Colors.primary}
          size="small"
        />
      ) : (
        <Text style={textStyle}>{title}</Text>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: Radius.md,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
  },

  // Boyutlar
  size_sm: { height: ButtonHeight.sm, paddingHorizontal: 16 },
  size_md: { height: ButtonHeight.md, paddingHorizontal: 20 },
  size_lg: { height: ButtonHeight.lg, paddingHorizontal: 24 },

  // Varyantlar
  variant_primary: { backgroundColor: Colors.primary },
  variant_secondary: {
    backgroundColor: Colors.surfaceAlt,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  variant_danger: { backgroundColor: Colors.danger },
  variant_ghost: {
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: Colors.primary,
  },

  disabled: { opacity: 0.4 },

  // Metin boyutları
  text: { fontWeight: "700", letterSpacing: 0.3 },
  textSize_sm: { fontSize: FontSize.sm },
  textSize_md: { fontSize: FontSize.md },
  textSize_lg: { fontSize: FontSize.lg },

  // Metin renkleri
  textVariant_primary: { color: "#FFFFFF" },
  textVariant_secondary: { color: Colors.textPrimary },
  textVariant_danger: { color: "#FFFFFF" },
  textVariant_ghost: { color: Colors.primary },
  textDisabled: { color: Colors.textDisabled },
});
