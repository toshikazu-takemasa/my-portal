const fs = require('fs');

function replaceAll(file, rules) {
  let content = fs.readFileSync(file, 'utf8');
  for (let [from, to] of rules) {
    content = content.split(from).join(to);
  }
  fs.writeFileSync(file, content, 'utf8');
  console.log(`Updated ${file}`);
}

// CSS Files
replaceAll('css/theme-game.css', [['theme-ff14', 'theme-game']]);
replaceAll('css/theme-night-sky.css', [['theme-hayate', 'theme-night-sky']]);
replaceAll('css/theme-cozy-everyday.css', [['theme-hayate-gentle', 'theme-cozy-everyday']]);
replaceAll('css/ai-ticker.css', [
  ['theme-ff14', 'theme-game'],
  ['theme-hayate-gentle', 'theme-cozy-everyday'],
  ['theme-hayate', 'theme-night-sky']
]);

// HTML File
replaceAll('index.html', [
  ['css/theme-ff14.css', 'css/theme-game.css'],
  ['css/theme-hayate-gentle.css', 'css/theme-cozy-everyday.css'],
  ['css/theme-hayate.css', 'css/theme-night-sky.css'],
  ['theme-ff14', 'theme-game'],
  ['theme-hayate-gentle', 'theme-cozy-everyday'],
  ['theme-hayate', 'theme-night-sky'],
  ['FF14 (Night)', 'Game (Night)'],
  ['八神はやて (日常・優しさ)', 'Cozy Everyday'],
  ['八神はやて (夜天)', 'Night Sky'],
  ['AIの名前（例：八神はやて）', 'AIの名前（例：パートナー）'],
  ['リクエスト通り「はやてテーマ」をデフォルトにするんよ', 'デフォルトテーマを適用する']
]);

// JS File
replaceAll('js/settings.js', [
  ["DEFAULT_AI_NAME     = '八神はやて'", "DEFAULT_AI_NAME     = 'パートナー'"],
  ['あなたは「魔法少女リリカルなのは」の八神はやてです。', 'あなたはユーザーに寄り添うパートナーです。'],
  ["classList.remove('theme-ff14', 'theme-hayate', 'theme-hayate-gentle')", "classList.remove('theme-game', 'theme-night-sky', 'theme-cozy-everyday')"]
]);
