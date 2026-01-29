"use client";

import * as React from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { del, get, post, put } from "@/lib/apiClient";
import {
  getMyId,
  getMyNickname,
  getMyProfileImage,
  isAuthed,
} from "@/lib/auth";
import { formatDateTime } from "@/lib/date";
import { markdownToHtml } from "@/lib/markdown";
import { toast } from "react-hot-toast";

type Slice<T> = {
  content: T[];
  number?: number;
  size?: number;
  first?: boolean;
  last?: boolean;
  empty?: boolean;
};

type ReplyInfoRes = {
  id: number;
  content: string;
  parentCommentId: number;
  authorId: number;
  authorNickname?: string;
  nickname?: string;
  profileUrl?: string | null;
  profileImageUrl?: string | null;
  profileImage?: string | null;
  createDate: string | null;
  modifyDate: string | null;
};

type CommentInfoRes = {
  id: number;
  content: string;
  authorId: number;
  authorNickname?: string;
  nickname?: string;
  profileUrl?: string | null;
  profileImageUrl?: string | null;
  profileImage?: string | null;
  postId: number;
  createDate: string | null;
  modifyDate: string | null;
  replyCount: number;
  previewReplies?: Slice<ReplyInfoRes> | null;
};

type PostInfoRes = {
  id: number;
  title: string;
  content: string;
  summary: string;
  viewCount: number;
  createDate: string | null;
  modifyDate: string | null;
  authorId?: number | null;
  memberId?: number | null;
  userId?: number | null;
  hashtags?: string[] | null;
  nickname?: string | null;
  profileImage?: string | null;
  profileImageUrl?: string | null;
  thumbnail?: string | null;
  comments?: Slice<CommentInfoRes> | null;
};

type ReplyState = {
  items: ReplyInfoRes[];
  page: number;
  hasNext: boolean;
  loading: boolean;
  pagesFetched: Set<number>;
};

type CommentCache = {
  items: CommentInfoRes[];
  page: number;
  hasNext: boolean;
  pagesFetched: number[];
};

type ReplyCache = Record<
  number,
  {
    items: ReplyInfoRes[];
    page: number;
    hasNext: boolean;
    pagesFetched: number[];
  }
>;

const postRequestCache = new Map<string, Promise<PostInfoRes>>();
const fallbackAvatar =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 96 96"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#e2e8f0"/><stop offset="100%" stop-color="#cbd5f5"/></linearGradient></defs><rect width="96" height="96" rx="48" fill="url(#g)"/><circle cx="48" cy="38" r="16" fill="#ffffff"/><path d="M20 80c4-16 20-24 28-24s24 8 28 24" fill="#ffffff"/></svg>'
  );

async function fetchPostOnce(postId: string) {
  const cached = postRequestCache.get(postId);
  if (cached) return cached;
  const request = get(`/api/posts/${postId}`, { withAuth: true })
    .then((response) => response.data as PostInfoRes)
    .catch((error) => {
      postRequestCache.delete(postId);
      throw error;
    });
  postRequestCache.set(postId, request);
  return request;
}

function getDateLabel(dateValue: string | null | undefined) {
  if (!dateValue) return "";
  return formatDateTime(dateValue, "ko-KR");
}

function getDisplayName(
  person?: { nickname?: string | null; authorNickname?: string | null }
) {
  return person?.nickname ?? person?.authorNickname ?? "작성자";
}

function getProfileUrl(
  person?: {
    profileUrl?: string | null;
    profileImageUrl?: string | null;
    profileImage?: string | null;
  },
  overrideUrl?: string | null
) {
  return (
    overrideUrl ??
    person?.profileUrl ??
    person?.profileImageUrl ??
    person?.profileImage ??
    null
  );
}

function getProfileUrlOrFallback(
  person?: {
    profileUrl?: string | null;
    profileImageUrl?: string | null;
    profileImage?: string | null;
  },
  overrideUrl?: string | null
) {
  return getProfileUrl(person, overrideUrl) ?? fallbackAvatar;
}

