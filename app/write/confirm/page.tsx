"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "react-hot-toast";
import { post, put } from "@/lib/apiClient";
import { renderMarkdown } from "@/lib/markdown";
import { uploadImageFile } from "@/lib/imageUpload";
import {
  buildDefaultThumbnails,
  extractImageUrls,
  renderDefaultThumbnail,
  type DefaultThumbnailSpec,
} from "@/lib/thumbnail";
import { clearWriteDraft, loadWriteDraft, type WriteDraft } from "@/lib/writeDraft";

type ThumbnailSource = "content" | "upload" | "default" | "existing";

type ThumbnailOption = {
  id: string;
  url: string;
  label: string;
  source: ThumbnailSource;
};

function filenameFromUrl(url: string, fallback: string) {
  try {
    const parsed = new URL(url);
    const last = parsed.pathname.split("/").filter(Boolean).pop();
    return last ?? fallback;
  } catch {
    return fallback;
  }
}

export default function WriteConfirmPage() {
  const router = useRouter();
  const [draft, setDraft] = React.useState<WriteDraft | null>(null);
  const [uploadedThumbs, setUploadedThumbs] = React.useState<string[]>([]);
  const [selectedId, setSelectedId] = React.useState<string>("");
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const uploadInputRef = React.useRef<HTMLInputElement | null>(null);

  React.useEffect(() => {
    const nextDraft = loadWriteDraft();
    if (!nextDraft) {
      toast.error("작성 중인 글을 찾지 못했습니다.");
      router.replace("/write");
      return;
    }
    setDraft(nextDraft);
  }, [router]);

  const contentImageUrls = React.useMemo(() => {
    if (!draft) return [];
    return extractImageUrls(draft.content);
  }, [draft]);

  const defaultThumbnails = React.useMemo<DefaultThumbnailSpec[]>(() => {
    if (!draft) return [];
    return buildDefaultThumbnails(draft.title);
  }, [draft]);

  const defaultFilesRef = React.useRef<Record<string, File>>({});
  const [defaultPreviewUrls, setDefaultPreviewUrls] = React.useState<
    Record<string, string>
  >({});

  React.useEffect(() => {
    if (defaultThumbnails.length === 0) {
      defaultFilesRef.current = {};
      setDefaultPreviewUrls({});
      return;
    }

    let cancelled = false;
    const createdUrls: string[] = [];

    const run = async () => {
      try {
        const rendered = await Promise.all(
          defaultThumbnails.map(async (spec) => {
            const { file, previewUrl } = await renderDefaultThumbnail(spec);
            return { id: spec.id, file, previewUrl };
          })
        );
        if (cancelled) {
          rendered.forEach((item) => URL.revokeObjectURL(item.previewUrl));
          return;
        }
        const nextFiles: Record<string, File> = {};
        const nextUrls: Record<string, string> = {};
        rendered.forEach((item) => {
          nextFiles[item.id] = item.file;
          nextUrls[item.id] = item.previewUrl;
          createdUrls.push(item.previewUrl);
        });
        defaultFilesRef.current = nextFiles;
        setDefaultPreviewUrls(nextUrls);
      } catch (error) {
        console.error(error);
        toast.error("기본 썸네일 생성에 실패했습니다.");
      }
    };

    void run();

    return () => {
      cancelled = true;
      createdUrls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [defaultThumbnails]);

  const defaultSpecById = React.useMemo(() => {
    const map = new Map<string, DefaultThumbnailSpec>();
    defaultThumbnails.forEach((spec) => map.set(spec.id, spec));
    return map;
  }, [defaultThumbnails]);

  const options = React.useMemo<ThumbnailOption[]>(() => {
    const fromExisting =
      draft?.thumbnail && draft.thumbnail.trim()
        ? [
            {
              id: "existing",
              url: draft.thumbnail.trim(),
              label: "기존 썸네일",
              source: "existing" as const,
            },
          ]
        : [];
    const fromContent = contentImageUrls.map((url, index) => ({
      id: `content-${index + 1}`,
      url,
      label: `본문 이미지 ${index + 1}`,
      source: "content" as const,
    }));
    const fromUploads = uploadedThumbs.map((url, index) => ({
      id: `upload-${index + 1}`,
      url,
      label: `업로드 썸네일 ${index + 1}`,
      source: "upload" as const,
    }));
    const fromDefaults = defaultThumbnails
      .map((item) => {
        const previewUrl = defaultPreviewUrls[item.id];
        if (!previewUrl) return null;
        return {
          id: item.id,
          url: previewUrl,
          label: item.label,
          source: "default" as const,
        };
      })
      .filter((item): item is ThumbnailOption => item !== null);
    return [...fromExisting, ...fromContent, ...fromUploads, ...fromDefaults];
  }, [contentImageUrls, defaultPreviewUrls, defaultThumbnails, draft, uploadedThumbs]);

  React.useEffect(() => {
    if (options.length === 0) return;
    if (selectedId) return;
    const firstExisting = options.find((item) => item.source === "existing");
    const firstContent = options.find((item) => item.source === "content");
    setSelectedId((firstExisting ?? firstContent ?? options[0]).id);
  }, [options, selectedId]);

  const selectedOption = options.find((item) => item.id === selectedId) ?? null;

  const reuploadThumbnailIfNeeded = React.useCallback(async (option: ThumbnailOption) => {
    if (
      option.source === "upload" ||
      option.source === "content" ||
      option.source === "existing"
    ) {
      return option.url;
    }

    try {
      if (option.source === "default") {
        const cachedFile = defaultFilesRef.current[option.id];
        if (cachedFile) {
          return await uploadImageFile(cachedFile);
        }
        const spec = defaultSpecById.get(option.id);
        if (!spec) {
          throw new Error("기본 썸네일 정보를 찾지 못했습니다.");
        }
        const { file } = await renderDefaultThumbnail(spec);
        return await uploadImageFile(file);
      }

      const name = filenameFromUrl(option.url, "thumbnail.png");
      const response = await fetch(option.url);
      const blob = await response.blob();
      const file = new File([blob], name, {
        type: blob.type || "image/png",
      });
      return await uploadImageFile(file);
    } catch (error) {
      console.error(error);
      const message =
        error instanceof Error ? error.message : "썸네일 업로드에 실패했습니다.";
      toast.error(message);
      return option.url;
    }
  }, [defaultSpecById]);

  const handleUploadThumbnail = React.useCallback(
    async (files: FileList | null) => {
      const nextFiles = Array.from(files ?? []).filter((file) =>
        file.type.startsWith("image/")
      );
      if (nextFiles.length === 0) return;

      try {
        const newUrls: string[] = [];
        for (const file of nextFiles) {
          const url = await uploadImageFile(file);
          newUrls.push(url);
        }
        setUploadedThumbs((prev) => [...newUrls, ...prev]);
        toast.success("썸네일 이미지를 업로드했습니다.");
      } catch (error) {
        console.error(error);
        toast.error("썸네일 업로드에 실패했습니다.");
      }
    },
    []
  );

  const handleSubmit = React.useCallback(async () => {
    if (!draft) return;
    if (!selectedOption) {
      toast.error("썸네일을 선택해 주세요.");
      return;
    }

    setIsSubmitting(true);
    try {
      const thumbnailUrl = await reuploadThumbnailIfNeeded(selectedOption);
      if (draft.postId) {
        await put(
          `/api/posts/${draft.postId}`,
          {
            title: draft.title,
            content: draft.content,
            thumbnail: thumbnailUrl,
          },
          { withAuth: true }
        );
        try {
          window.sessionStorage.setItem(
            "post-cache-bust",
            String(draft.postId)
          );
        } catch {
          // ignore cache bust failures
        }
        clearWriteDraft();
        toast.success("수정되었습니다.");
        router.push(`/posts/${draft.postId}`);
      } else {
        await post(
          "/api/posts",
          {
            title: draft.title,
            content: draft.content,
            thumbnail: thumbnailUrl,
          },
          { withAuth: true }
        );
        clearWriteDraft();
        toast.success("저장되었습니다.");
        router.push("/home");
      }
    } catch (error) {
      console.error(error);
      toast.error(
        draft.postId ? "수정에 실패했습니다. 잠시 후 다시 시도해 주세요." : "저장에 실패했습니다. 잠시 후 다시 시도해 주세요."
      );
    } finally {
      setIsSubmitting(false);
    }
  }, [draft, reuploadThumbnailIfNeeded, router, selectedOption]);

  if (!draft) return null;

  return (
    <div className="min-h-screen bg-neutral-50 pt-20 text-neutral-900">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 pb-16 sm:px-6 lg:px-8">
        <header className="flex flex-col gap-2">
          <h1 className="text-3xl font-bold tracking-tight">썸네일 선택</h1>
          <p className="text-sm text-neutral-600">
            본문 이미지, 새 업로드, 기본 썸네일 중 하나를 선택해 저장하세요.
          </p>
        </header>

        <section className="grid grid-cols-1 gap-8 lg:grid-cols-3">
          <div className="flex flex-col gap-4 lg:col-span-2">
            <div className="flex items-center gap-3">
              <input
                ref={uploadInputRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={(event) => {
                  void handleUploadThumbnail(event.target.files);
                  event.currentTarget.value = "";
                }}
              />
              <button
                type="button"
                onClick={() => uploadInputRef.current?.click()}
                className="rounded-full bg-neutral-900 px-5 py-2 text-sm font-semibold text-white transition hover:bg-black"
              >
                새 썸네일 업로드
              </button>
              <button
                type="button"
                onClick={() =>
                  draft?.postId
                    ? router.push(`/write?mode=edit&postId=${draft.postId}`)
                    : router.push("/write")
                }
                className="rounded-full border border-neutral-300 px-5 py-2 text-sm font-semibold text-neutral-700 transition hover:border-neutral-900 hover:text-neutral-900"
              >
                이전으로
              </button>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {options.map((option) => {
                const isSelected = option.id === selectedId;
                return (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => setSelectedId(option.id)}
                    className={`flex flex-col overflow-hidden rounded-2xl border bg-white text-left transition ${
                      isSelected
                        ? "border-neutral-900 ring-2 ring-neutral-900"
                        : "border-neutral-200 hover:border-neutral-400"
                    }`}
                  >
                    <div className="aspect-[1200/630] w-full bg-neutral-100">
                      <img
                        src={option.url}
                        alt={option.label}
                        className="h-full w-full object-cover"
                        loading="lazy"
                      />
                    </div>
                    <div className="flex items-center justify-between px-4 py-3">
                      <div className="flex flex-col">
                        <span className="text-sm font-semibold text-neutral-900">
                          {option.label}
                        </span>
                        <span className="text-xs text-neutral-500">
                          {option.source === "content"
                            ? "본문 이미지"
                            : option.source === "upload"
                            ? "새 업로드"
                            : "기본 제공"}
                        </span>
                      </div>
                      {isSelected && (
                        <span className="rounded-full bg-neutral-900 px-3 py-1 text-xs font-semibold text-white">
                          선택됨
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <aside className="flex flex-col gap-4">
            <div className="rounded-2xl border border-neutral-200 bg-white p-5">
              <h2 className="text-base font-semibold">선택한 썸네일 URL</h2>
              <p className="mt-2 break-all text-xs text-neutral-600">
                {selectedOption ? `![image](${selectedOption.url})` : "선택된 썸네일이 없습니다."}
              </p>
            </div>

            <div className="rounded-2xl border border-neutral-200 bg-white p-5">
              <h2 className="text-base font-semibold">미리보기</h2>
              <div className="mt-4 overflow-hidden rounded-xl border border-neutral-200">
                {selectedOption ? (
                  <img
                    src={selectedOption.url}
                    alt="selected thumbnail preview"
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-40 items-center justify-center text-sm text-neutral-500">
                    썸네일을 선택하세요.
                  </div>
                )}
              </div>
            </div>

            <button
              type="button"
              onClick={handleSubmit}
              disabled={isSubmitting || !selectedOption}
              className="rounded-2xl bg-neutral-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-black disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSubmitting
                ? draft?.postId
                  ? "수정 중..."
                  : "저장 중..."
                : draft?.postId
                ? "이 설정으로 수정"
                : "이 설정으로 저장"}
            </button>
          </aside>
        </section>

        <section className="rounded-2xl border border-neutral-200 bg-white p-6">
          <header className="flex flex-col gap-1">
            <h2 className="text-xl font-semibold">{draft.title}</h2>
            <p className="text-xs text-neutral-500">
              {draft.postId ? "수정 전 본문 미리보기" : "저장 전 본문 미리보기"}
            </p>
          </header>
          <div
            className="mt-6 text-sm"
            dangerouslySetInnerHTML={{ __html: renderMarkdown(draft.content) }}
          />
        </section>
      </div>
    </div>
  );
}
