# Sağlık Takip 💊

Diyabet hastası için kişisel kullanım mobil uygulaması.  
Kan şekeri, tansiyon ve su takibi — tamamen çevrimdışı, veriler yalnızca cihazda.

> **Kapsam dışı:** Tıbbi tavsiye, doz hesaplama, bulut senkronizasyonu.  
> Uygulama yalnızca kaydeder ve kullanıcının tanımladığı planı hatırlatır.

---

## Özellikler

| Faz | Durum | Açıklama |
|-----|-------|----------|
| Faz 1 | ✅ Tamamlandı | Şeker / Tansiyon / Su girişi, JSON+CSV yedek |
| Faz 2 | ✅ Tamamlandı | Geçmiş: katlanabilir günlük kartlar + çizgi/bar grafik |
| Faz 3 | 🔲 Planlandı | Hatırlatmalar (expo-notifications) |
| Faz 4 | 🔲 Planlandı | Doktor özeti PDF |

---

## Teknik Yığın

- **React Native + Expo** (managed workflow, SDK 57)
- **expo-router** — dosya tabanlı navigasyon
- **expo-sqlite** — yerel SQLite veritabanı, backend yok
- **react-native-chart-kit** — SVG tabanlı grafikler
- **TypeScript** — strict mod

---

## Kurulum

```bash
# Bağımlılıkları yükle
npm install

# iOS Simulator
npx expo run:ios

# Android Emulator / cihaz
npx expo run:android
```

> `react-native-svg` ve `@react-native-community/datetimepicker` native modül içerir.  
> **Expo Go desteklenmez** — `expo run:*` veya EAS Build kullanılmalıdır.

---

## EAS Build (APK üretimi)

```bash
# Giriş yap (bir kez)
npx eas-cli@latest login

# Preview APK (mağazasız dağıtım)
npx eas-cli@latest build --profile preview --platform android
```

`eas.json` dosyasını oluşturduktan sonra aşağıdaki profili ekle:

```json
{
  "build": {
    "preview": {
      "android": {
        "buildType": "apk"
      }
    }
  }
}
```

---

## Klasör Yapısı

```
app/                    # expo-router sayfaları
├── _layout.tsx         # Root layout + DB init + Tab navigasyon
├── index.tsx           # Ana giriş ekranı (Şeker / Tansiyon / Su)
├── history.tsx         # Geçmiş: Liste + Grafik sekmeleri
├── reminders.tsx       # Hatırlatmalar (Faz 3)
└── export.tsx          # JSON / CSV / PDF dışa aktarma

src/
├── db/
│   ├── schema.ts       # SQLite şema + migration (user_version tabanlı)
│   └── queries.ts      # Type-safe CRUD + grafik sorguları
├── components/
│   └── BigButton.tsx   # Erişilebilir büyük buton
├── constants/
│   └── theme.ts        # Renk, font, spacing sabitleri
└── utils/
    ├── validation.ts   # 2 katmanlı doğrulama (sert engel + aralık uyarısı)
    ├── timeHelpers.ts  # Saat çözümleme (dün/bugün mantığı)
    ├── dateHelpers.ts  # Türkçe tarih formatlama
    └── export.ts       # JSON + CSV dışa aktarma
```

---

## Veritabanı Şeması

### `measurements`
Her satır **tek bir ölçüm türü** (`glucose` veya `blood_pressure`).  
Tip ile uyumlu alanlar CHECK constraint ile zorunlu kılınmıştır.

| Kolon | Tip | Açıklama |
|-------|-----|----------|
| `id` | INTEGER PK | Otomatik artan |
| `recorded_at` | TEXT | ISO 8601 timestamp |
| `type` | TEXT | `glucose` \| `blood_pressure` |
| `meal_tag` | TEXT | Sadece glucose: `aclik` / `tokluk` / `yatmadan_once` / `diger` |
| `glucose_mg` | INTEGER | Şeker (mg/dL) |
| `glucose_note` | TEXT | Şekere özel not |
| `bp_systolic` | INTEGER | Büyük tansiyon |
| `bp_diastolic` | INTEGER | Küçük tansiyon |
| `bp_note` | TEXT | Tansiyona özel not |

### `water_log`
| Kolon | Tip | Açıklama |
|-------|-----|----------|
| `id` | INTEGER PK | |
| `recorded_at` | TEXT | ISO 8601 timestamp |
| `water_ml` | INTEGER | İçilen su (ml) |

---

## Doğrulama Mantığı

İki katmanlı, tıbbi yorum içermeyen:

1. **Sert engel** — boş / sayı değil / ≤ 0 / küçük tansiyon ≥ büyük
2. **Onay diyaloğu** — aralık dışı değer: `"X girdiniz, doğru mu?"`
   - Şeker: 20–600 mg/dL dışı
   - Büyük tansiyon: 50–300 dışı
   - Küçük tansiyon: 20–200 dışı

---

## Katkı

Bu kişisel kullanım için yapılmış bir projedir, mağazaya yayınlanmayacaktır.  
Pull request beklenmemektedir, ancak hata bildirimleri memnuniyetle karşılanır.
