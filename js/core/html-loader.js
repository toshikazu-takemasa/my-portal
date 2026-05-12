/**
 * html-loader.js
 * フレームワーク不使用で HTML パーシャルを fetch() でロードするユーティリティ。
 *
 * 使い方:
 *   <div data-partial="partials/panel-report.html"></div>
 *   await loadAllPartials();   // ネストされた data-partial も再帰的に解決される
 */

/**
 * 指定した要素内の script タグを再作成して順次実行・待機する。
 * innerHTML で挿入された script は自動実行されないため、この処理が必要。
 */
async function executeScriptsAndWait(element) {
  const scripts = Array.from(element.querySelectorAll('script'));
  for (const oldScript of scripts) {
    await new Promise((resolve, reject) => {
      const newScript = document.createElement('script');
      Array.from(oldScript.attributes).forEach(attr => {
        newScript.setAttribute(attr.name, attr.value);
      });
      newScript.textContent = oldScript.textContent;
      
      if (newScript.src) {
        newScript.onload = resolve;
        newScript.onerror = () => {
          console.error(`[html-loader] スクリプトのロードに失敗しました: ${newScript.src}`);
          resolve(); // エラーで全体が止まらないように resolve する
        };
      }
      
      oldScript.parentNode.replaceChild(newScript, oldScript);
      
      if (!newScript.src) {
        resolve(); // インラインスクリプトは挿入時に同期実行される
      }
    });
  }
}

/**
 * 単一のパーシャルをロードして対象要素に挿入し、
 * 挿入後にネストされた data-partial と script を再帰的に解決する。
 * @param {HTMLElement} el - data-partial 属性を持つコンテナ要素
 * @returns {Promise<void>}
 */
async function loadPartial(el) {
  const url = el.dataset.partial;
  if (!url) return;
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
    el.innerHTML = await res.text();
    
    // スクリプトの実行
    await executeScriptsAndWait(el);

    // 挿入された HTML の中にさらに data-partial があれば再帰ロード
    await loadAllPartials(el);
  } catch (err) {
    console.error(`[html-loader] パーシャルの読み込みに失敗しました: ${url}`, err);
    el.innerHTML = `<p style="color:red;font-size:0.8rem;">⚠️ ${url} の読み込みに失敗しました</p>`;
  }
}

/**
 * 指定した要素（省略時は document）配下の data-partial を持つ全要素を
 * 並列ロードする。ネストも再帰的に解決される。
 * @param {Element|Document} [root=document] - 検索対象のルート要素
 * @returns {Promise<void>}
 */
async function loadAllPartials(root = document) {
  const targets = root.querySelectorAll('[data-partial]');
  await Promise.all(Array.from(targets).map(loadPartial));
}
