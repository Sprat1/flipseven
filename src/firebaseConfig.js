// FLIP 7 - Firebase Web Uygulaması Yapılandırması
//
// KURULUM (yaklaşık 5 dakika):
// 1. https://console.firebase.google.com → "Proje oluştur" (ör. flip7-arena)
// 2. Proje açılınca: Build → Authentication → "Get started"
//    → Sign-in method sekmesi → Google → Etkinleştir → Kaydet
// 3. Authentication → Settings → Authorized domains → "Add domain"
//    → sprat1.github.io ekle (localhost zaten ekli gelir)
// 4. Proje Ayarları (dişli ikon) → "Your apps" → Web uygulaması ekle (</> ikonu)
//    → çıkan firebaseConfig nesnesindeki değerleri aşağıya yapıştır
//
// Not: Bu değerler gizli DEĞİLDİR (istemci tarafı proje kimliğidir);
// commit edilip GitHub'da görünmesi güvenlik sorunu yaratmaz.
export const firebaseConfig = {
  apiKey: "",
  authDomain: "",
  projectId: "",
  storageBucket: "",
  messagingSenderId: "",
  appId: ""
};

// apiKey doluysa hesap sistemi aktifleşir; boşken oyun eskisi gibi girişsiz çalışır.
export const isFirebaseConfigured = !!firebaseConfig.apiKey;
