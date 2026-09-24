// Renk paleti — yüksek kontrast, koyu arka plan
export const Colors = {
  // Arka planlar
  background: "#0D1117",       // Ana arka plan (çok koyu lacivert-siyah)
  surface: "#161B22",          // Kart arka planı
  surfaceAlt: "#1C2128",       // İkincil kart / input arka planı

  // Ana renkler
  primary: "#58A6FF",          // Mavi — birincil butonlar
  primaryDark: "#1F6FEB",      // Koyu mavi — basılı durum
  success: "#3FB950",          // Yeşil — başarı
  warning: "#D29922",          // Sarı — uyarı diyaloğu
  danger: "#F85149",           // Kırmızı — hata / engel

  // Ölçüm renkleri
  glucose: "#F78166",          // Şeker kartı vurgu rengi (turuncu-kırmızı)
  bloodPressure: "#79C0FF",    // Tansiyon kartı vurgu rengi (açık mavi)

  // Metin
  textPrimary: "#E6EDF3",      // Ana metin (neredeyse beyaz)
  textSecondary: "#8B949E",    // İkincil / açıklama metni
  textDisabled: "#484F58",     // Devre dışı metin

  // Sınır / ayraçlar
  border: "#30363D",           // Kart sınırı
  borderFocused: "#58A6FF",    // Odaklanmış input sınırı

  // Meal tag butonları (seçili durum)
  tagSelected: "#1F6FEB",
  tagSelectedText: "#FFFFFF",
  tagUnselected: "#1C2128",
  tagUnselectedText: "#8B949E",
};

// Font boyutları — yaşlı kullanıcı için büyük
export const FontSize = {
  xs: 14,
  sm: 16,
  md: 20,    // Minimum kullanılabilir boyut
  lg: 24,
  xl: 28,
  xxl: 36,
  display: 48,
};

// Boşluklar
export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
};

// Köşe yarıçapları
export const Radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
};

// Buton yükseklikleri — tek elle kullanım için
export const ButtonHeight = {
  sm: 48,   // Küçük / ikincil
  md: 60,   // Standart
  lg: 72,   // Ana eylem (KAYDET gibi)
};
