/**
 * DemoScript — デモモード（?demo）の台本エンジン
 *
 * Gemini の呼び出しをペルソナパックの demo.json に差し替える。それ以外
 * （表情・背景・候補タグの解析、ページ送り、立ち絵の描画）は本番と同じ
 * パイプラインをそのまま通す。「体験は本物、LLMだけスタブ」が設計方針。
 *
 * 台本の口調は人格に属するので、demo.json はコードではなくパックが持つ
 * （persona-pack-spec §1）。パックに demo.json が無ければ内蔵の汎用台本で動く。
 *
 * ルーティングは「返信候補ボタンの文言 → ノードid」の完全一致のみ。
 * 自由入力には fallback を返す。賢くしない（賢い返事は本番の仕事）。
 *
 * 依存: js/core/config.js (DEMO_MODE, PERSONA_DIR),
 *       js/ui/ai-chat.js（showAiReply / chatHistory。panel-ai.html で本ファイルより先にロードされる）
 */

/** demo.json がパックに無いときの汎用台本（人格の口調に依存しない最小限） */
const DEMO_FALLBACK_SCRIPT = {
  start: 'intro',
  routes: { '何ができるの？': 'features', 'もう一度最初から': 'intro' },
  nodes: {
    intro: '[表情:happy]ようこそ、デモモードです。APIキーなしでアバターの表情や会話の操作感を体験できます。[候補:何ができるの？|もう一度最初から]',
    features: '[表情:neutral]本番ではAIが日記やタスクを読み書きします。[表情:gentle]デモでは何も保存されないので、安心して触ってください。[候補:もう一度最初から|何ができるの？]'
  },
  fallback: '[表情:worried]デモモードでは決まった返事しかできません。[表情:happy]下のボタンから選んでください。[候補:何ができるの？|もう一度最初から]'
};

/** 返答までの擬似的な間（ms）。即答だと「考えています…」が点滅して見えるため少し待つ */
const DEMO_REPLY_DELAY = 700;

window.DemoScript = {
  _data: null,
  _loading: null,

  /** demo.json を読む。無い・壊れているときは内蔵台本に落ちる */
  load() {
    if (this._loading) return this._loading;
    this._loading = (async () => {
      try {
        const res = await fetch(`${PERSONA_DIR}demo.json`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        if (!json.nodes || !json.start) throw new Error('demo.json に nodes / start がありません');
        this._data = json;
      } catch (e) {
        console.warn('demo.json が読めないため内蔵の汎用台本で動きます:', e);
        this._data = DEMO_FALLBACK_SCRIPT;
      }
      return this._data;
    })();
    return this._loading;
  },

  /** デモの導入。台本の start ノードを表示する */
  async start() {
    const d = await this.load();
    const intro = d.nodes[d.start] || DEMO_FALLBACK_SCRIPT.nodes.intro;
    showAiReply(intro);
    chatHistory.push({ role: 'assistant', content: intro });
  },

  /** ユーザー発話に対する台本の返答。候補文言に一致しなければ fallback */
  async reply(userText) {
    const d = await this.load();
    const id = (d.routes || {})[String(userText || '').trim()];
    const text = (id && d.nodes[id]) || d.fallback || DEMO_FALLBACK_SCRIPT.fallback;
    await new Promise(r => setTimeout(r, DEMO_REPLY_DELAY));
    return text;
  }
};

// ---- デモモードの起動 ----
// panel-ai.html のスクリプトは html-loader が順次実行するため、
// この時点で ai-chat.js（showAiReply / chatHistory / initSession）は定義済み。
if (window.DEMO_MODE) {
  // 画面上部にデモであることを常時表示する
  const banner = document.createElement('div');
  banner.className = 'demo-banner';
  banner.innerHTML = '🎬 デモモード — 会話は台本で、データはどこにも保存されません '
    + `<a href="${location.pathname}">本セットアップで使う</a>`;
  document.body.prepend(banner);

  DemoScript.start().catch(e => console.warn('デモ台本の開始に失敗しました:', e));
}
