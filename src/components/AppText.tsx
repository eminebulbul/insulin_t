import React from "react";
import {
  Text as RNText,
  TextProps as RNTextProps,
  StyleSheet,
  TextStyle,
} from "react-native";
import { useFontSize } from "@/context/FontSizeContext";
import { FontSize } from "@/constants/theme";

export interface AppTextProps extends RNTextProps {
  style?: TextStyle | (TextStyle | undefined | null | false)[];
}

/**
 * AppText — Proje genelinde kullanılması zorunlu metin bileşeni.
 * - allowFontScaling={false} ile sistem font ölçeklemesi devre dışıdır.
 * - Yazı boyutunu FontSizeContext'teki cihaz çarpanına göre ölçekler.
 */
export function AppText({ style, children, ...rest }: AppTextProps) {
  const { scale } = useFontSize();

  const flatStyle = StyleSheet.flatten(style) || {};
  const baseSize = flatStyle.fontSize ?? FontSize.md;
  const scaledSize = Math.round(baseSize * scale);

  const scaledStyle: TextStyle = {
    ...flatStyle,
    fontSize: scaledSize,
  };

  if (flatStyle.lineHeight) {
    scaledStyle.lineHeight = Math.round(flatStyle.lineHeight * scale);
  }

  return (
    <RNText {...rest} allowFontScaling={false} style={scaledStyle}>
      {children}
    </RNText>
  );
}
