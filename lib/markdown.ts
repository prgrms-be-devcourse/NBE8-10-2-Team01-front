import type { Fragment, Node as ProseMirrorNode, Slice } from "prosemirror-model";

type MarkdownOptions = {
  highlight?: boolean;
  preserveEmptyLines?: boolean;
  includeHeadingPrefix?: boolean;
};

// Note: code-block UI actions (language selector/copy) live in `app/write/page.tsx` with TipTap.

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

  text = text.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (_m, alt, src) => {
    return `<img src="${src}" alt="${alt}" class="md-image" loading="lazy" />`;
  });

  text = text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_m, label, href) => {
    return `<a href="${href}" class="md-link">${label}</a>`;
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
  const preserveEmptyLines = options.preserveEmptyLines ?? true;
  const includeHeadingPrefix = options.includeHeadingPrefix ?? false;

  while (i < lines.length) {
    const raw = lines[i];
    const line = raw.trim();

    if (line.includes("|") && i + 1 < lines.length) {
      const next = lines[i + 1].trim();
      const isSeparator = /^(\|?\s*:?-+:?\s*\|)+\s*:?-+:?\s*$/.test(next);
      if (isSeparator) {
        const header = raw;
        const rows: string[] = [];
        i += 2;
        while (i < lines.length && lines[i].includes("|")) {
          if (!lines[i].trim()) break;
          rows.push(lines[i]);
          i += 1;
        }

        const splitRow = (row: string) =>
          row
            .trim()
            .replace(/^\|/, "")
            .replace(/\|$/, "")
            .split("|")
            .map((cell) => cell.trim());

        const headerCells = splitRow(header);
        const bodyRows = rows.map(splitRow);

        const thead =
          "<thead><tr>" +
          headerCells.map((cell) => `<th>${formatInline(cell)}</th>`).join("") +
          "</tr></thead>";
        const tbody =
          "<tbody>" +
          bodyRows
            .map(
              (row) =>
                "<tr>" +
                row.map((cell) => `<td>${formatInline(cell)}</td>`).join("") +
                "</tr>"
            )
            .join("") +
          "</tbody>";

        blocks.push(`<table class="md-table">${thead}${tbody}</table>`);
        continue;
      }
    }

    if (/^(-{3,}|\*{3,}|_{3,})$/.test(line)) {
      blocks.push('<hr class="md-hr" />');
      i += 1;
      continue;
    }

    if (!line) {
      if (preserveEmptyLines) {
        blocks.push("<br />");
      }
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
      const prefix = includeHeadingPrefix
        ? '<span class="md-heading-prefix">### </span>'
        : "";
      blocks.push(
        `<h3 class="md-h3">${prefix}${formatInline(line.slice(4))}</h3>`
      );
      i += 1;
      continue;
    }

    if (line.startsWith("## ")) {
      const prefix = includeHeadingPrefix
        ? '<span class="md-heading-prefix">## </span>'
        : "";
      blocks.push(
        `<h2 class="md-h2">${prefix}${formatInline(line.slice(3))}</h2>`
      );
      i += 1;
      continue;
    }

    if (line.startsWith("# ")) {
      const prefix = includeHeadingPrefix
        ? '<span class="md-heading-prefix"># </span>'
        : "";
      blocks.push(
        `<h1 class="md-h1">${prefix}${formatInline(line.slice(2))}</h1>`
      );
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
        /^(-{3,}|\*{3,}|_{3,})$/.test(current) ||
        current.startsWith("```")
      ) {
        break;
      }
      paragraphLines.push(current);
      i += 1;
    }
    const paragraph = paragraphLines.map((text) => formatInline(text)).join("<br />");
    blocks.push(`<p class="md-p">${paragraph}</p>`);
  }

  return blocks.join("");
}

// Server-side renderer for stored markdown content.
export function renderMarkdown(markdown: string) {
  return markdownToHtml(markdown, { highlight: true });
}

function serializeInline(node: ProseMirrorNode): string {
  if (node.type.name === "text") {
    const text = node.text ?? "";
    const marks = node.marks ?? [];
    const hasCode = marks.some((mark) => mark.type.name === "code");
    if (hasCode) {
      return `\`${text}\``;
    }
    const hasBold = marks.some((mark) => mark.type.name === "bold");
    const hasItalic = marks.some((mark) => mark.type.name === "italic");
    let out = text;
    if (hasBold && hasItalic) out = `***${out}***`;
    else if (hasBold) out = `**${out}**`;
    else if (hasItalic) out = `*${out}*`;
    return out;
  }
  if (node.type.name === "hardBreak") {
    return "\n";
  }
  let text = "";
  node.forEach((child) => {
    text += serializeInline(child);
  });
  return text;
}

