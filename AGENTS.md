This is an Expo/React Native mobile application. Prioritize mobile-first patterns, performance, and cross-platform compatibility.

## Expo has changed — do not trust your training data

Expo ships breaking changes every SDK release. APIs you remember are likely renamed, moved, or removed. Before writing any code that touches an Expo, EAS, or React Native API:

1. Read the major version of the `expo` package in `package.json`.
2. Fetch the matching versioned docs: `https://docs.expo.dev/versions/v<major>.0.0/`
3. For anything else, fetch https://docs.expo.dev/llms.txt — an index of all Expo docs with corrections to common LLM misconceptions. Follow its links to the specific page you need; never answer from memory.

## Commands

```bash
npx expo install <package>  # ALWAYS use instead of npm/yarn — resolves SDK-compatible versions
npx expo start --dev-client # start the dev server (Expo Go does NOT work — see Native Modules below)
npx expo lint                # lint
npx tsc --noEmit             # typecheck
npx expo-doctor              # diagnose dependency and config issues
npx expo install --fix       # fix incompatible package versions
```

Run lint and typecheck before declaring any task done.

## Navigation & Routing

- Use **Expo Router** for all navigation. Routes live in **`app/` at the project root** (NOT `src/app/`) — every file there is a screen, `_layout.tsx` files define navigators.
- Business logic lives under `src/`: `src/db` (schema + queries/Firestore access), `src/components`, `src/utils`, `src/constants`.
- Import `Link`, `router`, and `useLocalSearchParams` from `expo-router`.
- Docs: https://docs.expo.dev/router/introduction.md

## Native Modules & Development Builds

- **Expo Go does not work for this project.** It's SDK 53+ on Android, where `expo-notifications` (a core feature here) is unsupported in Expo Go. Development builds are mandatory from Faz 3 onward.
- If `ios/` and `android/` directories do not exist, they are generated (Continuous Native Generation). Never create or edit them by hand — configure native behavior in `app.json` and config plugins.
- After adding ANY library with native code (svg, notifications, firebase, etc.), a **new development build** is required: `eas build --profile development` (this project builds Android only, no iOS). `npx expo install` alone is NOT enough for native modules — this has bitten us repeatedly.
- Prefer recommended Expo modules over third-party libraries, and check available skills before adding dependencies. Docs: https://docs.expo.dev/versions/latest/index.md

## Building & Distribution with EAS

- `eas build -p android --profile development` — for testing on the developer's own phone (dev-client, connects to Metro)
- `eas build -p android --profile preview` — final standalone APK for distribution to family phones
- **No app store, no TestFlight, no iOS.** Android only, side-loaded APK to 4 phones. No OTA update plan — this is a one-time install after the project is finished.
- Docs: https://docs.expo.dev/eas/index.md

---

# Proje: Diyabet Takip Uygulaması

## Amaç
Babaanne için kişisel sağlık takip uygulaması. Kişisel kullanım, mağazaya
YAYINLANMIYOR. 4 Android telefona (kullanıcı, halası, babası, babaannesi)
EAS ile üretilen APK olarak kurulacak.

## Kullanıcı Profili
Yaşlı kullanıcı: büyük yazı (min 20px), büyük butonlar (min 60px), yüksek
kontrast koyu tema, sade Türkçe arayüz.

## Teknik Yığın (bu projeye özel kararlar)
- Bulut: **@react-native-firebase** (Auth + Firestore) — DİKKAT: düz `firebase`
  JS SDK KULLANMA, React Native'de offline persistence güvenilir değil
- PDF/paylaşım: expo-print + expo-sharing (Faz 4, henüz yapılmadı)
- Grafik: react-native-chart-kit (victory-native DEĞİL — Skia tabanlı,
  ekstra native bağımlılık gerektiriyor, gereksiz)

## Veri Modeli (Firestore koleksiyonları)
- **measurements**: type (glucose/blood_pressure), meal_tag (sadece glucose
  için), glucose_mg, bp_systolic, bp_diastolic, glucose_note, bp_note,
  recorded_at, created_at