function getPostAuthorId(post?: PostInfoRes | null) {
  if (!post) return null;
  const candidates = [post.authorId, post.memberId, post.userId];
  for (const value of candidates) {
    if (typeof value === "number" && Number.isFinite(value)) return value;
  }
  return null;
}

function mergeById<T extends { id: number }>(prev: T[], next: T[]) {
  const map = new Map<number, T>();
  prev.forEach((item) => map.set(item.id, item));
  next.forEach((item) => map.set(item.id, item));
  return Array.from(map.values());
}

export default function PostDetailPage() {
  const params = useParams<{ postId: string }>();
  const postId = params?.postId;

  const [postData, setPostData] = React.useState<PostInfoRes | null>(null);
  const [comments, setComments] = React.useState<CommentInfoRes[]>([]);
  const [commentPage, setCommentPage] = React.useState(0);
  const [hasNextComments, setHasNextComments] = React.useState(false);
  const [commentPagesFetched, setCommentPagesFetched] = React.useState<Set<number>>(
    () => new Set()
  );
  const [loading, setLoading] = React.useState(true);
  const [commentLoading, setCommentLoading] = React.useState(false);
  const [commentInput, setCommentInput] = React.useState("");
  const [replyState, setReplyState] = React.useState<Record<number, ReplyState>>({});
  const [replyInputs, setReplyInputs] = React.useState<Record<number, string>>({});
  const [replyOpen, setReplyOpen] = React.useState<Record<number, boolean>>({});
  const [editingId, setEditingId] = React.useState<number | null>(null);
  const [editingContent, setEditingContent] = React.useState("");
  const [authorLinkId, setAuthorLinkId] = React.useState<number | null>(null);
  const router = useRouter();
  const initialCommentsAppliedRef = React.useRef<string | null>(null);
  const commentsCacheHitRef = React.useRef(false);

  const [myId, setMyId] = React.useState<number | null>(null);
  const [myNickname, setMyNickname] = React.useState<string | null>(null);
  const [myProfileImage, setMyProfileImage] = React.useState<string | null>(null);
  const [isLoggedIn, setIsLoggedIn] = React.useState<boolean>(false);

  React.useEffect(() => {
    const syncAuth = () => {
      setMyId(getMyId());
      setMyNickname(getMyNickname());
      setMyProfileImage(getMyProfileImage());
      setIsLoggedIn(isAuthed());
    };
    syncAuth();
    window.addEventListener("auth-change", syncAuth);
    return () => {
      window.removeEventListener("auth-change", syncAuth);
    };
  }, []);
  const isOwner = React.useMemo(() => {
    if (!postData) return false;
    const authorId = getPostAuthorId(postData);
    if (authorId !== null && myId !== null) return authorId === myId;
    if (postData.nickname && typeof postData.nickname === "string") {
      if (myNickname && myNickname.trim()) {
        return myNickname === postData.nickname;
      }
    }
    return false;
  }, [myId, myNickname, postData]);

  const commentCacheKey = React.useMemo(
    () => (postId ? `post-comments:${postId}` : null),
    [postId]
  );
  const replyCacheKey = React.useMemo(
    () => (postId ? `post-replies:${postId}` : null),
    [postId]
  );

  React.useEffect(() => {
    if (!postId) return;
    try {
      const cacheBust = window.sessionStorage.getItem("post-cache-bust");
      if (cacheBust && cacheBust === String(postId)) {
        postRequestCache.delete(String(postId));
        window.sessionStorage.removeItem("post-cache-bust");
      }
    } catch {
      // ignore cache bust failures
    }
  }, [postId]);

  React.useEffect(() => {
    initialCommentsAppliedRef.current = null;
    commentsCacheHitRef.current = false;
  }, [postId]);

  const loadPost = React.useCallback(async () => {
    if (!postId) return;
    const data = await fetchPostOnce(postId);
    setPostData(data);

    const initialComments = data.comments?.content ?? [];
    if (
      initialComments.length > 0 &&
      !commentsCacheHitRef.current &&
      initialCommentsAppliedRef.current !== postId
    ) {
      setComments(initialComments);
      setCommentPage(data.comments?.number ?? 0);
      setHasNextComments(!(data.comments?.last ?? initialComments.length === 0));
      setCommentPagesFetched(new Set([data.comments?.number ?? 0]));
      initialCommentsAppliedRef.current = postId;

      const nextReplyState: Record<number, ReplyState> = {};
      initialComments.forEach((comment) => {
        const preview = comment.previewReplies;
        const previewItems = preview?.content ?? [];
        if (previewItems.length === 0) return;
        const pageNumber = preview?.number ?? 0;
        const hasNext =
          comment.replyCount > previewItems.length && !(preview?.last ?? false);
        nextReplyState[comment.id] = {
          items: previewItems,
          page: pageNumber,
          hasNext,
          loading: false,
          pagesFetched: new Set([pageNumber]),
        };
      });
      setReplyState((prev) => ({ ...prev, ...nextReplyState }));
    }
  }, [postId]);

  const loadComments = React.useCallback(
    async (page: number, append: boolean, force = false) => {
      if (!postId) return;
      if (!force && commentPagesFetched.has(page)) {
        setCommentPage(page);
        return;
      }
      const response = await get(`/api/posts/${postId}/comments`, {
        withAuth: true,
        query: { pageNumber: page },
      });
      const data = response.data as Slice<CommentInfoRes>;
      const list = data?.content ?? [];
      const isLast = data?.last ?? list.length === 0;
      setHasNextComments(!isLast);
      setCommentPage(page);
      setComments((prev) => (append ? mergeById(prev, list) : list));
      setCommentPagesFetched((prev) => new Set(prev).add(page));
    },
    [commentPagesFetched, postId]
  );

  React.useEffect(() => {
    if (!commentCacheKey) return;
    try {
      const raw = window.sessionStorage.getItem(commentCacheKey);
      if (!raw) return;
      const cache = JSON.parse(raw) as CommentCache;
      const hasCache =
        (cache.items?.length ?? 0) > 0 || (cache.pagesFetched?.length ?? 0) > 0;
      commentsCacheHitRef.current = hasCache;
      setComments(cache.items ?? []);
      setCommentPage(cache.page ?? 0);
      setHasNextComments(Boolean(cache.hasNext));
      setCommentPagesFetched(new Set(cache.pagesFetched ?? []));
    } catch (error) {
      console.error("Failed to load comment cache", error);
    }
  }, [commentCacheKey]);

  React.useEffect(() => {
    if (!replyCacheKey) return;
    try {
      const raw = window.sessionStorage.getItem(replyCacheKey);
      if (!raw) return;
      const cache = JSON.parse(raw) as ReplyCache;
      const next: Record<number, ReplyState> = {};
      Object.entries(cache).forEach(([key, value]) => {
        const id = Number(key);
        if (!Number.isFinite(id)) return;
        next[id] = {
          items: value.items ?? [],
          page: value.page ?? 0,
          hasNext: Boolean(value.hasNext),
          loading: false,
          pagesFetched: new Set(value.pagesFetched ?? []),
        };
      });
      setReplyState((prev) => ({ ...next, ...prev }));
    } catch (error) {
      console.error("Failed to load reply cache", error);
    }
  }, [replyCacheKey]);

  React.useEffect(() => {
    if (!postId) return;
    let active = true;
    const run = async () => {
      try {
        await loadPost();
      } finally {
        if (active) setLoading(false);
      }
    };
    void run();
    return () => {
      active = false;
    };
  }, [loadPost, postId]);

  React.useEffect(() => {
    if (!commentCacheKey) return;
    const cache: CommentCache = {
      items: comments,
      page: commentPage,
      hasNext: hasNextComments,
      pagesFetched: Array.from(commentPagesFetched),
    };
    window.sessionStorage.setItem(commentCacheKey, JSON.stringify(cache));
  }, [commentCacheKey, commentPage, commentPagesFetched, comments, hasNextComments]);

  React.useEffect(() => {
    if (!replyCacheKey) return;
    const cache: ReplyCache = {};
    Object.entries(replyState).forEach(([key, value]) => {
      cache[Number(key)] = {
        items: value.items,
        page: value.page,
        hasNext: value.hasNext,
        pagesFetched: Array.from(value.pagesFetched),
      };
    });
    window.sessionStorage.setItem(replyCacheKey, JSON.stringify(cache));
  }, [replyCacheKey, replyState]);

  const handleLoadMoreComments = async () => {
    if (commentLoading || !hasNextComments) return;
    setCommentLoading(true);
    try {
      await loadComments(commentPage + 1, true);
    } finally {
      setCommentLoading(false);
    }
  };

  const handleSubmitComment = async () => {
    if (!postId) return;
    const content = commentInput.trim();
    if (!content) return;
    try {
      await post(
        `/api/posts/${postId}/comments`,
        { content, parentCommentId: null },
        { withAuth: true }
      );
      setCommentInput("");
      setCommentPagesFetched(new Set());
      await loadComments(0, false, true);
    } catch (error) {
      console.error(error);
      toast.error("댓글 작성에 실패했습니다. 잠시 후 다시 시도해주세요.");
    }
  };

  const loadReplies = React.useCallback(
    async (parentId: number, force = false) => {
      const current = replyState[parentId];
      const nextPage = force ? 0 : current ? current.page + 1 : 0;
      if (!force && current?.pagesFetched.has(nextPage)) return;

      setReplyState((prev) => ({
        ...prev,
        [parentId]: {
          items: force ? [] : prev[parentId]?.items ?? [],
          page: force ? 0 : prev[parentId]?.page ?? 0,
          hasNext: force ? true : prev[parentId]?.hasNext ?? true,
          loading: true,
          pagesFetched: force ? new Set<number>() : prev[parentId]?.pagesFetched ?? new Set<number>(),
        },
      }));

      try {
        const response = await get(`/api/comments/${parentId}/replies`, {
          withAuth: true,
          query: { pageNumber: nextPage },
        });
        const data = response.data as Slice<ReplyInfoRes>;
        const list = data?.content ?? [];
        const isLast = data?.last ?? list.length === 0;
        setReplyState((prev) => {
          const prevState = prev[parentId];
          const pagesFetched = new Set(prevState?.pagesFetched ?? []);
          pagesFetched.add(nextPage);
          return {
            ...prev,
            [parentId]: {
              items: force ? list : mergeById(prevState?.items ?? [], list),
              page: nextPage,
              hasNext: !isLast,
              loading: false,
              pagesFetched,
            },
          };
        });
      } catch (error) {
        console.error(error);
        setReplyState((prev) => ({
          ...prev,
          [parentId]: {
            items: force ? [] : prev[parentId]?.items ?? [],
            page: force ? 0 : prev[parentId]?.page ?? 0,
            hasNext: force ? false : prev[parentId]?.hasNext ?? false,
            loading: false,
            pagesFetched: force ? new Set<number>() : prev[parentId]?.pagesFetched ?? new Set<number>(),
          },
        }));
        toast.error("답글을 불러오지 못했습니다.");
      }
    },
    [replyState]
  );

  const startEdit = React.useCallback((id: number, content: string) => {
    setEditingId(id);
    setEditingContent(content);
  }, []);

  const cancelEdit = React.useCallback(() => {
    setEditingId(null);
    setEditingContent("");
  }, []);

  const handleUpdate = React.useCallback(async () => {
    if (!editingId) return;
    const nextContent = editingContent.trim();
    if (!nextContent) {
      toast.error("내용을 입력해주세요.");
      return;
    }
    try {
      await put(
        `/api/comments/${editingId}`,
        { content: nextContent },
        { withAuth: true }
      );
      const now = new Date().toISOString();
      setComments((prev) =>
        prev.map((item) =>
          item.id === editingId ? { ...item, content: nextContent, modifyDate: now } : item
        )
      );
      setReplyState((prev) => {
        const next: Record<number, ReplyState> = { ...prev };
        Object.entries(next).forEach(([key, value]) => {
          next[Number(key)] = {
            ...value,
            items: value.items.map((item) =>
              item.id === editingId ? { ...item, content: nextContent, modifyDate: now } : item
            ),
          };
        });
        return next;
      });
      cancelEdit();
      toast.success("수정되었습니다.");
    } catch (error) {
      console.error(error);
      toast.error("수정에 실패했습니다.");
    }
  }, [cancelEdit, editingContent, editingId]);

  const handleDelete = React.useCallback(
    async (id: number, parentCommentId?: number) => {
      try {
        await del(`/api/comments/${id}`, { withAuth: true });
        if (parentCommentId) {
          setReplyState((prev) => {
            const current = prev[parentCommentId];
            if (!current) return prev;
            return {
              ...prev,
              [parentCommentId]: {
                ...current,
                items: current.items.filter((item) => item.id !== id),
              },
            };
          });
          setComments((prev) =>
            prev.map((item) =>
              item.id === parentCommentId
                ? { ...item, replyCount: Math.max(0, item.replyCount - 1) }
                : item
            )
          );
        } else {
          setComments((prev) =>
            prev.map((item) => {
              if (item.id !== id) return item;
              if ((item.replyCount ?? 0) > 0) {
                return {
                  ...item,
                  content: "[삭제된 댓글입니다.]",
                  modifyDate: new Date().toISOString(),
                };
              }
              return null;
            }).filter((item): item is CommentInfoRes => item !== null)
          );
        }
        toast.success("삭제되었습니다.");
      } catch (error) {
        console.error(error);
        toast.error("삭제에 실패했습니다.");
      }
    },
    []
  );

  const handleSubmitReply = React.useCallback(
    async (parentId: number) => {
      if (!postId) return;
      const content = (replyInputs[parentId] ?? "").trim();
      if (!content) {
        toast.error("내용을 입력해주세요.");
        return;
      }
      try {
        await post(
          `/api/posts/${postId}/comments`,
          { content, parentCommentId: parentId },
          { withAuth: true }
        );
        setReplyInputs((prev) => ({ ...prev, [parentId]: "" }));
        setReplyOpen((prev) => ({ ...prev, [parentId]: true }));
        setComments((prev) =>
          prev.map((item) =>
            item.id === parentId ? { ...item, replyCount: item.replyCount + 1 } : item
          )
        );
        await loadReplies(parentId, true);
        toast.success("답글을 작성했습니다.");
      } catch (error) {
        console.error(error);
        toast.error("답글 작성에 실패했습니다.");
      }
    },
    [loadReplies, postId, replyInputs]
  );

  const startEditPost = React.useCallback(() => {
    if (!postId) return;
    router.push(`/write?mode=edit&postId=${postId}`);
  }, [postId, router]);

  const handleDeletePost = React.useCallback(async () => {
    if (!postId) return;
    const confirmed = window.confirm("게시글을 삭제할까요?");
    if (!confirmed) return;
    try {
      await del(`/api/posts/${postId}`, { withAuth: true });
      toast.success("게시글을 삭제했습니다.", { duration: 4000 });
      window.location.href = "/home";
    } catch (error) {
      console.error(error);
      toast.error("게시글 삭제에 실패했습니다.", { duration: 4000 });
    }
  }, [postId]);

  React.useEffect(() => {
    const authorId = getPostAuthorId(postData);
    const nickname = postData?.nickname;
    if (!nickname || authorId) {
      setAuthorLinkId(null);
      return;
    }
    let active = true;
    const run = async () => {
      try {
        const response = await get<{ id: number }>(`/api/members/nickname/${nickname}`, {
          withAuth: true,
        });
        if (!active) return;
        setAuthorLinkId(response.data?.id ?? null);
      } catch (error) {
        console.error("Failed to resolve author id", error);
      }
    };
    void run();
    return () => {
      active = false;
    };
  }, [postData]);

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-50 px-6 pb-10 pt-20 text-neutral-900">
        <div className="mx-auto w-full max-w-4xl text-sm text-neutral-500">
          불러오는 중...
        </div>
      </div>
    );
  }

  if (!postData) {
    return (
      <div className="min-h-screen bg-zinc-50 px-6 pb-10 pt-20 text-neutral-900">
        <div className="mx-auto w-full max-w-4xl text-sm text-rose-600">
          게시글을 찾을 수 없습니다.
        </div>
      </div>
    );
  }

  const dateValue = postData.modifyDate ?? postData.createDate;
  const dateText = getDateLabel(dateValue);
  const metaText = dateText
    ? `${dateText} · 조회 ${postData.viewCount ?? 0}`
    : `조회 ${postData.viewCount ?? 0}`;
  const hashtags = Array.isArray(postData.hashtags) ? postData.hashtags : [];
  const contentHtml = markdownToHtml(postData.content ?? "", {
    preserveEmptyLines: true,
    highlight: true,
  });
  const postAuthorId = getPostAuthorId(postData);
  const resolvedAuthorId = postAuthorId ?? authorLinkId;

  return (
    <div className="min-h-screen bg-zinc-50 px-6 pb-10 pt-20 text-neutral-900">
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-10">
        <section className="rounded-2xl border border-neutral-200 bg-white p-8 shadow-sm">
          <div className="flex items-start justify-between gap-4">
            <div className="text-3xl font-bold text-neutral-900">{postData.title}</div>
            {isOwner && (
              <div className="flex gap-4 text-sm font-semibold text-blue-600">
                <button
                  type="button"
                  onClick={startEditPost}
                  className="cursor-pointer transition hover:text-blue-800"
                >
                  수정
                </button>
                <button
                  type="button"
                  onClick={handleDeletePost}
                  className="cursor-pointer transition hover:text-blue-800"
                >
                  삭제
                </button>
              </div>
            )}
          </div>
          <div className="mt-3 flex items-center gap-3 rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2">
            {resolvedAuthorId ? (
              <Link
                href={`/members/${resolvedAuthorId}/posts`}
                className="flex items-center gap-3"
              >
                <img
                  src={getProfileUrlOrFallback(postData)}
                  alt=""
                  className="h-10 w-10 rounded-full object-cover"
                />
                <div className="flex flex-col">
                  <div className="text-sm font-semibold text-neutral-700">
                    {postData.nickname ?? "작성자"}
                  </div>
                  <div className="text-xs text-neutral-500">{metaText}</div>
                </div>
              </Link>
            ) : (
              <>
                <img
                  src={getProfileUrlOrFallback(postData)}
                  alt=""
                  className="h-10 w-10 rounded-full object-cover"
                />
                <div className="flex flex-col">
                  <div className="text-sm font-semibold text-neutral-700">
                    {postData.nickname ?? "작성자"}
                  </div>
                  <div className="text-xs text-neutral-500">{metaText}</div>
                </div>
              </>
            )}
          </div>
          <div className="mt-3 flex min-h-[28px] flex-wrap gap-2">
            {hashtags.length > 0 ? (
              hashtags.map((tag) => (
                <span
                  key={tag}
                  className="rounded-full bg-neutral-100 px-3 py-1 text-[11px] font-semibold text-neutral-700"
                >
                  #{tag}
                </span>
              ))
            ) : (
              <div className="h-6 w-full" />
            )}
          </div>
          <div className="mt-6">
            <div
              className="tiptap-preview"
              dangerouslySetInnerHTML={{ __html: contentHtml }}
            />
          </div>
        </section>

        <section className="rounded-2xl border border-neutral-200 bg-white p-8 shadow-sm">
          <div className="text-lg font-semibold text-neutral-900">댓글</div>

          {isLoggedIn && (
            <div className="mt-4 flex flex-col gap-3">
              <textarea
                value={commentInput}
                onChange={(event) => setCommentInput(event.target.value)}
                placeholder="댓글을 입력하세요"
                className="min-h-[96px] w-full resize-none rounded-xl border border-neutral-200 bg-white px-4 py-3 text-sm outline-none focus:border-neutral-400"
              />
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={handleSubmitComment}
                  className="rounded-full bg-neutral-900 px-5 py-2 text-sm font-semibold text-white"
                >
                  댓글 작성
                </button>
              </div>
            </div>
          )}

          <div className="mt-6 flex flex-col gap-6">
            {comments.map((comment) => {
              const commentDate = getDateLabel(comment.modifyDate ?? comment.createDate);
              const replies = replyState[comment.id];
              const showActions = myId !== null && myId === comment.authorId;
              const isEditingComment = editingId === comment.id;
              const replyInputValue = replyInputs[comment.id] ?? "";
              const isReplyOpen = replyOpen[comment.id] ?? false;
              const commentAuthorLabel = getDisplayName(comment);
              const shouldShowLoadReplies = replies ? replies.hasNext : comment.replyCount > 0;
              const displayedReplyCount =
                replies?.items.length ?? comment.previewReplies?.content?.length ?? 0;
              const remainingReplyCount = Math.max(0, comment.replyCount - displayedReplyCount);

              return (
                <div
                  key={comment.id}
                  className="rounded-xl border border-neutral-200 bg-white p-4"
                >
                  <div className="flex items-center justify-between gap-4">
                    <Link
                      href={`/members/${comment.authorId}/posts`}
                      className="flex items-center gap-3"
                    >
                      <img
                        src={getProfileUrlOrFallback(
                          comment,
                          comment.authorId === myId ? myProfileImage : null
                        )}
                        alt=""
                        className="h-8 w-8 rounded-full object-cover"
                      />
                      <div className="text-sm font-semibold text-neutral-900">
                        {commentAuthorLabel}
                      </div>
                    </Link>
                    <div className="flex flex-col items-end gap-1">
                      <div className="text-xs text-neutral-500">{commentDate}</div>
                      {showActions && !isEditingComment && (
                        <div className="flex gap-3 text-xs text-blue-600">
                          <button
                            type="button"
                            onClick={() => startEdit(comment.id, comment.content)}
                          >
                            수정
                          </button>
                          <button type="button" onClick={() => handleDelete(comment.id)}>
                            삭제
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  {isEditingComment ? (
                    <div className="mt-3 flex flex-col gap-2">
                      <textarea
                        value={editingContent}
                        onChange={(event) => setEditingContent(event.target.value)}
                        className="min-h-[84px] w-full resize-none rounded-xl border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-500"
                      />
                      <div className="flex justify-end gap-2 text-xs font-semibold">
                        <button
                          type="button"
                          onClick={cancelEdit}
                          className="rounded-full border border-neutral-300 px-3 py-1 text-neutral-700"
                        >
                          취소
                        </button>
                        <button
                          type="button"
                          onClick={handleUpdate}
                          className="rounded-full bg-neutral-900 px-3 py-1 text-white"
                        >
                          저장
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="mt-3 whitespace-pre-wrap break-words text-sm text-neutral-800">
                      {comment.content}
                    </div>
                  )}

                  {!isEditingComment && (
                    <div className="mt-3 flex gap-3 text-xs font-semibold text-neutral-600">
                      <button
                        type="button"
                        onClick={() =>
                          setReplyOpen((prev) => ({ ...prev, [comment.id]: !isReplyOpen }))
                        }
                        className="cursor-pointer transition hover:text-neutral-900"
                      >
                        답글 달기
                      </button>
                    </div>
                  )}

                  {isReplyOpen && !isEditingComment && (
                    <div className="mt-3 flex flex-col gap-2 rounded-xl border border-neutral-200 bg-neutral-50 p-3">
                      <textarea
                        value={replyInputValue}
                        onChange={(event) =>
                          setReplyInputs((prev) => ({
                            ...prev,
                            [comment.id]: event.target.value,
                          }))
                        }
                        placeholder="답글을 입력하세요"
                        className="min-h-[72px] w-full resize-none rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm outline-none focus:border-neutral-400"
                      />
                      <div className="flex justify-end">
                        <button
                          type="button"
                          onClick={() => handleSubmitReply(comment.id)}
                          className="rounded-full bg-neutral-900 px-4 py-1.5 text-xs font-semibold text-white"
                        >
                          답글 작성
                        </button>
                      </div>
                    </div>
                  )}

                  {replies?.items?.length ? (
                    <div className="mt-4 flex flex-col gap-3 border-l border-neutral-200 pl-4">
                      {replies.items.map((reply, index) => {
                        const replyDate = getDateLabel(reply.modifyDate ?? reply.createDate);
                        const showReplyActions = myId !== null && myId === reply.authorId;
                        const isEditingReply = editingId === reply.id;

                        return (
                          <div
                            key={reply.id}
                            className={`text-sm text-neutral-800 ${
                              index > 0 ? "border-t border-neutral-200 pt-3" : ""
                            }`}
                          >
                            <div className="flex items-center justify-between text-xs text-neutral-500">
                              <Link
                                href={`/members/${reply.authorId}/posts`}
                                className="flex items-center gap-2"
                              >
                                <img
                                  src={getProfileUrlOrFallback(
                                    reply,
                                    reply.authorId === myId ? myProfileImage : null
                                  )}
                                  alt=""
                                  className="h-6 w-6 rounded-full object-cover"
                                />
                                <span className="font-semibold text-neutral-700">
                                  {getDisplayName(reply)}
                                </span>
                              </Link>
                              <div className="flex flex-col items-end gap-1">
                                <span>{replyDate}</span>
                                {showReplyActions && !isEditingReply && (
                                  <div className="flex gap-3 text-[11px] text-blue-600">
                                    <button
                                      type="button"
                                      onClick={() => startEdit(reply.id, reply.content)}
                                    >
                                      수정
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleDelete(reply.id, reply.parentCommentId)}
                                    >
                                      삭제
                                    </button>
                                  </div>
                                )}
                              </div>
                            </div>

                            {isEditingReply ? (
                              <div className="mt-2 flex flex-col gap-2">
                                <textarea
                                  value={editingContent}
                                  onChange={(event) => setEditingContent(event.target.value)}
                                  className="min-h-[72px] w-full resize-none rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-500"
                                />
                                <div className="flex justify-end gap-2 text-[11px] font-semibold">
                                  <button
                                    type="button"
                                    onClick={cancelEdit}
                                    className="rounded-full border border-neutral-300 px-3 py-1 text-neutral-700"
                                  >
                                    취소
                                  </button>
                                  <button
                                    type="button"
                                    onClick={handleUpdate}
                                    className="rounded-full bg-neutral-900 px-3 py-1 text-white"
                                  >
                                    저장
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <div className="mt-1 whitespace-pre-wrap break-words">
                                {reply.content}
                              </div>
                            )}

                          </div>
                        );
                      })}

                      {shouldShowLoadReplies && (
                        <button
                          type="button"
                          onClick={() => loadReplies(comment.id)}
                          className="cursor-pointer text-xs font-semibold text-neutral-600 transition hover:text-neutral-900 disabled:cursor-not-allowed disabled:opacity-60"
                          disabled={replies?.loading}
                        >
                          {replies?.loading
                            ? "답글 불러오는 중..."
                            : `답글 더보기 (${remainingReplyCount})`}
                        </button>
                      )}
                    </div>
                  ) : shouldShowLoadReplies ? (
                    <div className="mt-3">
                      <button
                        type="button"
                        onClick={() => loadReplies(comment.id)}
                        className="cursor-pointer text-xs font-semibold text-neutral-600 transition hover:text-neutral-900 disabled:cursor-not-allowed disabled:opacity-60"
                        disabled={replies?.loading}
                      >
                        {replies?.loading
                          ? "답글 불러오는 중..."
                          : `답글 더보기 (${remainingReplyCount})`}
                      </button>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>

          {hasNextComments && (
            <div className="mt-6 flex justify-center">
              <button
                type="button"
                onClick={handleLoadMoreComments}
                disabled={commentLoading}
                className="rounded-full border border-neutral-300 px-5 py-2 text-sm font-semibold text-neutral-700"
              >
                {commentLoading ? "불러오는 중..." : "댓글 더보기"}
              </button>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