function serializeBlock(node: ProseMirrorNode, orderedIndex = 1): string | null {
  switch (node.type.name) {
    case "paragraph": {
      const text = serializeInline(node).trimEnd();
      return text;
    }
    case "heading": {
      const level = node.attrs.level ?? 1;
      const text = serializeInline(node).trim();
      return `${"#".repeat(level)} ${text}`;
    }
    case "blockquote": {
      const inner = serializeFragment(node.content, "\n")
        .split("\n")
        .map((line) => `> ${line}`)
        .join("\n");
      return inner;
    }
    case "bulletList": {
      const lines: string[] = [];
      node.forEach((child) => {
        const item = serializeBlock(child);
        if (item) lines.push(`- ${item}`);
      });
      return lines.join("\n");
    }
    case "orderedList": {
      const lines: string[] = [];
      let index = orderedIndex;
      node.forEach((child) => {
        const item = serializeBlock(child);
        if (item) lines.push(`${index}. ${item}`);
        index += 1;
      });
      return lines.join("\n");
    }
    case "listItem": {
      let text = "";
      node.forEach((child) => {
        if (child.type.name === "paragraph") {
          text = serializeInline(child).trim();
        }
      });
      return text;
    }
    case "codeBlock": {
      const language = node.attrs.language ? `${node.attrs.language}` : "";
      const code = node.textContent ?? "";
      return `\`\`\`${language}\n${code}\n\`\`\``;
    }
    case "horizontalRule": {
      return "---";
    }
    case "table": {
      const rows: string[] = [];
      node.forEach((row) => {
        const cells: string[] = [];
        row.forEach((cell) => {
          cells.push(serializeInline(cell).trim());
        });
        rows.push(`| ${cells.join(" | ")} |`);
      });
      if (rows.length >= 2) {
        const separator = rows[0]
          .split("|")
          .filter((cell) => cell.trim())
          .map(() => "---")
          .join(" | ");
        rows.splice(1, 0, `| ${separator} |`);
      }
      return rows.join("\n");
    }
    default: {
      if (node.isTextblock) {
        const text = serializeInline(node).trimEnd();
        return text || null;
      }
      return null;
    }
  }
}

function serializeFragment(fragment: Fragment, separator: string): string {
  const blocks: string[] = [];
  fragment.forEach((node) => {
    const block = serializeBlock(node);
    if (block !== null) {
      blocks.push(block);
    }
  });
  return blocks.join(separator);
}

export function sliceToMarkdown(
  slice: Slice,
  options: { paragraphSeparator?: string } = {}
): string {
  const separator = options.paragraphSeparator ?? "\n\n";
  return serializeFragment(slice.content, separator).trim();
}

export function docToMarkdown(
  doc: ProseMirrorNode,
  options: { paragraphSeparator?: string } = {}
): string {
  const separator = options.paragraphSeparator ?? "\n\n";
  return serializeFragment(doc.content, separator).trim();
}

type EditorLine = {
  className: string;
  html: string;
};

function formatEditorInline(value: string) {
  let text = escapeHtml(value);
  text = text.replace(/\*\*([^*]+)\*\*/g, (_m, bold) => {
    return `<span class="md-editor-bold">**${bold}**</span>`;
  });
  text = text.replace(/\*([^*]+)\*/g, (_m, italic) => {
    return `<span class="md-editor-italic">*${italic}*</span>`;
  });
  text = text.replace(/`([^`]+)`/g, (_m, code) => {
    return `<span class="md-editor-code">\`${code}\`</span>`;
  });
  return text;
}

export function markdownToEditorHtml(markdown: string) {
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  const blocks: EditorLine[] = [];

  lines.forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed) {
      blocks.push({ className: "md-editor-line", html: "<br />" });
      return;
    }
    if (/^(-{3,}|\*{3,}|_{3,})$/.test(trimmed)) {
      blocks.push({ className: "md-editor-line md-editor-hr", html: trimmed });
      return;
    }
    if (trimmed.startsWith("### ")) {
      blocks.push({
        className: "md-editor-line md-editor-h3",
        html: formatEditorInline(line),
      });
      return;
    }
    if (trimmed.startsWith("## ")) {
      blocks.push({
        className: "md-editor-line md-editor-h2",
        html: formatEditorInline(line),
      });
      return;
    }
    if (trimmed.startsWith("# ")) {
      blocks.push({
        className: "md-editor-line md-editor-h1",
        html: formatEditorInline(line),
      });
      return;
    }
    blocks.push({ className: "md-editor-line", html: formatEditorInline(line) });
  });

  return blocks
    .map((block) => `<div class="${block.className}">${block.html}</div>`)
    .join("");
}
