type MarkdownOptions = {
  highlight?: boolean;
};

const JS_KEYWORDS =
  /\b(const|let|var|function|return|import|export|default|type|interface|class|extends|implements|async|await|if|else|for|while|switch|case|break|continue|new|try|catch|throw)\b/g;

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatInline(value: string) {
  let text = escapeHtml(value);

  text = text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_m, label, href) => {
    const safeHref = escapeHtml(href);
    return `<a href="${safeHref}" class="md-link">${label}</a>`;
  });

  text = text.replace(/`([^`]+)`/g, (_m, code) => {
    return `<code class="md-inline-code">${code}</code>`;
  });

  text = text.replace(/\*\*([^*]+)\*\*/g, (_m, bold) => {
    return `<strong>${bold}</strong>`;
  });

  text = text.replace(/\*([^*]+)\*/g, (_m, italic) => {
    return `<em>${italic}</em>`;
  });

  return text;
}

function highlightCode(code: string, language?: string) {
  if (!language) return code;
  const lang = language.toLowerCase();
  if (!["js", "ts", "javascript", "typescript"].includes(lang)) return code;
  return code.replace(JS_KEYWORDS, '<span class="token keyword">$1</span>');
}

export function markdownToHtml(markdown: string, options: MarkdownOptions = {}) {
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  const blocks: string[] = [];
  let i = 0;

  while (i < lines.length) {
    const raw = lines[i];
    const line = raw.trim();

    if (!line) {
      i += 1;
      continue;
    }

    if (line.startsWith("```")) {
      const lang = line.slice(3).trim();
      const codeLines: string[] = [];
      i += 1;
      while (i < lines.length && !lines[i].trim().startsWith("```")) {
        codeLines.push(lines[i]);
        i += 1;
      }
      i += 1;
      const escaped = escapeHtml(codeLines.join("\n"));
      const highlighted = options.highlight ? highlightCode(escaped, lang) : escaped;
      const languageClass = lang ? ` language-${lang}` : "";
      blocks.push(
        `<pre class="md-code"><code class="md-code-inner${languageClass}">${highlighted}</code></pre>`
      );
      continue;
    }

    if (line.startsWith("- ") || line.startsWith("* ")) {
      const items: string[] = [];
      while (i < lines.length) {
        const current = lines[i].trim();
        if (!(current.startsWith("- ") || current.startsWith("* "))) break;
        items.push(current.slice(2));
        i += 1;
      }
      const list = items
        .map((item) => `<li>${formatInline(item)}</li>`)
        .join("");
      blocks.push(`<ul class="md-list">${list}</ul>`);
      continue;
    }

    if (line.startsWith("### ")) {
      blocks.push(`<h3 class="md-h3">${formatInline(line.slice(4))}</h3>`);
      i += 1;
      continue;
    }

    if (line.startsWith("## ")) {
      blocks.push(`<h2 class="md-h2">${formatInline(line.slice(3))}</h2>`);
      i += 1;
      continue;
    }

    if (line.startsWith("# ")) {
      blocks.push(`<h1 class="md-h1">${formatInline(line.slice(2))}</h1>`);
      i += 1;
      continue;
    }

    if (line.startsWith("> ")) {
      blocks.push(`<blockquote class="md-quote">${formatInline(line.slice(2))}</blockquote>`);
      i += 1;
      continue;
    }

    const paragraphLines: string[] = [];
    while (i < lines.length && lines[i].trim() !== "") {
      const current = lines[i].trim();
      if (
        current.startsWith("# ") ||
        current.startsWith("## ") ||
        current.startsWith("### ") ||
        current.startsWith("> ") ||
        current.startsWith("- ") ||
        current.startsWith("* ") ||
        current.startsWith("```")
      ) {
        break;
      }
      paragraphLines.push(current);
      i += 1;
    }
    blocks.push(`<p class="md-p">${formatInline(paragraphLines.join(" "))}</p>`);
  }

  return blocks.join("");
}
