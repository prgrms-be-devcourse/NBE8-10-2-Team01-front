"use client";

import * as React from "react";
import { Extension, mergeAttributes } from "@tiptap/core";
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
import { useRouter } from "next/navigation";
import { toast } from "react-hot-toast";
import { post } from "@/lib/apiClient";
import { isAuthed } from "@/lib/auth";
import { docToMarkdown, markdownToHtml, sliceToMarkdown } from "@/lib/markdown";

export default function WritePage() {
  const [title, setTitle] = React.useState("");
  const [tagInput, setTagInput] = React.useState("");
  const [tags, setTags] = React.useState<string[]>([]);
  const [isEmpty, setIsEmpty] = React.useState(true);
  const [isSaving, setIsSaving] = React.useState(false);
  const [tableControls, setTableControls] = React.useState<{
    visible: boolean;
    top: number;
    left: number;
  }>({ visible: false, top: 0, left: 0 });
  const [previewHtml, setPreviewHtml] = React.useState("");
  const isComposingRef = React.useRef(false);
  const editorWrapRef = React.useRef<HTMLDivElement | null>(null);
  const previewRef = React.useRef<HTMLDivElement | null>(null);
  const router = useRouter();
  const [authChecked, setAuthChecked] = React.useState(false);
  const [authed, setAuthed] = React.useState(false);

  React.useEffect(() => {
    const loggedIn = isAuthed();
    setAuthed(loggedIn);
    setAuthChecked(true);
    if (!loggedIn) {
      toast.error("로그인이 필요합니다");
      router.replace("/signin");
    }
  }, [router]);

  const handleCopy = React.useCallback(
    (view: EditorView, event: ClipboardEvent) => {
      const selection = view.state.selection;
      if (selection.empty) return false;
      const slice = selection.content();
      const markdown = sliceToMarkdown(slice, { paragraphSeparator: "\n" });
      if (!markdown) return false;
      event.preventDefault();
      event.clipboardData?.setData("text/plain", markdown);
      return true;
    },
    []
  );

  const lowlight = React.useMemo(() => createLowlight(common), []);

  const CodeBlockWithLabel = React.useMemo(
    () =>
      CodeBlockLowlight.extend({
        renderHTML({ node, HTMLAttributes }) {
          const language = node.attrs.language || "plain";
          return [
            "pre",
            mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
              "data-language": language,
            }),
            [
              "code",
              {
                class: node.attrs.language
                  ? `${this.options.languageClassPrefix}${node.attrs.language}`
                  : null,
              },
              0,
            ],
          ];
        },
      }),
    []
  );

  const AutoPairs = React.useMemo(
    () =>
      Extension.create({
        name: "autoPairs",
        priority: 1000,
        addKeyboardShortcuts() {
          const insertPair = (open: string, close: string) =>
            this.editor.commands.command(({ tr, state, dispatch }) => {
              if (isComposingRef.current) return false;
              const { from, to } = state.selection;
              const nextChar =
                from < state.doc.content.size
                  ? state.doc.textBetween(from, from + 1, "\n", "\n")
                  : "";
              const prevChar =
                from > 0 ? state.doc.textBetween(from - 1, from, "\n", "\n") : "";
              if (from !== to) {
                tr.insertText(open, from, from);
                tr.insertText(close, to + open.length, to + open.length);
                tr.setSelection(
                  TextSelection.create(tr.doc, from + open.length, to + open.length)
                );
              } else if (open === close && prevChar === open && nextChar === close) {
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
              if (isComposingRef.current) return false;
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
            if (isComposingRef.current) return false;
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
              if (beforeChar === "{" && afterChar !== "}") {
                this.editor.commands.insertContent(`\n${indent}  \n${indent}}`);
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
            if (isComposingRef.current) return false;
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
              if (isComposingRef.current) return false;
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
      CodeBlockWithLabel.configure({ lowlight, defaultLanguage: "plain" }),
      Table.configure({
        resizable: false,
      }),
      TableRow,
      TableHeader,
      TableCell,
      AutoPairs,
    ],
    [AutoPairs, CodeBlockWithLabel, lowlight]
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
        compositionstart: () => {
          isComposingRef.current = true;
          return false;
        },
        compositionend: () => {
          isComposingRef.current = false;
          return false;
        },
      },
    },
  });

  if (!authChecked || !authed) {
    return null;
  }

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

  const handleSave = React.useCallback(async () => {
    if (!editor) return;
    const trimmedTitle = title.trim();
    const markdown = docToMarkdown(editor.state.doc);
    const trimmedContent = markdown.trim();
    if (!trimmedTitle || !trimmedContent) {
      window.alert("제목과 본문을 모두 입력하세요.");
      return;
    }
    setIsSaving(true);
    try {
      await post(
        "/api/posts",
        {
          title: trimmedTitle,
          content: markdown,
        },
        { withAuth: true }
      );
      window.alert("저장되었습니다.");
      router.push("/home");
    } catch (error) {
      window.alert("저장에 실패했습니다. 잠시 후 다시 시도해주세요.");
    } finally {
      setIsSaving(false);
    }
  }, [editor, router, title]);

  React.useEffect(() => {
    if (!editor) return;
    const update = () => {
      if (editor.view.composing) return;
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
      }
    ) => {
      const blocks = root.querySelectorAll("pre");
      blocks.forEach((block) => {
        const code = block.querySelector("code");
        const className = code?.className ?? "";
        const match = className.match(/language-([a-z0-9_-]+)/i);
        const language = match?.[1] ?? "plain";
        block.setAttribute("data-language", language);
        const existing = block.querySelector(":scope > .code-actions");
        if (existing) {
          const label = existing.querySelector(
            ".code-language-label"
          ) as HTMLSpanElement | null;
          if (label) label.textContent = language;
          return;
        }

        if (!options.withCopy) return;

        const actions = document.createElement("div");
        actions.className = "code-actions code-actions-preview";

        const label = document.createElement("span");
        label.className = "code-language-label";
        label.textContent = language;
        actions.appendChild(label);

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

        block.appendChild(actions);
      });
    },
    []
  );

  React.useEffect(() => {
    if (!editor) return;
    const sync = ({ editor: liveEditor }: { editor: typeof editor }) => {
      setIsEmpty(liveEditor.isEmpty);
      const markdown = docToMarkdown(liveEditor.state.doc, {
        paragraphSeparator: "\n",
      });
      const html = markdownToHtml(markdown, {
        preserveEmptyLines: true,
      });
      setPreviewHtml(html);
    };
    sync({ editor });
    editor.on("update", sync);
    return () => {
      editor.off("update", sync);
    };
  }, [editor]);

  React.useEffect(() => {
    const root = previewRef.current;
    if (!root) return;
    applyCodeBlockDecorations(root, { withCopy: true });
  }, [previewHtml, applyCodeBlockDecorations]);

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
              <div
                ref={previewRef}
                dangerouslySetInnerHTML={{ __html: previewHtml }}
              />
            )}
          </div>
        </div>
      </section>

      <footer className="flex shrink-0 items-center justify-end gap-3 border-t border-neutral-200 bg-white/90 px-6 py-4 backdrop-blur">
        <button
          type="button"
          onClick={handleSave}
          disabled={isSaving}
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
          onClick={handleSave}
          disabled={isSaving}
          className="rounded-full bg-neutral-900 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-neutral-900/20 transition hover:-translate-y-0.5 hover:bg-black"
        >
          저장
        </button>
      </footer>
    </div>
  );
}
