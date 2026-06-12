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
  apiKey: "AIzaSyAyKaRITuz6OunyFTBY-sDhOKydLhGTtzA",
  authDomain: "flipse7en-dc95a.firebaseapp.com",
  projectId: "flipse7en-dc95a",
  storageBucket: "flipse7en-dc95a.firebasestorage.app",
  messagingSenderId: "770730693048",
  appId: "1:770730693048:web:874c6022c24c4592cf3f4d",
  measurementId: "G-G5LECYTLMV"
};

// apiKey doluysa hesap sistemi aktifleşir; boşken oyun eskisi gibi girişsiz çalışır.
export const isFirebaseConfigured = !!firebaseConfig.apiKey;
