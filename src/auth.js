// FLIP 7 - Hesap ve Kimlik Yönetimi (Firebase Auth + Google ile Giriş)
//
// Takma ad, Firebase Auth kullanıcı profilinin displayName alanında tutulur;
// böylece ayrı bir veritabanına gerek kalmadan her cihazda hesabı takip eder.

import { initializeApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  onAuthStateChanged,
  signOut,
  updateProfile
} from 'firebase/auth';
import { firebaseConfig, isFirebaseConfigured } from './firebaseConfig.js';

// Takma ad sınırı: lobi giriş alanlarının maxlength değeriyle uyumlu
export const NICK_MAX_LENGTH = 12;

export class AuthManager {
  constructor() {
    this.enabled = isFirebaseConfigured;
    this.user = null;
    this.onChange = () => {}; // UI tarafından atanır; her oturum değişiminde tetiklenir

    if (!this.enabled) return;

    const app = initializeApp(firebaseConfig);
    this.auth = getAuth(app);
    this.auth.useDeviceLanguage();

    onAuthStateChanged(this.auth, (user) => {
      this.user = user;
      this.onChange(user);
    });
  }

  isLoggedIn() {
    return !!this.user;
  }

  async loginWithGoogle() {
    const provider = new GoogleAuthProvider();
    await signInWithPopup(this.auth, provider);
  }

  async logout() {
    await signOut(this.auth);
  }

  // Hesaba bağlı takma adı günceller (tüm cihazlarda geçerli olur)
  async setNickname(nick) {
    if (!this.auth || !this.auth.currentUser) return;
    const clean = nick.trim().substring(0, NICK_MAX_LENGTH);
    if (!clean) return;
    await updateProfile(this.auth.currentUser, { displayName: clean });
    this.user = this.auth.currentUser;
    this.onChange(this.user);
  }

  getNickname() {
    if (!this.user) return null;
    return (this.user.displayName || 'Oyuncu').substring(0, NICK_MAX_LENGTH);
  }

  getAvatarUrl() {
    return this.user ? this.user.photoURL : null;
  }
}

export default AuthManager;
