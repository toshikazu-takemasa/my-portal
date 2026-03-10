// =====================
// portal-config.json 同期レイヤー
// クイックリンク・勤怠URL・日の3つの柱 を GitHub JSON で永続化
// =====================
const CONFIG_PATH = 'data/portal-config.json';
const PILLARS_CONFIG_KEY = 'pillars_config_v1';

let portalConfig    = null;  // { links: [...], kintaiUrl: '...' }
let portalConfigSha = '';

// ---- 読み込み ----
async function loadPortalConfig() {
  const token = getToken();
  if (!token || !getRepo()) return;

  const enc = CONFIG_PATH.split('/').map(encodeURIComponent).join('/');
  try {
    const res = await fetch(`https://api.github.com/repos/${getRepo()}/contents/${enc}`, {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json' }
    });

    if (res.ok) {
      const data = await res.json();
      const raw  = atob(data.content.replace(/\n/g, ''));
      const text = new TextDecoder('utf-8').decode(Uint8Array.from(raw, c => c.charCodeAt(0)));
      portalConfig    = JSON.parse(text);
      portalConfigSha = data.sha;

      // localStorage をリモートで上書き（正として扱う）
      if (Array.isArray(portalConfig.links)) {
        localStorage.setItem(LINKS_KEY, JSON.stringify(portalConfig.links));
      }
      if (portalConfig.kintaiUrl) {
        localStorage.setItem(KINTAI_URL_KEY, portalConfig.kintaiUrl);
      }
      if (Array.isArray(portalConfig.pillars) && portalConfig.pillars.length > 0) {
        localStorage.setItem(PILLARS_CONFIG_KEY, JSON.stringify(portalConfig.pillars));
      }

      window.dispatchEvent(new Event('portal-config-loaded'));
    } else if (res.status === 404) {
      // 初回: localStorage から移行してファイルを作成
      await _migrateToPortalConfig();
    }
  } catch (e) {
    console.warn('portal-config 読み込み失敗:', e);
  }
}

// ---- 書き込み（デバウンス付き）----
let _saveTimer = null;
function savePortalConfigDebounced(message) {
  clearTimeout(_saveTimer);
  _saveTimer = setTimeout(() => savePortalConfig(message), 1500);
}

async function savePortalConfig(message = '⚙️ ポータル設定を更新') {
  const token = getToken();
  if (!token || !portalConfig || !getRepo()) return;

  const enc  = CONFIG_PATH.split('/').map(encodeURIComponent).join('/');
  const body = {
    message,
    content: encodeUtf8Base64(JSON.stringify(portalConfig, null, 2))
  };
  if (portalConfigSha) body.sha = portalConfigSha;

  try {
    const res = await fetch(`https://api.github.com/repos/${getRepo()}/contents/${enc}`, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    });
    if (res.ok) {
      const data = await res.json();
      portalConfigSha = data.content.sha;
    }
  } catch (e) {
    console.warn('portal-config 保存失敗:', e);
  }
}

// ---- 初回マイグレーション ----
async function _migrateToPortalConfig() {
  portalConfig = {
    links:     getAllLinks(),
    kintaiUrl: getKintaiUrl(),
    pillars: (() => {
      try {
        const stored = JSON.parse(localStorage.getItem(PILLARS_CONFIG_KEY) || '[]');
        return Array.isArray(stored) ? stored : [];
      } catch {
        return [];
      }
    })()
  };
  await savePortalConfig('🔧 portal-config 初期作成（localStorage から移行）');
}