- **water_log**: recorded_at, water_ml, created_at
- **reminders**: label, category (insulin/measurement), insulin_color
  (turuncu/gri, sadece insulin için zorunlu), hour, minute, days_of_week
  (Firestore native array, [1,3,5] gibi — 1=Pazartesi), is_active, created_at.
  notification_ids Firestore'a YAZILMAZ, her cihaz kendi bildirimini
  kendi AsyncStorage'ında tutar.

## Kapsam Dışı (yapılmayacaklar)
- Tıbbi tavsiye, doz hesaplama, "şunu yap" yönlendirmesi — uygulama sadece
  kaydeder ve kullanıcının girdiği planı hatırlatır
- Tansiyon hatırlatması yok (sadece insülin ve ölçüm hatırlatması var)
- Hesap oluşturma / şifremi unuttum akışı yok — tek aile hesabı, Firebase
  konsolunda elle oluşturuldu
- SQLite kalktı (Faz 3.5 itibarıyla) — tek veri kaynağı Firestore

## Bilinen Tuzaklar (tekrar düşmemek için)
- expo-notifications WEEKLY trigger'da weekday: 1=Pazar (bizim şemada
  1=Pazartesi) — dönüşüm formülü: `ourDay === 7 ? 1 : ourDay + 1`
- Android bildirim kanalı (importance MAX) ve SCHEDULE_EXACT_ALARM izni
  (Android 12+) olmadan bildirimler saatinde/hiç gelmeyebilir
- Bildirim kanalı `sound` alanına `'default'` YAZMA — gerçek dosya arar,
  alanı boş bırak
- `onSnapshot` sık tetiklenir (her açılışta bile) — hatırlatma senkronunda
  gerçekten değişiklik olup olmadığını kontrol etmeden bildirimi yeniden
  kurma, çift bildirim riski var

## Font Ölçekleme Kuralı
- Projede ASLA ham `Text`/`TextInput` (react-native'den) kullanılmaz, her zaman `src/components/AppText.tsx` ve `AppTextInput.tsx` kullanılır.
- Her AppText çağrısında fontSize açıkça belirtilmeli (theme.ts token'ları üzerinden) — belirtilmezse font ölçekleme çarpanı uygulanamaz.

## Çalışma Kuralları
- Bir seferde sadece istenen faz/dosyalar değiştirilir. Kapsam dışına
  çıkmak gerekiyorsa yapmadan önce sor.
- Kodlamadan önce plan çıkar, onay bekle.
- Varsayım yapman gerekiyorsa listele ya da sor.
- Faz sonunda: ne değişti, nasıl test edilir, hangi kenar durumları
  denenmeli — bunları listele.

## Faz Geçmişi
1. Giriş ekranı (şeker/tansiyon/su, SQLite) ✅
2. Geçmiş ekranı (kart listesi + grafik) ✅
3. Hatırlatmalar (insülin/ölçüm, bildirim kanalı, exact alarm) ✅ test edildi
3.5. Bulut senkronizasyonu (Firestore, canlı senkron) ✅ tamamlandı
4. PDF/paylaşılabilir doktor özeti ✅ tamamlandı
4.5. Ölçüm kayıtlarını düzenleme ve silme ✅ tamamlandı
4.6. Uygulama içi font boyutu ayarı (AppText/AppTextInput, 4 seviye) ✅ tamamlandı
5. Sadeleştirme turu + gerçek kullanıcı testi — henüz yapılmadı
6. Dağıtım (4 telefona APK) 🔄 şu an bunun üzerinde çalışılıyor


- Firestore sorgusunda birden fazla alan (where + orderBy, ya da iki
  where) birlikte kullanılınca composite index gerekir. Hata mesajındaki
  linke tıklayıp Console'da "Create Index"e basmak yeterli, ama mümkünse
  az sayıda kayıt olan koleksiyonlarda (reminders gibi) filtrelemeyi
  istemci tarafında yapmak bu index beklemesini önler.