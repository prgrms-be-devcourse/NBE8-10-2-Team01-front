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
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "react-hot-toast";
import { del, get, post, put } from "@/lib/apiClient";
import { isAuthed } from "@/lib/auth";
import { uploadImageFile } from "@/lib/imageUpload";
import { docToMarkdown, markdownToHtml, sliceToMarkdown } from "@/lib/markdown";
import { saveWriteDraft } from "@/lib/writeDraft";

type PostTemplateSummaryRes = {
  id: number;
  name: string;
};

type PostTemplateInfoDto = {
  id: number;
  name: string;
  title: string;
  content: string;
};

type PostEditRes = {
  id: number;
  title: string;
  content: string;
  thumbnail?: string | null;
};

type TemplateFormState = {
  id?: number;
  name: string;
  title: string;
  content: string;
};

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
  const [previewHtml, setPreviewHtml] = React.useState("");
  const isComposingRef = React.useRef(false);
  const editorWrapRef = React.useRef<HTMLDivElement | null>(null);
  const previewRef = React.useRef<HTMLDivElement | null>(null);
  const imageInputRef = React.useRef<HTMLInputElement | null>(null);
  const editLoadedRef = React.useRef<number | null>(null);
  const router = useRouter();
  const searchParams = useSearchParams();
  const editPostIdParam = searchParams.get("postId");
  const editPostId = editPostIdParam ? Number(editPostIdParam) : null;
  const isEditMode = Boolean(editPostId);
  const [authChecked, setAuthChecked] = React.useState(false);
  const [authed, setAuthed] = React.useState(false);
  const [editThumbnail, setEditThumbnail] = React.useState<string>("");
  const [templateOpen, setTemplateOpen] = React.useState(false);
  const [templateMode, setTemplateMode] = React.useState<"list" | "create" | "edit">(
    "list"
  );
  const [templateList, setTemplateList] = React.useState<PostTemplateSummaryRes[]>(
    []
  );
  const [templateLoading, setTemplateLoading] = React.useState(false);
  const [templateSaving, setTemplateSaving] = React.useState(false);
  const [templateForm, setTemplateForm] = React.useState<TemplateFormState>({
    name: "",
    title: "",
    content: "",
  });

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

  const insertImageMarkdown = React.useCallback(
    (view: EditorView, imageUrl: string, alt: string) => {
      const markdownImage = `![${alt}](${imageUrl})\n`;
      const { from, to } = view.state.selection;
      const tr = view.state.tr.insertText(markdownImage, from, to).scrollIntoView();
      view.dispatch(tr);
    },
    []
  );

  const handleImageFiles = React.useCallback(
    async (view: EditorView, files: File[]) => {
      const imageFiles = files.filter((file) => file.type.startsWith("image/"));
      if (imageFiles.length === 0) return false;

      try {
        for (const file of imageFiles) {
          const imageUrl = await uploadImageFile(file);
          const alt = file.name.replace(/\.[^.]+$/, "") || "image";
          insertImageMarkdown(view, imageUrl, alt);
        }
        toast.success("이미지를 업로드했습니다.");
      } catch (error) {
        console.error(error);
        toast.error("이미지 업로드에 실패했습니다.");
      }

      return true;
    },
    [insertImageMarkdown]
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
        const files = Array.from(event.clipboardData?.files ?? []);
        const hasImage = files.some((file) => file.type.startsWith("image/"));
        if (hasImage) {
          event.preventDefault();
          void handleImageFiles(view, files);
          return true;
        }

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
      handleDrop: (view, event) => {
        const files = Array.from(event.dataTransfer?.files ?? []);
        const hasImage = files.some((file) => file.type.startsWith("image/"));
        if (!hasImage) return false;
        event.preventDefault();
        void handleImageFiles(view, files);
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

  const templateEditor = useEditor({
    extensions,
    content: "",
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class: "tiptap-editor",
      },
    },
  });

  const templateEditorEmpty = templateEditor?.isEmpty ?? true;

  const resetTemplateForm = React.useCallback(() => {
    setTemplateForm({ name: "", title: "", content: "" });
  }, []);

  const loadTemplateList = React.useCallback(async () => {
    setTemplateLoading(true);
    try {
      const response = await get<PostTemplateSummaryRes[]>(
        "/api/posts/templates",
        { withAuth: true }
      );
      setTemplateList(response.data ?? []);
    } catch (error) {
      console.error(error);
      toast.error("템플릿 목록을 불러오지 못했습니다.");
    } finally {
      setTemplateLoading(false);
    }
  }, []);

  const openTemplateModal = React.useCallback(() => {
    setTemplateOpen(true);
    setTemplateMode("list");
    void loadTemplateList();
  }, [loadTemplateList]);

  const fetchTemplateDetail = React.useCallback(async (id: number) => {
    const response = await get<PostTemplateInfoDto>(
      `/api/posts/templates/${id}`,
      { withAuth: true }
    );
    return response.data;
  }, []);

  const applyTemplateToEditor = React.useCallback(
    (template: PostTemplateInfoDto) => {
      setTitle(template.title ?? "");
      if (!editor) return;
      const html = markdownToHtml(template.content ?? "", {
        preserveEmptyLines: true,
        highlight: false,
      });
      editor.commands.setContent(html);
      editor.commands.focus("end");
    },
    [editor]
  );

  const handleSelectTemplate = React.useCallback(
    async (id: number) => {
      try {
        const template = await fetchTemplateDetail(id);
        applyTemplateToEditor(template);
        toast.success("템플릿을 불러왔습니다.");
        setTemplateOpen(false);
      } catch (error) {
        console.error(error);
        toast.error("템플릿을 불러오지 못했습니다.");
      }
    },
    [applyTemplateToEditor, fetchTemplateDetail]
  );

  const handleEditTemplate = React.useCallback(
    async (id: number) => {
      try {
        const template = await fetchTemplateDetail(id);
        setTemplateForm({
          id: template.id,
          name: template.name ?? "",
          title: template.title ?? "",
          content: template.content ?? "",
        });
        setTemplateMode("edit");
      } catch (error) {
        console.error(error);
        toast.error("템플릿 정보를 불러오지 못했습니다.");
      }
    },
    [fetchTemplateDetail]
  );

  React.useEffect(() => {
    if (!templateEditor || !templateOpen || templateMode === "list") return;
    const html = markdownToHtml(templateForm.content ?? "", {
      preserveEmptyLines: true,
      highlight: false,
    });
    templateEditor.commands.setContent(html);
  }, [templateEditor, templateForm.content, templateMode, templateOpen]);

  const handleDeleteTemplate = React.useCallback(
    async (id: number) => {
      const confirmed = window.confirm("템플릿을 삭제할까요?");
      if (!confirmed) return;
      try {
        await del(`/api/posts/templates/${id}`, { withAuth: true });
        setTemplateList((prev) => prev.filter((item) => item.id !== id));
        toast.success("템플릿을 삭제했습니다.");
      } catch (error) {
        console.error(error);
        toast.error("템플릿 삭제에 실패했습니다.");
      }
    },
    []
  );

  const handleSaveTemplate = React.useCallback(async () => {
    const content =
      templateEditor?.state.doc
        ? docToMarkdown(templateEditor.state.doc, { paragraphSeparator: "\n" })
        : templateForm.content;
    if (!templateForm.name.trim()) {
      toast.error("템플릿 이름을 입력하세요.");
      return;
    }
    if (!templateForm.title.trim() || !content.trim()) {
      toast.error("템플릿 제목과 본문을 입력하세요.");
      return;
    }
    setTemplateSaving(true);
    try {
      if (templateMode === "create") {
        await post(
          "/api/posts/templates",
          {
            name: templateForm.name.trim(),
            title: templateForm.title.trim(),
            content,
          },
          { withAuth: true }
        );
        toast.success("템플릿을 추가했습니다.");
      } else if (templateMode === "edit" && templateForm.id) {
        await put(
          `/api/posts/templates/${templateForm.id}`,
          {
            name: templateForm.name.trim(),
            title: templateForm.title.trim(),
            content,
          },
          { withAuth: true }
        );
        toast.success("템플릿을 수정했습니다.");
      }
      resetTemplateForm();
      setTemplateMode("list");
      await loadTemplateList();
    } catch (error) {
      console.error(error);
      toast.error("템플릿 저장에 실패했습니다.");
    } finally {
      setTemplateSaving(false);
    }
  }, [loadTemplateList, resetTemplateForm, templateEditor, templateForm, templateMode]);

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
    if (!isEditMode || !editPostId || !editor) return;
    if (editLoadedRef.current === editPostId) return;
    editLoadedRef.current = editPostId;
    const run = async () => {
      try {
        const response = await get<PostEditRes>(`/api/posts/${editPostId}`, {
          withAuth: true,
        });
        const data = response.data;
        setTitle(data.title ?? "");
        setEditThumbnail(data.thumbnail ?? "");
        const html = markdownToHtml(data.content ?? "", {
          preserveEmptyLines: true,
          highlight: false,
        });
        editor.commands.setContent(html);
        editor.commands.focus("end");
      } catch (error) {
        console.error(error);
        toast.error("게시글 정보를 불러오지 못했습니다.");
        router.push("/home");
      }
    };
    void run();
  }, [editor, editPostId, isEditMode, router]);

  const buildDraft = React.useCallback(() => {
    if (!editor) return null;
    const trimmedTitle = title.trim();
    const markdown = docToMarkdown(editor.state.doc);
    const trimmedContent = markdown.trim();
    if (!trimmedTitle || !trimmedContent) {
      toast.error("제목과 본문을 모두 입력하세요.");
      return null;
    }
    return {
      title: trimmedTitle,
      content: markdown,
      tags,
      postId: isEditMode && editPostId ? editPostId : undefined,
      thumbnail: isEditMode ? (editThumbnail ? editThumbnail : null) : undefined,
    };
  }, [editPostId, editThumbnail, editor, isEditMode, tags, title]);

  const handleTempSave = React.useCallback(() => {
    const draft = buildDraft();
    if (!draft) return;
    saveWriteDraft(draft);
    toast.success("임시저장되었습니다.");
  }, [buildDraft]);

  const handleProceed = React.useCallback(() => {
    const draft = buildDraft();
    if (!draft) return;
    saveWriteDraft(draft);
    if (isEditMode && editPostId) {
      router.push(`/write/confirm?mode=edit&postId=${editPostId}`);
    } else {
      router.push("/write/confirm");
    }
  }, [buildDraft, editPostId, isEditMode, router]);

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
        highlight: true,
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

  if (!authChecked || !authed) {
    return null;
  }

  return (
    <div
      className="flex min-h-screen flex-col overflow-hidden bg-gradient-to-br from-amber-50 via-orange-50 to-rose-50 pt-16 text-neutral-900"
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
              <input
                ref={imageInputRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={(event) => {
                  const nextFiles = Array.from(event.target.files ?? []);
                  if (!editor || nextFiles.length === 0) return;
                  void handleImageFiles(editor.view, nextFiles);
                  event.currentTarget.value = "";
                }}
              />
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
                onClick={() => imageInputRef.current?.click()}
                className="toolbar-pill"
              >
                Image
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
                className="tiptap-preview"
                dangerouslySetInnerHTML={{ __html: previewHtml }}
              />
            )}
          </div>
        </div>
      </section>

      <footer className="flex shrink-0 items-center justify-end gap-3 border-t border-neutral-200 bg-white/90 px-6 py-4 backdrop-blur">
        {!isEditMode && (
          <button
            type="button"
            onClick={openTemplateModal}
            className="rounded-full border border-neutral-300 px-6 py-3 text-sm font-semibold text-neutral-600 transition hover:-translate-y-0.5 hover:border-neutral-900 hover:text-neutral-900"
          >
            불러오기
          </button>
        )}
        {!isEditMode && (
          <button
            type="button"
            onClick={handleTempSave}
            className="rounded-full border border-neutral-900 bg-white px-6 py-3 text-sm font-semibold text-neutral-900 transition hover:-translate-y-0.5 hover:bg-neutral-900 hover:text-white"
          >
            임시저장
          </button>
        )}
        <button
          type="button"
          onClick={() =>
            isEditMode && editPostId ? router.push(`/posts/${editPostId}`) : router.push("/home")
          }
          className="rounded-full border border-neutral-300 px-6 py-3 text-sm font-semibold text-neutral-600 transition hover:-translate-y-0.5 hover:border-neutral-900 hover:text-neutral-900"
        >
          나가기
        </button>
        <button
          type="button"
          onClick={handleProceed}
          className="rounded-full bg-neutral-900 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-neutral-900/20 transition hover:-translate-y-0.5 hover:bg-black"
        >
          {isEditMode ? "수정하기" : "저장"}
        </button>
      </footer>

      {templateOpen && !isEditMode && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 py-8">
          <div
            className={`w-full rounded-2xl bg-white p-6 shadow-2xl ${
              templateMode === "list"
                ? "max-w-2xl"
                : "max-w-4xl max-h-[85vh] flex flex-col"
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="text-lg font-semibold text-neutral-900">
                템플릿{" "}
                {templateMode === "list"
                  ? "불러오기"
                  : templateMode === "create"
                    ? "추가"
                    : "편집"}
              </div>
              <button
                type="button"
                onClick={() => {
                  setTemplateOpen(false);
                  setTemplateMode("list");
                  resetTemplateForm();
                }}
                className="rounded-full border border-neutral-200 px-3 py-1 text-xs text-neutral-500 hover:border-neutral-400"
              >
                닫기
              </button>
            </div>

            {templateMode === "list" ? (
              <div className="mt-4">
                <div className="flex items-center justify-between">
                  <div className="text-sm text-neutral-500">
                    템플릿을 선택하면 바로 적용됩니다.
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      resetTemplateForm();
                      setTemplateMode("create");
                    }}
                    className="rounded-full border border-neutral-900 px-4 py-2 text-xs font-semibold text-neutral-900 hover:bg-neutral-900 hover:text-white"
                  >
                    추가하기
                  </button>
                </div>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  {templateLoading && (
                    <div className="text-sm text-neutral-400">불러오는 중...</div>
                  )}
                  {!templateLoading && templateList.length === 0 && (
                    <div className="text-sm text-neutral-400">
                      저장된 템플릿이 없습니다.
                    </div>
                  )}
                  {!templateLoading &&
                    templateList.map((item) => (
                      <div
                        key={item.id}
                        role="button"
                        tabIndex={0}
                        onClick={() => handleSelectTemplate(item.id)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault();
                            handleSelectTemplate(item.id);
                          }
                        }}
                        className="group relative cursor-pointer rounded-xl border border-neutral-200 bg-white p-4 text-left shadow-sm transition hover:border-neutral-400 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-400"
                      >
                        <div className="text-sm font-semibold text-neutral-900">
                          {item.name}
                        </div>
                        <div className="absolute right-3 top-3 flex gap-2 opacity-0 transition group-hover:opacity-100">
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              void handleEditTemplate(item.id);
                            }}
                            className="flex h-8 w-8 items-center justify-center rounded-full border border-neutral-200 bg-white text-neutral-600 hover:border-neutral-400"
                            aria-label="템플릿 수정"
                          >
                            <svg
                              width="16"
                              height="16"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            >
                              <path d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.592c.55 0 1.02.398 1.11.94l.214 1.281c.07.424.37.776.778.93.5.19.96.42 1.377.68.36.22.82.21 1.18-.02l1.12-.7c.48-.3 1.11-.24 1.53.16l1.83 1.83c.4.4.46 1.03.16 1.53l-.7 1.12c-.23.36-.24.82-.02 1.18.26.42.49.88.68 1.38.15.41.5.71.93.78l1.28.21c.54.09.94.56.94 1.11v2.59c0 .55-.4 1.02-.94 1.11l-1.28.21c-.43.07-.78.37-.93.78-.19.5-.42.96-.68 1.38-.22.36-.21.82.02 1.18l.7 1.12c.3.5.24 1.13-.16 1.53l-1.83 1.83c-.4.4-1.03.46-1.53.16l-1.12-.7c-.36-.23-.82-.24-1.18-.02-.42.26-.88.49-1.38.68-.41.15-.71.5-.78.93l-.21 1.28c-.09.54-.56.94-1.11.94h-2.59c-.55 0-1.02-.4-1.11-.94l-.21-1.28c-.07-.43-.37-.78-.78-.93-.5-.19-.96-.42-1.38-.68-.36-.22-.82-.21-1.18.02l-1.12.7c-.5.3-1.13.24-1.53-.16l-1.83-1.83c-.4-.4-.46-1.03-.16-1.53l.7-1.12c.23-.36.24-.82.02-1.18-.26-.42-.49-.88-.68-1.38-.15-.41-.5-.71-.93-.78l-1.28-.21c-.54-.09-.94-.56-.94-1.11v-2.59c0-.55.4-1.02.94-1.11l1.28-.21c.43-.07.78-.37.93-.78.19-.5.42-.96.68-1.38.22-.36.21-.82-.02-1.18l-.7-1.12c-.3-.5-.24-1.13.16-1.53l1.83-1.83c.4-.4 1.03-.46 1.53-.16l1.12.7c.36.23.82.24 1.18.02.42-.26.88-.49 1.38-.68.41-.15.71-.5.78-.93l.21-1.28z" />
                              <path d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            </svg>
                          </button>
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              void handleDeleteTemplate(item.id);
                            }}
                            className="flex h-8 w-8 items-center justify-center rounded-full border border-neutral-200 bg-white text-neutral-600 hover:border-neutral-400"
                            aria-label="템플릿 삭제"
                          >
                            <svg
                              width="16"
                              height="16"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            >
                              <path d="M3 6h18" />
                              <path d="M8 6V4h8v2" />
                              <path d="M6 6l1 14h10l1-14" />
                              <path d="M10 11v6" />
                              <path d="M14 11v6" />
                            </svg>
                          </button>
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            ) : (
              <div className="mt-4 flex flex-1 flex-col gap-4 overflow-hidden">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-neutral-500">
                    템플릿 이름
                  </label>
                  <input
                    value={templateForm.name}
                    onChange={(event) =>
                      setTemplateForm((prev) => ({ ...prev, name: event.target.value }))
                    }
                    className="w-full rounded-xl border border-neutral-200 bg-white px-4 py-3 text-sm outline-none focus:border-neutral-400"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-neutral-500">
                    제목
                  </label>
                  <input
                    value={templateForm.title}
                    onChange={(event) =>
                      setTemplateForm((prev) => ({ ...prev, title: event.target.value }))
                    }
                    className="w-full rounded-xl border border-neutral-200 bg-white px-4 py-3 text-sm outline-none focus:border-neutral-400"
                  />
                </div>
                <div className="flex flex-1 flex-col gap-3 overflow-hidden">
                  <label className="mb-1 block text-xs font-semibold text-neutral-500">
                    본문
                  </label>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => templateEditor?.chain().focus().toggleBold().run()}
                      className={`toolbar-pill ${templateEditor?.isActive("bold") ? "is-active" : ""}`}
                    >
                      Bold
                    </button>
                    <button
                      type="button"
                      onClick={() => templateEditor?.chain().focus().toggleItalic().run()}
                      className={`toolbar-pill ${templateEditor?.isActive("italic") ? "is-active" : ""}`}
                    >
                      Italic
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        templateEditor?.chain().focus().toggleHeading({ level: 1 }).run()
                      }
                      className={`toolbar-pill ${templateEditor?.isActive("heading", { level: 1 }) ? "is-active" : ""}`}
                    >
                      H1
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        templateEditor?.chain().focus().toggleHeading({ level: 2 }).run()
                      }
                      className={`toolbar-pill ${templateEditor?.isActive("heading", { level: 2 }) ? "is-active" : ""}`}
                    >
                      H2
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        templateEditor?.chain().focus().toggleHeading({ level: 3 }).run()
                      }
                      className={`toolbar-pill ${templateEditor?.isActive("heading", { level: 3 }) ? "is-active" : ""}`}
                    >
                      H3
                    </button>
                    <button
                      type="button"
                      onClick={() => templateEditor?.chain().focus().toggleBulletList().run()}
                      className={`toolbar-pill ${templateEditor?.isActive("bulletList") ? "is-active" : ""}`}
                    >
                      List
                    </button>
                    <button
                      type="button"
                      onClick={() => templateEditor?.chain().focus().toggleCodeBlock().run()}
                      className={`toolbar-pill ${templateEditor?.isActive("codeBlock") ? "is-active" : ""}`}
                    >
                      Code
                    </button>
                  </div>
                  <div className="relative flex-1 min-h-[420px] sm:min-h-[640px] overflow-auto rounded-2xl border border-neutral-200 bg-white/70 p-3">
                    {templateEditorEmpty && (
                      <div className="pointer-events-none absolute left-4 top-3 text-neutral-400">
                        템플릿 본문을 입력하세요. (Markdown 지원)
                      </div>
                    )}
                    <EditorContent editor={templateEditor} />
                  </div>
                </div>
                <div className="flex items-center justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setTemplateMode("list");
                      resetTemplateForm();
                    }}
                    className="rounded-full border border-neutral-300 px-5 py-2 text-xs font-semibold text-neutral-600 hover:border-neutral-500 hover:text-neutral-900"
                  >
                    취소
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveTemplate}
                    disabled={templateSaving}
                    className="rounded-full bg-neutral-900 px-5 py-2 text-xs font-semibold text-white hover:bg-black disabled:opacity-60"
                  >
                    {templateSaving ? "저장 중..." : "저장"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
