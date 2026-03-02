// =====================
// ユーティリティ関数
// =====================

function escapeHtml(str) {
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function encodeUtf8Base64(str) {
  const bytes = new TextEncoder().encode(str);
  let bin = '';
  bytes.forEach(b => bin += String.fromCharCode(b));
  return btoa(bin);
}

// =====================
// Markdown レンダラー
// =====================
function renderMarkdown(md) {
  const lines = md.split('\n');
  const out   = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (line.trimStart().startsWith('|')) {
      const tblLines = [];
      while (i < lines.length && lines[i].trimStart().startsWith('|')) {
        tblLines.push(lines[i++]);
      }
      out.push(renderMdTable(tblLines));
      continue;
    }

    const hm = line.match(/^(#{1,4}) (.*)/);
    if (hm) {
      const lvl = hm[1].length;
      out.push(`<h${lvl} class="md-h${lvl}">${inlineFormat(hm[2])}</h${lvl}>`);
      i++; continue;
    }

    if (line.match(/^---+\s*$/)) {
      out.push('<hr class="md-hr">');
      i++; continue;
    }

    const cbm = line.match(/^(\s*)- \[([ xX])\] (.*)/);
    if (cbm) {
      const indent  = cbm[1].length;
      const checked = cbm[2].toLowerCase() === 'x';
      const text    = cbm[3];
      out.push(
        `<div class="md-check-item" style="padding-left:${indent * 8}px">` +
        `<input type="checkbox" class="md-cb" data-line="${i}" ${checked ? 'checked' : ''}>` +
        `<span class="md-check-text${checked ? ' md-done' : ''}">${inlineFormat(text)}</span>` +
        `</div>`
      );
      i++; continue;
    }

    const bm = line.match(/^(\s*)[-*] (.*)/);
    if (bm) {
      const indent = bm[1].length;
      out.push(`<div class="md-bullet" style="margin-left:${indent * 8}px">${inlineFormat(bm[2])}</div>`);
      i++; continue;
    }

    if (line.trim() === '') {
      out.push('<div class="md-gap"></div>');
      i++; continue;
    }

    out.push(`<div class="md-line">${inlineFormat(line)}</div>`);
    i++;
  }

  return out.join('');
}

function renderMdTable(lines) {
  const rows = lines.filter(l => !l.match(/^\|[\s:|-]+\|[\s:|-]+/));
  if (!rows.length) return '';
  let html = '<table class="md-table"><tbody>';
  rows.forEach((row, idx) => {
    const parts = row.split('|');
    const cells = parts.slice(1, parts.length - 1);
    const tag   = idx === 0 ? 'th' : 'td';
    html += '<tr>' + cells.map(c => `<${tag}>${inlineFormat(c.trim())}</${tag}>`).join('') + '</tr>';
  });
  html += '</tbody></table>';
  return html;
}

function inlineFormat(raw) {
  if (!raw) return '';
  const links = [];
  let s = raw.replace(/\[([^\]]*)\]\(([^)]*)\)/g, (_, text, url) => {
    links.push({ text, url });
    return `\x01LINK${links.length - 1}\x01`;
  });
  s = s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  s = s
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*\n]+)\*/g, '<em>$1</em>')
    .replace(/`([^`]+)`/g, '<code class="md-code">$1</code>');
  s = s.replace(/\x01LINK(\d+)\x01/g, (_, idx) => {
    const { text, url } = links[+idx];
    const safeText = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    return `<a href="${url}" target="_blank" class="md-link">${safeText}</a>`;
  });
  return s;
}
