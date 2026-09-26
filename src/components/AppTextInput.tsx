import React, { forwardRef } from "react";
import {
  TextInput as RNTextInput,
  TextInputProps as RNTextInputProps,
  StyleSheet,
  TextStyle,
} from "react-native";
import { useFontSize } from "@/context/FontSizeContext";
import { FontSize } from "@/constants/theme";

export interface AppTextInputProps extends RNTextInputProps {
  style?: TextStyle | (TextStyle | undefined | null | false)[];
}

/**
 * AppTextInput — Proje genelinde kullanılması zorunlu input bileşeni.
 * - allowFontScaling={false} ile sistem font ölçeklemesi devre dışıdır.
 * - Yazı boyutunu FontSizeContext'teki cihaz çarpanına göre ölçekler.
 */
export const AppTextInput = forwardRef<RNTextInput, AppTextInputProps>(
  ({ style, ...rest }, ref) => {
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
      <RNTextInput
        ref={ref}
        {...rest}
        allowFontScaling={false}
        style={scaledStyle}
      />
    );
  }
);

AppTextInput.displayName = "AppTextInput";
