/**
 * PersonaState の純関数（parseSections / appendToSection）を検証する。
 *
 * profile.md は毎回のプロンプトに丸ごと載るので、上限の扱いを間違えると
 * トークンが際限なく増える。上限は AI ではなくここで機械的に効かせているため、
 * その挙動を回帰テストで固定しておく。
 */
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const APP = new URL('../portal-app/', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');

const ctx = {
  console, setTimeout, Date, JSON, Math, Promise, Object, Array, String, Error, Number, RegExp,
  addEventListener: () => {},
  getToken: () => '', getRepo: () => '', getJstTodayISO: () => '2026-08-07',
  GitHubStorage: {},
};
ctx.window = ctx;
vm.createContext(ctx);
vm.runInContext(readFileSync(`${APP}js/domains/persona-state.js`, 'utf8'), ctx, { filename: 'persona-state.js' });
const PS = ctx.PersonaState;

let pass = 0, fail = 0;
const check = (name, cond, detail = '') => {
  if (cond) { pass++; console.log(`  OK   ${name}`); }
  else { fail++; console.log(`  FAIL ${name}${detail ? '\n       ' + detail : ''}`); }
};

console.log('=== parseSections ===');
{
  const md = PS.template();
  const s = PS.parseSections(md);
  check('雛形の4見出しを認識する', PS.SECTIONS.every(d => Array.isArray(s[d.name])),
    JSON.stringify(Object.keys(s)));
  check('雛形の各セクションは空', PS.SECTIONS.every(d => s[d.name].length === 0));
}
{
  const md = '# x\n\n## 応答の好み（最大5）\n\n- a\n- b\n\n## 呼び方と距離感（最大3）\n\n- c\n';
  const s = PS.parseSections(md);
  check('（最大N）付き見出しから項目を拾う', s['応答の好み'].join(',') === 'a,b' && s['呼び方と距離感'].join(',') === 'c');
}
{
  const s = PS.parseSections('## 応答の好み（最大5）\r\n\r\n- a\r\n- b\r\n');
  check('CRLF でも壊れない', s['応答の好み'] && s['応答の好み'].join(',') === 'a,b',
    JSON.stringify(s));
}

console.log('\n=== appendToSection ===');
{
  const r = PS.appendToSection('# ユーザー像\n', 'メモ', 'あたらしい', 0);
  check('見出しが無ければ末尾に作る', r.content.includes('## メモ') && r.content.includes('- あたらしい'), r.content);
}
{
  const base = PS.template();
  const r = PS.appendToSection(base, '応答の好み', '前置きが長いと読み飛ばす', 5);
  const s = PS.parseSections(r.content);
  check('既存の空セクションへ追記できる', s['応答の好み'].join(',') === '前置きが長いと読み飛ばす');
  check('他セクションを壊さない', PS.SECTIONS.every(d => Array.isArray(s[d.name])));
  check('落ちた行は無い', r.dropped.length === 0);
}
{
  // 上限3のセクションに4件入れる
  let md = PS.template();
  let dropped = [];
  for (const v of ['a', 'b', 'c', 'd']) {
    const r = PS.appendToSection(md, '呼び方と距離感', v, 3);
    md = r.content; dropped = dropped.concat(r.dropped);
  }
  const s = PS.parseSections(md);
  check('上限を超えない', s['呼び方と距離感'].length === 3, JSON.stringify(s['呼び方と距離感']));
  check('落ちるのは最古から', dropped.join(',') === 'a', JSON.stringify(dropped));
  check('新しいものが残る', s['呼び方と距離感'].join(',') === 'b,c,d', JSON.stringify(s['呼び方と距離感']));
}
{
  // 上限0（日記側）は落とさない
  let md = '# 2026-08-07\n';
  for (const v of ['1', '2', '3', '4', '5', '6']) {
    md = PS.appendToSection(md, '🧠 覚えたこと', v, 0).content;
  }
  const s = PS.parseSections(md);
  check('上限0なら落とさない', s['🧠 覚えたこと'].length === 6, JSON.stringify(s['🧠 覚えたこと']));
  check('日付見出しは残る', md.startsWith('# 2026-08-07'));
}
{
  const base = '## 応答の好み（最大5）\n\n- a\n\n## 触れてほしくないこと（最大5）\n\n- x\n';
  const r = PS.appendToSection(base, '応答の好み', 'b', 5);
  const s = PS.parseSections(r.content);
  check('後続セクションを飲み込まない', s['触れてほしくないこと'].join(',') === 'x', r.content);
  check('対象セクションだけ増える', s['応答の好み'].join(',') === 'a,b');
}
{
  const r = PS.appendToSection(PS.template(), '応答の好み', '   ', 5);
  check('空文字は無視する', PS.parseSections(r.content)['応答の好み'].length === 0);
}

console.log('\n=== filledSections / promptGuide ===');
{
  check('空なら promptGuide は空文字', (PS._profile = '', PS.promptGuide()) === '');
  PS._profile = PS.appendToSection(PS.template(), '応答の好み', '結論を先に', 5).content;
  const g = PS.promptGuide();
  check('中身があれば注入される', g.includes('### 応答の好み') && g.includes('- 結論を先に'), g);
  check('空セクションは載せない', !g.includes('### 呼び方と距離感'), g);
}

// ==========================================================================
// remember() の統合検証。GitHub 側だけ差し替えて、本物のコードを走らせる。
// 純関数のテストでは「2ファイルに書く」「片方が失敗しても片方は成功扱い」が見えない。
// ==========================================================================

/** 疑似 GitHub。saveFile は commit を返し、内容をメモリに持つ */
function fakeGitHub(opts = {}) {
  const files = new Map(Object.entries(opts.initial || {}));
  return {
    files,
    async getFile(path) {
      return files.has(path) ? { content: files.get(path), sha: 'sha-' + path, path } : null;
    },
    async saveFile(path, content) {
      if (opts.failPaths && opts.failPaths.includes(path)) throw new Error(`書き込み失敗: ${path}`);
      files.set(path, content);
      return { commit: { sha: 'c1' }, content: { sha: 'blob' }, previousSha: '' };
    },
  };
}

console.log('\n=== remember()（profile と日記の両方に書く） ===');
{
  const gh = fakeGitHub();
  ctx.GitHubStorage = gh;
  PS._profile = null;

  const r = await PS.remember('前置きが長いと読み飛ばす', '応答の好み');
  const profile = gh.files.get('vault/persona-state/profile.md') || '';
  const diary   = gh.files.get('vault/diary/2026-08-07.md') || '';

  check('ok が返る', r.ok === true, JSON.stringify(r));
  check('profile.md が新規作成される', profile.includes('# ユーザー像'));
  check('指定セクションへ入る', PS.parseSections(profile)['応答の好み'].join(',') === '前置きが長いと読み飛ばす');
  check('日記にも書かれる', diary.includes('🧠 覚えたこと') && diary.includes('前置きが長いと読み飛ばす'), diary);
  check('日記に時刻とセクション名が入る', /- \d{2}:\d{2} .+ → 応答の好み/.test(diary), diary);
  check('日記の日付見出しが作られる', diary.startsWith('# 2026-08-07'), diary);
  check('diaryRecorded が true', r.diaryRecorded === true);
  check('_profile が更新される', PS._profile === profile);
}
{
  // 未知のセクションは弾く（AI が enum を外したとき）
  ctx.GitHubStorage = fakeGitHub();
  const r = await PS.remember('なにか', '好きな食べ物');
  check('未知のセクションは拒否する', r.ok === false && r.error.includes('呼び方と距離感'), JSON.stringify(r));
}
{
  ctx.GitHubStorage = fakeGitHub();
  const r = await PS.remember('   ', '応答の好み');
  check('空の内容は拒否する', r.ok === false);
}
{
  // 上限を超えたら古いものが落ち、そのことが戻り値に出る
  const gh = fakeGitHub();
  ctx.GitHubStorage = gh;
  PS._profile = null;
  let last;
  for (const v of ['1つめ', '2つめ', '3つめ', '4つめ']) last = await PS.remember(v, '呼び方と距離感');
  const items = PS.parseSections(gh.files.get('vault/persona-state/profile.md'))['呼び方と距離感'];
  check('上限3を超えない', items.length === 3, JSON.stringify(items));
  check('落ちた行が戻り値に出る', last.dropped.join(',') === '1つめ', JSON.stringify(last.dropped));
  check('メッセージに落ちたことが書かれる', last.message.includes('落としました'), last.message);
}
{
  // 日記への書き込みが失敗しても profile は成功扱い（記録が主、根拠が従）
  const gh = fakeGitHub({ failPaths: ['vault/diary/2026-08-07.md'] });
  ctx.GitHubStorage = gh;
  PS._profile = null;
  const r = await PS.remember('日記だけ失敗する場合', '応答の好み');
  check('profile は成功する', r.ok === true, JSON.stringify(r));
  check('diaryRecorded が false になる', r.diaryRecorded === false);
  check('メッセージに失敗が出る', r.message.includes('日記への記録は失敗'), r.message);
  check('profile には書かれている',
    PS.parseSections(gh.files.get('vault/persona-state/profile.md'))['応答の好み'].join(',') === '日記だけ失敗する場合');
}
{
  // 既存の日記を壊さない
  const gh = fakeGitHub({ initial: {
    'vault/diary/2026-08-07.md': '# 2026-08-07\n\n- [x] タスクチェック\n\n## 📝 メモ\n既存のメモ\n'
  }});
  ctx.GitHubStorage = gh;
  PS._profile = null;
  await PS.remember('既存を壊さない', '応答の好み');
  const diary = gh.files.get('vault/diary/2026-08-07.md');
  check('既存のチェックリストが残る', diary.includes('- [x] タスクチェック'), diary);
  check('既存のメモ節が残る', PS.parseSections(diary)['📝 メモ'] !== undefined || diary.includes('既存のメモ'), diary);
  check('覚えたこと節が足される', diary.includes('## 🧠 覚えたこと'), diary);
}

console.log(`\n===== ${fail === 0 ? 'PASS' : 'FAIL'}  (${pass} passed / ${fail} failed) =====`);
process.exit(fail === 0 ? 0 : 1);
