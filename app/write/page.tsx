"use client";

import * as React from "react";
import type { JSONContent } from "@tiptap/core";
import { Extension } from "@tiptap/core";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import CodeBlockLowlight from "@tiptap/extension-code-block-lowlight";
import { common, createLowlight } from "lowlight";
import { TextSelection } from "prosemirror-state";
import { DOMParser, type Node as ProseMirrorNode, type Fragment, type Slice } from "prosemirror-model";
import type { EditorView } from "prosemirror-view";
import { markdownToHtml } from "@/lib/markdown";

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
      const inner = serializeFragment(node.content)
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
    default: {
      if (node.isTextblock) {
        const text = serializeInline(node).trimEnd();
        return text || null;
      }
      return null;
    }
  }
}

function serializeFragment(fragment: Fragment): string {
  const blocks: string[] = [];
  fragment.forEach((node) => {
    const block = serializeBlock(node);
    if (block !== null) {
      blocks.push(block);
    }
  });
  return blocks.join("\n\n");
}

function sliceToMarkdown(slice: Slice): string {
  return serializeFragment(slice.content).trim();
}

export default function WritePage() {
  const [title, setTitle] = React.useState("");
  const [tagInput, setTagInput] = React.useState("");
  const [tags, setTags] = React.useState<string[]>([]);
  const [isEmpty, setIsEmpty] = React.useState(true);

  const handleCopy = React.useCallback(
    (view: EditorView, event: ClipboardEvent) => {
      const selection = view.state.selection;
      if (selection.empty) return false;
      const slice = selection.content();
      const markdown = sliceToMarkdown(slice);
      if (!markdown) return false;
      event.preventDefault();
      event.clipboardData?.setData("text/plain", markdown);
      return true;
    },
    []
  );

  const lowlight = React.useMemo(() => createLowlight(common), []);

  const AutoPairs = React.useMemo(
    () =>
      Extension.create({
        name: "autoPairs",
        addKeyboardShortcuts() {
          const insertPair = (open: string, close: string) =>
            this.editor.commands.command(({ tr, state, dispatch }) => {
              const { from, to } = state.selection;
              const nextChar =
                from < state.doc.content.size
                  ? state.doc.textBetween(from, from + 1, "\n", "\n")
                  : "";
              if (from !== to) {
                tr.insertText(open, from, from);
                tr.insertText(close, to + open.length, to + open.length);
                tr.setSelection(
                  TextSelection.create(tr.doc, from + open.length, to + open.length)
                );
              } else if (nextChar === close) {
                tr.setSelection(TextSelection.create(tr.doc, from + 1));
              } else {
                tr.insertText(open + close, from, to);
                tr.setSelection(TextSelection.create(tr.doc, from + open.length));
              }
              if (dispatch) dispatch(tr);
              return true;
            });

          const skipOrInsertClose = (close: string) =>
            this.editor.commands.command(({ tr, state, dispatch }) => {
              const { from, to } = state.selection;
              if (from !== to) return false;
              const nextChar =
                from < state.doc.content.size
                  ? state.doc.textBetween(from, from + 1, "\n", "\n")
                  : "";
              if (nextChar === close) {
                tr.setSelection(TextSelection.create(tr.doc, from + 1));
              } else {
                tr.insertText(close, from, to);
                tr.setSelection(TextSelection.create(tr.doc, from + 1));
              }
              if (dispatch) dispatch(tr);
              return true;
            });

          const insertIndent = () => {
            if (!this.editor.isActive("codeBlock")) return false;
            const { state } = this.editor;
            const { from } = state.selection;
            const beforeChar =
              from > 0 ? state.doc.textBetween(from - 1, from, "\n", "\n") : "";
            const afterChar =
              from < state.doc.content.size
                ? state.doc.textBetween(from, from + 1, "\n", "\n")
                : "";

            const { $from } = state.selection;
            const before = $from.parent.textBetween(0, $from.parentOffset, "\n", "\n");
            const currentLine = before.split("\n").pop() ?? "";
            const indent = currentLine.match(/^\s+/)?.[0] ?? "";

            if (beforeChar === "{" && afterChar === "}") {
              this.editor.commands.insertContent(`\n${indent}  \n${indent}`);
              this.editor.commands.setTextSelection(from + indent.length + 3);
              return true;
            }

            const extra = currentLine.trim().endsWith("{") ? "  " : "";
            this.editor.commands.insertContent(`\n${indent}${extra}`);
            return true;
          };

          const deletePair = (open: string, close: string) =>
            this.editor.commands.command(({ tr, state, dispatch }) => {
              const { from, to } = state.selection;
              if (from !== to) return false;
              const before = from > 0 ? state.doc.textBetween(from - 1, from, "\n", "\n") : "";
              const after =
                from < state.doc.content.size
                  ? state.doc.textBetween(from, from + 1, "\n", "\n")
                  : "";
              if (before === open && after === close) {
                tr.delete(from - 1, from + 1);
                if (dispatch) dispatch(tr);
                return true;
              }
              return false;
            });

          return {
            "{": () => insertPair("{", "}"),
            "[": () => insertPair("[", "]"),
            "(": () => insertPair("(", ")"),
            "\"": () => insertPair("\"", "\""),
            "'": () => insertPair("'", "'"),
            Enter: () => insertIndent(),
            ")": () => skipOrInsertClose(")"),
            "]": () => skipOrInsertClose("]"),
            "}": () => skipOrInsertClose("}"),
            Backspace: () => deletePair("\"", "\"") || deletePair("'", "'"),
          };
        },
      }),
    []
  );

  const extensions = React.useMemo(
    () => [
      StarterKit.configure({
        codeBlock: false,
      }),
      CodeBlockLowlight.configure({ lowlight }),
      AutoPairs,
    ],
    [AutoPairs, lowlight]
  );

  const editor = useEditor({
    extensions,
    content: "",
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class: "tiptap-editor",
      },
      handlePaste: (view, event) => {
        const text = event.clipboardData?.getData("text/plain") ?? "";
        const hasMarkdown =
          /(^|\n)#{1,6}\s/.test(text) ||
          /(^|\n)\d+\.\s/.test(text) ||
          /(^|\n)(-|\*)\s/.test(text) ||
          /(^|\n)>\s/.test(text) ||
          /```/.test(text);
        if (!hasMarkdown) return false;
        const html = markdownToHtml(text, { preserveEmptyLines: false });
        const parser = DOMParser.fromSchema(view.state.schema);
        const dom = new window.DOMParser().parseFromString(html, "text/html");
        const slice = parser.parseSlice(dom.body);
        const tr = view.state.tr.replaceSelection(slice).scrollIntoView();
        view.dispatch(tr);
        return true;
      },
      handleDOMEvents: {
        copy: (view, event) => handleCopy(view, event),
      },
    },
  });

  const previewEditor = useEditor({
    extensions,
    content: "",
    editable: false,
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class: "tiptap-editor tiptap-preview",
      },
      handleDOMEvents: {
        copy: (view, event) => handleCopy(view, event),
      },
    },
  });

  const handleTagKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== "Enter") return;
    event.preventDefault();
    const next = tagInput.trim();
    if (!next) return;
    if (tags.includes(next)) {
      setTagInput("");
      return;
    }
    setTags((prev) => [...prev, next]);
    setTagInput("");
  };

  const applyCodeBlockDecorations = React.useCallback(
    (
      root: HTMLElement,
      options: {
        withCopy: boolean;
        editor?: typeof editor;
      }
    ) => {
      const blocks = root.querySelectorAll("pre");
      blocks.forEach((block) => {
        const code = block.querySelector("code");
        const className = code?.className ?? "";
        const match = className.match(/language-([a-z0-9_-]+)/i);
        const language = match?.[1] ?? "plain";
        block.setAttribute("data-language", language);

        const existing = block.querySelector(".code-actions");
        if (existing) {
          const langWrap = existing.querySelector(".code-action-lang");
          if (langWrap) langWrap.remove();
          existing.querySelectorAll(".code-action-lang-btn, .code-action-select").forEach((el) => {
            el.remove();
          });
          const langButton = existing.querySelector(
            ".code-action-lang-btn"
          ) as HTMLButtonElement | null;
          const select = existing.querySelector(
            ".code-action-select"
          ) as HTMLSelectElement | null;
          const label = existing.querySelector(
            ".code-language-label"
          ) as HTMLSpanElement | null;
          if (langButton) langButton.title = `language: ${language}`;
          if (select) select.value = language === "plain" ? "plaintext" : language;
          if (label) label.textContent = language;
          return;
        }

        const actions = document.createElement("div");
        actions.className = options.editor ? "code-actions code-actions-editor" : "code-actions code-actions-preview";

        const label = document.createElement("span");
        label.className = "code-language-label";
        label.textContent = language;
        actions.appendChild(label);

        if (options.withCopy) {
          const copy = document.createElement("button");
          copy.type = "button";
          copy.className = "code-action-btn code-action-copy";
          copy.setAttribute("aria-label", "코드 복사");
          copy.title = "복사";
          copy.addEventListener("click", () => {
            const text = code?.textContent ?? "";
            navigator.clipboard?.writeText(text);
          });
          const copyWrap = document.createElement("div");
          copyWrap.className = "code-action copy";
          copyWrap.appendChild(copy);
          actions.appendChild(copyWrap);
        }

        block.appendChild(actions);
      });
    },
    []
  );

  React.useEffect(() => {
    if (!editor) return;
    const sync = ({ editor: liveEditor }: { editor: typeof editor }) => {
      const json = liveEditor.getJSON() as JSONContent;
      previewEditor?.commands.setContent(json, { emitUpdate: false });
      setIsEmpty(liveEditor.isEmpty);
      if (liveEditor?.view?.dom) {
        applyCodeBlockDecorations(liveEditor.view.dom, {
          withCopy: false,
          editor: liveEditor,
        });
      }
      if (previewEditor?.view?.dom) {
        applyCodeBlockDecorations(previewEditor.view.dom, {
          withCopy: true,
        });
      }
    };
    sync({ editor });
    editor.on("update", sync);
    return () => {
      editor.off("update", sync);
    };
  }, [editor, previewEditor, applyCodeBlockDecorations]);

  return (
    <div
      className="flex h-screen flex-col overflow-hidden bg-gradient-to-br from-amber-50 via-orange-50 to-rose-50 text-neutral-900"
      style={{
        fontFamily:
          '"Manrope", "Space Grotesk", "Noto Sans KR", "Pretendard", sans-serif',
      }}
    >
      <section className="grid flex-1 min-h-0 grid-cols-1 lg:grid-cols-2">
        <div className="flex h-full min-h-0 flex-col gap-4 overflow-auto bg-white/70 p-6 backdrop-blur">
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="제목을 입력하세요"
            className="w-full rounded-2xl border border-transparent bg-white/70 px-4 py-3 text-2xl font-semibold outline-none placeholder:text-neutral-400 shadow-sm transition focus:border-neutral-300 focus:bg-white"
          />

          <div className="flex flex-col gap-2">
            <input
              value={tagInput}
              onChange={(event) => setTagInput(event.target.value)}
              onKeyDown={handleTagKeyDown}
              placeholder="해시태그를 입력하세요 (Enter)"
              className="w-full rounded-2xl border border-transparent bg-white/70 px-4 py-2 text-sm outline-none placeholder:text-neutral-400 shadow-sm transition focus:border-neutral-300 focus:bg-white"
            />
            <div className="flex flex-wrap gap-2">
              {tags.map((tag) => (
                <span
                  key={tag}
                  className="inline-flex items-center gap-2 rounded-full bg-neutral-900 px-3 py-1 text-xs text-white"
                >
                  #{tag}
                  <button
                    type="button"
                    onClick={() => setTags((prev) => prev.filter((t) => t !== tag))}
                    className="rounded-full bg-white/20 px-2 py-0.5 text-[10px] uppercase tracking-wider"
                    aria-label={`remove ${tag}`}
                  >
                    x
                  </button>
                </span>
              ))}
            </div>
          </div>

          <div className="flex-1 min-h-0">
            <div className="flex flex-wrap items-center gap-2 pb-3">
              <button
                type="button"
                onClick={() => editor?.chain().focus().toggleBold().run()}
                className={`toolbar-pill ${editor?.isActive("bold") ? "is-active" : ""}`}
              >
                Bold
              </button>
              <button
                type="button"
                onClick={() => editor?.chain().focus().toggleItalic().run()}
                className={`toolbar-pill ${editor?.isActive("italic") ? "is-active" : ""}`}
              >
                Italic
              </button>
              <button
                type="button"
                onClick={() => editor?.chain().focus().toggleHeading({ level: 1 }).run()}
                className={`toolbar-pill ${editor?.isActive("heading", { level: 1 }) ? "is-active" : ""}`}
              >
                H1
              </button>
              <button
                type="button"
                onClick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()}
                className={`toolbar-pill ${editor?.isActive("heading", { level: 2 }) ? "is-active" : ""}`}
              >
                H2
              </button>
              <button
                type="button"
                onClick={() => editor?.chain().focus().toggleHeading({ level: 3 }).run()}
                className={`toolbar-pill ${editor?.isActive("heading", { level: 3 }) ? "is-active" : ""}`}
              >
                H3
              </button>
              <button
                type="button"
                onClick={() => editor?.chain().focus().toggleBulletList().run()}
                className={`toolbar-pill ${editor?.isActive("bulletList") ? "is-active" : ""}`}
              >
                List
              </button>
              <button
                type="button"
                onClick={() => editor?.chain().focus().toggleCodeBlock().run()}
                className={`toolbar-pill ${editor?.isActive("codeBlock") ? "is-active" : ""}`}
              >
                Code
              </button>
            </div>
            <div className="relative min-h-0 flex-1">
              {isEmpty && (
                <div className="pointer-events-none absolute left-2 top-2 text-neutral-400">
                  본문을 입력하세요. (Markdown 지원)
                </div>
              )}
              <EditorContent editor={editor} />
            </div>
          </div>
        </div>

        <div className="flex h-full min-h-0 flex-col overflow-auto bg-white/90 p-6 backdrop-blur">
          <div className="flex flex-col gap-4">
            <div className="min-h-[3.5rem] border-b border-transparent pb-1 text-2xl font-semibold text-neutral-900">
              {title || <span className="text-neutral-300">제목 미리보기</span>}
            </div>
            <div className="min-h-[3rem]">
              {tags.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {tags.map((tag) => (
                    <span
                      key={tag}
                      className="inline-flex items-center gap-2 rounded-full bg-neutral-900 px-3 py-1 text-xs text-white"
                    >
                      #{tag}
                    </span>
                  ))}
                </div>
              ) : (
                <div className="text-sm text-neutral-300">해시태그 미리보기</div>
              )}
            </div>
          </div>
          <div className="flex-1 min-h-0 pt-6">
            {isEmpty ? (
              <p className="text-neutral-300">오른쪽에 미리보기가 표시됩니다.</p>
            ) : (
              <EditorContent editor={previewEditor} />
            )}
          </div>
        </div>
      </section>

      <footer className="flex shrink-0 items-center justify-end gap-3 border-t border-neutral-200 bg-white/90 px-6 py-4 backdrop-blur">
        <button
          type="button"
          className="rounded-full border border-neutral-900 bg-white px-6 py-3 text-sm font-semibold text-neutral-900 transition hover:-translate-y-0.5 hover:bg-neutral-900 hover:text-white"
        >
          임시저장
        </button>
        <button
          type="button"
          className="rounded-full border border-neutral-300 px-6 py-3 text-sm font-semibold text-neutral-600 transition hover:-translate-y-0.5 hover:border-neutral-900 hover:text-neutral-900"
        >
          나가기
        </button>
        <button
          type="button"
          className="rounded-full bg-neutral-900 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-neutral-900/20 transition hover:-translate-y-0.5 hover:bg-black"
        >
          저장
        </button>
      </footer>
    </div>
  );
}
