/**
 * Config Domain Service
 * 依存関係: js/storage/config-repository.js
 */

window.ConfigService = {
  data: {
    links: [],
    kintaiUrl: '',
    pillars: [],
    showCalendar: true
  },

  /**
   * アプリ起動時の初期化
   */
  async init() {
    let config;
    try {
      config = await ConfigRepository.loadConfig();
    } catch (e) {
      if (e instanceof GitHubAuthError) {
        this._showAuthError();
        this.data = { ...this.data, ...this._getFromLocalStorage() };
        return;
      }
      throw e;
    }

    if (config) {
      // ロードしたデータで上書きしつつ、欠落しているフィールドは localStorage から補完（移行用）
      this.data = {
        ...this.data,
        ...this._getFromLocalStorage(), // 優先度低
        ...config                       // 優先度高
      };
      // 補完が発生した可能性があるため一度保存
      try {
        await this.updateConfig({}, '⚙️ 設定同期と補完');
      } catch (e) {
        if (e instanceof GitHubAuthError) this._showAuthError();
      }
    } else {
      // 完全新規: localStorage から移行
      await this.migrateFromLocalStorage();
    }
  },

  /**
   * localStorage から現在の設定値を取得する（互換用）
   * 存在する値のみをオブジェクトにして返す
   */
  _getFromLocalStorage() {
    const map = {
      links: () => JSON.parse(localStorage.getItem('all_links_v2')),
      kintaiUrl: () => localStorage.getItem('kintai_sheet_url'),
      pillars: () => JSON.parse(localStorage.getItem('pillars_config_v1')),
    };

    const result = {};
    for (const [key, getter] of Object.entries(map)) {
      try {
        const val = getter();
        if (val !== null && val !== undefined) result[key] = val;
      } catch (e) {}
    }
    return result;
  },

  /**
   * 設定値を更新して保存する
   */
  async updateConfig(updates, message) {
    this.data = { ...this.data, ...updates };
    await ConfigRepository.saveConfig(this.data, message);
    this._syncToLocalStorage();
    window.dispatchEvent(new Event('portal-config-loaded'));
  },

  /**
   * localStorage 依存の既存機能との互換性維持
   */
  _syncToLocalStorage() {
    localStorage.setItem('all_links_v2', JSON.stringify(this.data.links));
    localStorage.setItem('kintai_sheet_url', this.data.kintaiUrl);
    localStorage.setItem('pillars_config_v1', JSON.stringify(this.data.pillars));
  },

  /**
   * GitHub PAT が無効な場合に画面へ通知する
   */
  _showAuthError() {
    const existing = document.getElementById('portal-auth-error-banner');
    if (existing) return;
    const banner = document.createElement('div');
    banner.id = 'portal-auth-error-banner';
    banner.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:9999;background:#c0392b;color:#fff;padding:10px 16px;font-size:0.85rem;display:flex;align-items:center;gap:12px;';
    banner.innerHTML = `
      <span style="flex:1;">⚠️ GitHub トークンが無効または期限切れです。設定画面でトークンを更新してください。</span>
      <button onclick="if(window.innerWidth<=MOBILE_BREAKPOINT)switchBottomNav('settings');else switchMainTab('settings');" style="background:#fff;color:#c0392b;border:none;padding:4px 10px;border-radius:4px;cursor:pointer;font-weight:bold;">設定を開く</button>
      <button onclick="this.parentElement.remove();" style="background:transparent;color:#fff;border:none;cursor:pointer;font-size:1.1rem;">✕</button>
    `;
    document.body.prepend(banner);
  },

  /**
   * 初回起動時にlocalStorageから移行する
   */
  async migrateFromLocalStorage() {
    console.log('ConfigService: Migrating from localStorage...');
    this.data = {
      links: JSON.parse(localStorage.getItem('all_links_v2') || '[]'),
      kintaiUrl: localStorage.getItem('kintai_sheet_url') || '',
      pillars: JSON.parse(localStorage.getItem('pillars_config_v1') || '[]'),
      showCalendar: true
    };
    try {
      await this.updateConfig({}, '🔧 初期設定作成（localStorage から移行）');
    } catch (e) {
      if (e instanceof GitHubAuthError) this._showAuthError();
      else console.error('設定の保存に失敗しました:', e);
    }
  }
};
