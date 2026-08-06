/**
 * Secure Store（APIキー・PAT の保存層）
 * ADR-033 決定事項7
 *
 * 3つの機能を提供する。
 *  1. 保存先の切り替え（localStorage / sessionStorage）
 *  2. パスフレーズ + Web Crypto（PBKDF2-SHA256 → AES-GCM）による暗号化保存
 *  3. 復号した平文をメモリ上のキャッシュにのみ置き、同期 API（getToken 等）を維持する
 *
 * ⚠️ セキュリティ上の限界（明示しておく）
 *   これは XSS に対する防御ではない。スクリプト実行を許してしまえば、解錠後は
 *   メモリ上のキャッシュから平文を読み取れる。目的は「端末を放置した際に
 *   DevTools やストレージビューアから平文を読まれるリスクを下げること」に限られる。
 */

window.SecureStore = {
  BACKEND_KEY:  'key_storage_backend',    // 'local' | 'session'
  ENC_FLAG_KEY: 'key_encryption_enabled', // '1' なら暗号化有効
  MANAGED_KEYS: ['gh_pat', 'gemini_api_key'],
  PBKDF2_ITERATIONS: 250000,

  _cache: {},        // { name: 平文 } 解錠後のみ埋まる。永続化しない
  _unlocked: false,

  // ---- 保存先 ----
  backendName() {
    return localStorage.getItem(this.BACKEND_KEY) === 'session' ? 'session' : 'local';
  },
  backend() {
    return this.backendName() === 'session' ? sessionStorage : localStorage;
  },
  /** 保存先を切り替える。現在保持している値を移送する */
  setBackend(name) {
    const next = name === 'session' ? 'session' : 'local';
    if (next === this.backendName()) return;

    const from = this.backend();
    localStorage.setItem(this.BACKEND_KEY, next);
    const to = this.backend();

    this.MANAGED_KEYS.forEach(k => {
      [k, `${k}_enc`].forEach(actual => {
        const v = from.getItem(actual);
        if (v !== null) { to.setItem(actual, v); from.removeItem(actual); }
      });
    });
  },

  // ---- 暗号化状態 ----
  isEncrypted() { return localStorage.getItem(this.ENC_FLAG_KEY) === '1'; },
  isUnlocked()  { return !this.isEncrypted() || this._unlocked; },

  // ---- 値の読み書き（get は同期） ----
  get(name) {
    if (this.isEncrypted()) {
      return Object.prototype.hasOwnProperty.call(this._cache, name) ? this._cache[name] : null;
    }
    return this.backend().getItem(name);
  },

  async set(name, value) {
    if (this.isEncrypted()) {
      if (!this._unlocked) throw new Error('APIキーがロックされています。先に解錠してください。');
      this._cache[name] = value;
      const payload = await this._encrypt(value);
      this.backend().setItem(`${name}_enc`, payload);
      this.backend().removeItem(name); // 平文が残っていれば消す
      return;
    }
    this.backend().setItem(name, value);
  },

  remove(name) {
    delete this._cache[name];
    [localStorage, sessionStorage].forEach(s => {
      s.removeItem(name);
      s.removeItem(`${name}_enc`);
    });
  },

  // ---- 解錠 / 施錠 ----
  /** パスフレーズで全ての暗号文を復号してキャッシュに載せる */
  async unlock(passphrase) {
    if (!this.isEncrypted()) { this._unlocked = true; return true; }

    const store = this.backend();
    const names = this.MANAGED_KEYS.filter(k => store.getItem(`${k}_enc`) !== null);
    if (names.length === 0) { this._unlocked = true; return true; }

    const cache = {};
    for (const name of names) {
      const plain = await this._decrypt(store.getItem(`${name}_enc`), passphrase);
      if (plain === null) return false; // パスフレーズ不一致
      cache[name] = plain;
    }
    this._cache = { ...this._cache, ...cache };
    this._unlocked = true;
    return true;
  },

  lock() { this._cache = {}; this._unlocked = false; },

  /** 現在の平文を暗号化して保存し直す（暗号化を有効にする） */
  async enableEncryption(passphrase) {
    if (!passphrase) throw new Error('パスフレーズを入力してください');

    // 有効化前の平文を集める
    const current = {};
    this.MANAGED_KEYS.forEach(k => {
      const v = this.get(k);
      if (v !== null && v !== undefined && v !== '') current[k] = v;
    });

    localStorage.setItem(this.ENC_FLAG_KEY, '1');
    this._cache = { ...current };
    this._unlocked = true;
    this._passphrase = passphrase;

    const store = this.backend();
    for (const [k, v] of Object.entries(current)) {
      store.setItem(`${k}_enc`, await this._encrypt(v));
      store.removeItem(k);
    }
    return true;
  },

  /** 暗号化を解除して平文保存に戻す */
  async disableEncryption() {
    if (!this.isEncrypted()) return true;
    if (!this._unlocked) throw new Error('先に解錠してください');

    const plain = { ...this._cache };
    localStorage.removeItem(this.ENC_FLAG_KEY);
    this._passphrase = null;

    const store = this.backend();
    this.MANAGED_KEYS.forEach(k => store.removeItem(`${k}_enc`));
    Object.entries(plain).forEach(([k, v]) => store.setItem(k, v));
    this._unlocked = false;
    return true;
  },

  // ---- Web Crypto ----
  async _deriveKey(passphrase, salt) {
    const material = await crypto.subtle.importKey(
      'raw', new TextEncoder().encode(passphrase), 'PBKDF2', false, ['deriveKey']
    );
    return crypto.subtle.deriveKey(
      { name: 'PBKDF2', salt, iterations: this.PBKDF2_ITERATIONS, hash: 'SHA-256' },
      material,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt']
    );
  },

  async _encrypt(plaintext) {
    if (!this._passphrase) throw new Error('パスフレーズが保持されていません。再度解錠してください。');
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const iv   = crypto.getRandomValues(new Uint8Array(12));
    const key  = await this._deriveKey(this._passphrase, salt);
    const ct   = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv }, key, new TextEncoder().encode(plaintext)
    );
    return JSON.stringify({
      v: 1,
      salt: this._toB64(salt),
      iv:   this._toB64(iv),
      ct:   this._toB64(new Uint8Array(ct))
    });
  },

  /** 復号できなければ null を返す（パスフレーズ不一致・データ破損の区別はしない） */
  async _decrypt(payload, passphrase) {
    try {
      const { salt, iv, ct } = JSON.parse(payload);
      const key   = await this._deriveKey(passphrase, this._fromB64(salt));
      const plain = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: this._fromB64(iv) }, key, this._fromB64(ct)
      );
      this._passphrase = passphrase; // 再暗号化に必要なためメモリ上に保持
      return new TextDecoder().decode(plain);
    } catch (e) {
      return null;
    }
  },

  _toB64(bytes) {
    let bin = '';
    bytes.forEach(b => { bin += String.fromCharCode(b); });
    return btoa(bin);
  },
  _fromB64(b64) {
    return Uint8Array.from(atob(b64), c => c.charCodeAt(0));
  },

  /**
   * 起動時の解錠プロンプト。最大3回まで試行する。
   * ⚠️ prompt() はパスフレーズが画面に平文表示される。専用モーダルにする余地あり。
   */
  async promptUnlock() {
    if (this.isUnlocked()) return true;
    for (let i = 0; i < 3; i++) {
      const pass = prompt(
        i === 0
          ? '🔐 APIキーのパスフレーズを入力してください'
          : `🔐 パスフレーズが違います（残り ${3 - i} 回）`
      );
      if (pass === null) return false; // キャンセル
      if (await this.unlock(pass)) return true;
    }
    alert('解錠できませんでした。設定画面から暗号化を解除するか、キーを再登録してください。');
    return false;
  }
};
