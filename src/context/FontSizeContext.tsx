import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

export type FontSizeLevel = "small" | "normal" | "large" | "extra_large";

export const FONT_SCALE_MAP: Record<FontSizeLevel, number> = {
  small: 0.85,
  normal: 1.0,
  large: 1.2, // Varsayılan (yaşlı kullanıcı için hedef başlangıç)
  extra_large: 1.4,
};

export const FONT_LEVEL_LABELS: Record<FontSizeLevel, { title: string; subtitle: string }> = {
  small: { title: "Küçük", subtitle: "0.85x" },
  normal: { title: "Normal", subtitle: "1.0x" },
  large: { title: "Büyük", subtitle: "1.2x" },
  extra_large: { title: "Çok Büyük", subtitle: "1.4x" },
};

const STORAGE_KEY = "@app_font_size_level";

interface FontSizeContextType {
  level: FontSizeLevel;
  scale: number;
  setLevel: (lvl: FontSizeLevel) => Promise<void>;
  scaleFont: (baseSize: number) => number;
  isLoaded: boolean;
}

const FontSizeContext = createContext<FontSizeContextType>({
  level: "large",
  scale: 1.2,
  setLevel: async () => {},
  scaleFont: (b: number) => Math.round(b * 1.2),
  isLoaded: false,
});

export function FontSizeProvider({ children }: { children: ReactNode }) {
  const [level, setLevelState] = useState<FontSizeLevel>("large");
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const saved = await AsyncStorage.getItem(STORAGE_KEY);
        if (
          saved &&
          (saved === "small" ||
            saved === "normal" ||
            saved === "large" ||
            saved === "extra_large")
        ) {
          setLevelState(saved as FontSizeLevel);
        }
      } catch (err) {
        console.warn("Kayıtlı yazı boyutu okunamadı, varsayılan (büyük) kullanılıyor:", err);
      } finally {
        setIsLoaded(true);
      }
    })();
  }, []);

  const setLevel = useCallback(async (newLevel: FontSizeLevel) => {
    try {
      setLevelState(newLevel);
      await AsyncStorage.setItem(STORAGE_KEY, newLevel);
    } catch (err) {
      console.error("Yazı boyutu AsyncStorage'a kaydedilemedi:", err);
    }
  }, []);

  const scale = FONT_SCALE_MAP[level] ?? 1.2;

  const scaleFont = useCallback(
    (baseSize: number) => Math.round(baseSize * scale),
    [scale]
  );

  return (
    <FontSizeContext.Provider
      value={{
        level,
        scale,
        setLevel,
        scaleFont,
        isLoaded,
      }}
    >
      {children}
    </FontSizeContext.Provider>
  );
}

export function useFontSize() {
  const context = useContext(FontSizeContext);
  if (!context) {
    throw new Error("useFontSize must be used within a FontSizeProvider");
  }
  return context;
}
