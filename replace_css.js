const fs = require('fs');

function replaceAll(file, rules) {
  let content = fs.readFileSync(file, 'utf8');
  for (let [from, to] of rules) {
    content = content.split(from).join(to);
  }
  fs.writeFileSync(file, content, 'utf8');
  console.log(`Updated ${file}`);
}

replaceAll('css/theme-game.css', [['theme-ff14', 'theme-game']]);
replaceAll('css/theme-night-sky.css', [['theme-hayate', 'theme-night-sky']]);
replaceAll('css/theme-cozy-everyday.css', [['theme-hayate-gentle', 'theme-cozy-everyday']]);
replaceAll('css/ai-ticker.css', [
  ['theme-ff14', 'theme-game'],
  ['theme-hayate-gentle', 'theme-cozy-everyday'],
  ['theme-hayate', 'theme-night-sky']
]);
