/**
 * Persistence Layer: GitHub API Storage
 * 依存関係: js/config.js (getRepo, getBranch), js/settings.js (getToken), js/utils.js (encodeUtf8Base64)
 */

class GitHubAuthError extends Error {
  constructor(message) {
    super(message);
    this.name = 'GitHubAuthError';
  }
}
window.GitHubAuthError = GitHubAuthError;

window.GitHubStorage = {
  /**
   * ファイルの内容を取得する
   * @param {string} path - リポジトリ内のパス
   * @returns {Promise<{content: string, sha: string, path: string} | null>}
   */
  async getFile(path) {
    const token = getToken();
    const repo = getRepo();
    if (!token || !repo) throw new Error('GitHub PAT またはリポジトリが設定されていません');

    const encPath = path.split('/').map(encodeURIComponent).join('/');
    const res = await fetch(`https://api.github.com/repos/${repo}/contents/${encPath}?ref=${getBranch()}`, {
      headers: { 
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json'
      }
    });

    if (!res.ok) {
      if (res.status === 404) return null;
      const err = await res.json().catch(() => ({}));
      if (res.status === 401 || res.status === 403) {
        throw new GitHubAuthError(err.message || `HTTP ${res.status}`);
      }
      throw new Error(err.message || `HTTP ${res.status}`);
    }

    const data = await res.json();
    const raw = atob(data.content.replace(/\n/g, ''));
    const content = new TextDecoder('utf-8').decode(Uint8Array.from(raw, c => c.charCodeAt(0)));
    
    return {
      content,
      sha: data.sha,
      path: data.path
    };
  },

  /**
   * ファイルを保存（作成・更新）する
   * @param {string} path - 保存先のパス
   * @param {string} content - 内容
   * @param {string} message - コミットメッセージ
   * @returns {Promise<Object>} APIレスポンス
   */
  async saveFile(path, content, message = 'Update file via Portal') {
    const token = getToken();
    const repo = getRepo();
    if (!token || !repo) throw new Error('GitHub PAT またはリポジトリが設定されていません');

    const encPath = path.split('/').map(encodeURIComponent).join('/');
    const url = `https://api.github.com/repos/${repo}/contents/${encPath}`;
    const encodedContent = encodeUtf8Base64(content);

    const attemptSave = async () => {
      // 毎回最新の SHA を取得（リトライ時も含む）
      let sha;
      try {
        const existing = await this.getFile(path);
        if (existing) sha = existing.sha;
      } catch (e) { /* 新規作成 */ }

      const res = await fetch(url, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/vnd.github+json',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          message,
          content: encodedContent,
          branch: getBranch(),
          ...(sha ? { sha } : {})
        })
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        if (res.status === 401 || res.status === 403) throw new GitHubAuthError(err.message || `HTTP ${res.status}`);
        const error = new Error(err.message || `HTTP ${res.status}`);
        error.status = res.status;
        throw error;
      }
      // 書き込み前の SHA を添えて返す（ADR-044）。
      // GitHub は内容が同一でも 200 と commit を返す（＝空コミットができる）ため、
      // 「commit が返ったか」だけでは中身が変わったか判別できない。
      // blob の SHA は内容が同じなら変わらないので、呼び出し側はこれと突き合わせる。
      const json = await res.json();
      return { ...json, previousSha: sha || '' };
    };

    try {
      return await attemptSave();
    } catch (e) {
      // SHA 不一致（409/422）の場合は最新 SHA で1回リトライ
      if (e.status === 409 || e.status === 422) {
        console.warn('SHA 不一致のためリトライします:', e.message);
        return await attemptSave();
      }
      throw e;
    }
  },

  /**
   * ファイルを削除する（日記の月次まとめで日別ファイルを畳むときに使う / ADR-035）
   * @param {string} path - 削除対象のパス
   * @param {string} message - コミットメッセージ
   * @returns {Promise<boolean>} 削除したら true、存在しなければ false
   */
  async deleteFile(path, message = 'Delete file via Portal') {
    const token = getToken();
    const repo = getRepo();
    if (!token || !repo) throw new Error('GitHub PAT またはリポジトリが設定されていません');

    const existing = await this.getFile(path);
    if (!existing) return false;

    const encPath = path.split('/').map(encodeURIComponent).join('/');
    const res = await fetch(`https://api.github.com/repos/${repo}/contents/${encPath}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ message, sha: existing.sha, branch: getBranch() })
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      if (res.status === 401 || res.status === 403) throw new GitHubAuthError(err.message || `HTTP ${res.status}`);
      throw new Error(err.message || `HTTP ${res.status}`);
    }
    return true;
  },

  /**
   * ディレクトリ内のファイル一覧を取得する
   * @param {string} directory - ディレクトリパス
   * @returns {Promise<Array>}
   */
  async listFiles(directory) {
    const token = getToken();
    const repo = getRepo();
    if (!token || !repo) throw new Error('GitHub PAT またはリポジトリが設定されていません');

    const encPath = directory.split('/').map(encodeURIComponent).join('/');
    const res = await fetch(`https://api.github.com/repos/${repo}/contents/${encPath}?ref=${getBranch()}`, {
      headers: { 
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json'
      }
    });

    if (!res.ok) {
      if (res.status === 404) return [];
      if (res.status === 401 || res.status === 403) {
        const err = await res.json().catch(() => ({}));
        throw new GitHubAuthError(err.message || `HTTP ${res.status}`);
      }
      throw new Error(`HTTP ${res.status}`);
    }

    return await res.json();
  }
};
