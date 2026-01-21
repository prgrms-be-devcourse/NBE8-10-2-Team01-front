"use client";

import * as React from "react";
import type { JSONContent } from "@tiptap/core";
import { Extension } from "@tiptap/core";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import CodeBlockLowlight from "@tiptap/extension-code-block-lowlight";
import { common, createLowlight } from "lowlight";
import { TextSelection } from "prosemirror-state";
import { DOMParser } from "prosemirror-model";
import type { EditorView } from "prosemirror-view";
import { Table } from "@tiptap/extension-table";
import { TableRow } from "@tiptap/extension-table-row";
import { TableHeader } from "@tiptap/extension-table-header";
import { TableCell } from "@tiptap/extension-table-cell";
import { markdownToHtml, sliceToMarkdown } from "@/lib/markdown";

export default function WritePage() {
  const [title, setTitle] = React.useState("");
  const [tagInput, setTagInput] = React.useState("");
  const [tags, setTags] = React.useState<string[]>([]);
  const [isEmpty, setIsEmpty] = React.useState(true);
  const [tableControls, setTableControls] = React.useState<{
    visible: boolean;
    top: number;
    left: number;
  }>({ visible: false, top: 0, left: 0 });
  const [selectionVersion, setSelectionVersion] = React.useState(0);
  const editorWrapRef = React.useRef<HTMLDivElement | null>(null);

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
        priority: 1000,
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

          const handleEnter = () => {
            if (this.editor.isActive("codeBlock")) {
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
            }

            if (this.editor.isActive("heading")) {
              this.editor.commands.splitBlock();
              this.editor.commands.setParagraph();
              return true;
            }

            return false;
          };

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
            Enter: () => handleEnter() || insertIndent(),
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
      Table.configure({
        resizable: false,
      }),
      TableRow,
      TableHeader,
      TableCell,
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
      handleKeyDown: (view, event) => {
        if (event.key !== "Enter") return false;
        if (editor?.isActive("codeBlock")) return false;
        const { $from } = view.state.selection;
        const currentNode = $from.parent;
        if (currentNode.type.name !== "paragraph") return false;
        const rawText = currentNode.textContent;
        const lines = rawText.split("\n").map((line) => line.trim()).filter(Boolean);
        if (lines.length < 2) return false;
        const currentText = lines[lines.length - 1];
        const prevText = lines[lines.length - 2];
        const isSeparator = /^\|?\s*:?-+:?\s*(\|\s*:?-+:?\s*)+\|?\s*$/.test(
          currentText
        );
        if (!isSeparator || !prevText.includes("|")) return false;
        const tableMarkdown = `${prevText}\n${currentText}`;
        const html = markdownToHtml(tableMarkdown, { preserveEmptyLines: false });
        const parser = DOMParser.fromSchema(view.state.schema);
        const dom = new window.DOMParser().parseFromString(html, "text/html");
        const slice = parser.parseSlice(dom.body);
        const from = $from.before();
        const to = $from.after();
        const tr = view.state.tr.replaceRange(from, to, slice);
        view.dispatch(tr);
        return true;
      },
      handlePaste: (view, event) => {
        const text = event.clipboardData?.getData("text/plain") ?? "";
        const hasMarkdown =
          /(^|\n)#{1,6}\s/.test(text) ||
          /(^|\n)\d+\.\s/.test(text) ||
          /(^|\n)(-|\*)\s/.test(text) ||
          /(^|\n)>\s/.test(text) ||
          /\|.+\|\n\s*\|[-:\s|]+\|/m.test(text) ||
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

  React.useEffect(() => {
    if (!editor) return;
    const update = () => {
      setSelectionVersion((v) => v + 1);
      const wrap = editorWrapRef.current;
      if (!wrap) return;
      const domAtPos = editor.view.domAtPos(editor.state.selection.from);
      const table =
        (domAtPos.node as HTMLElement).closest?.("table") ??
        (domAtPos.node.parentElement?.closest?.("table") as HTMLTableElement | null);
      if (!table) {
        setTableControls((prev) => (prev.visible ? { ...prev, visible: false } : prev));
        return;
      }
      const tableRect = table.getBoundingClientRect();
      const wrapRect = wrap.getBoundingClientRect();
      setTableControls({
        visible: true,
        top: tableRect.top - wrapRect.top - 36,
        left: tableRect.left - wrapRect.left,
      });
    };
    editor.on("selectionUpdate", update);
    editor.on("update", update);
    update();
    return () => {
      editor.off("selectionUpdate", update);
      editor.off("update", update);
    };
  }, [editor]);

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
              <button
                type="button"
                onClick={() => {
                  if (!editor || editor.isActive("table")) return;
                  editor
                    .chain()
                    .focus()
                    .insertTable({ rows: 3, cols: 4, withHeaderRow: true })
                    .run();
                }}
                className="toolbar-pill"
              >
                Table
              </button>
            </div>
            <div className="relative min-h-0 flex-1" ref={editorWrapRef}>
              {tableControls.visible && (
                <div
                  className="table-actions table-actions-inline"
                  style={{ top: tableControls.top, left: tableControls.left }}
                >
                  <button
                    type="button"
                    onClick={() => editor?.chain().focus().addRowAfter().run()}
                    className="table-action-btn"
                  >
                    +Row
                  </button>
                  <button
                    type="button"
                    onClick={() => editor?.chain().focus().addColumnAfter().run()}
                    className="table-action-btn"
                  >
                    +Col
                  </button>
                  <button
                    type="button"
                    onClick={() => editor?.chain().focus().deleteRow().run()}
                    className="table-action-btn"
                  >
                    -Row
                  </button>
                  <button
                    type="button"
                    onClick={() => editor?.chain().focus().deleteColumn().run()}
                    className="table-action-btn"
                  >
                    -Col
                  </button>
                  <button
                    type="button"
                    onClick={() => editor?.chain().focus().deleteTable().run()}
                    className="table-action-btn"
                  >
                    Del
                  </button>
                </div>
              )}
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
