"use client";

import * as React from "react";
import { useParams } from "next/navigation";
import { get, post } from "@/lib/apiClient";
import { formatDateTime } from "@/lib/date";
import { markdownToHtml } from "@/lib/markdown";

type CommentInfoRes = {
  id: number;
  content: string;
  authorId: number;
  authorNickname: string;
  postId: number;
  createDate: string | null;
  modifyDate: string | null;
  replyCount: number;
};

type CommentSlice = {
  content: CommentInfoRes[];
  number?: number;
  size?: number;
  first?: boolean;
  last?: boolean;
  empty?: boolean;
};

type PostInfoRes = {
  id: number;
  title: string;
  content: string;
  summary: string;
  viewCount: number;
  createDate: string | null;
  modifyDate: string | null;
  comments?: CommentSlice | null;
};

type ReplyState = {
  items: CommentInfoRes[];
  page: number;
  hasNext: boolean;
  loading: boolean;
};

function getDateLabel(dateValue: string | null | undefined) {
  if (!dateValue) return "";
  return formatDateTime(dateValue, "ko-KR");
}

export default function PostDetailPage() {
  const params = useParams<{ postId: string }>();
  const postId = params?.postId;

  const [postData, setPostData] = React.useState<PostInfoRes | null>(null);
  const [comments, setComments] = React.useState<CommentInfoRes[]>([]);
  const [commentPage, setCommentPage] = React.useState(0);
  const [hasNextComments, setHasNextComments] = React.useState(false);
  const [loading, setLoading] = React.useState(true);
  const [commentLoading, setCommentLoading] = React.useState(false);
  const [commentInput, setCommentInput] = React.useState("");
  const [replyState, setReplyState] = React.useState<Record<number, ReplyState>>(
    {}
  );

  const loadPost = React.useCallback(async () => {
    if (!postId) return;
    const response = await get(`/api/posts/${postId}`, { withAuth: true });
    const data = response.data as PostInfoRes;
    setPostData(data);
  }, [postId]);

  const loadComments = React.useCallback(
    async (page: number, append: boolean) => {
      if (!postId) return;
      const response = await get(`/api/posts/${postId}/comments`, {
        withAuth: true,
        query: { page },
      });
      const data = response.data as CommentSlice;
      const list = data?.content ?? [];
      const isLast = data?.last ?? list.length === 0;
      setHasNextComments(!isLast);
      setCommentPage(page);
      setComments((prev) => (append ? [...prev, ...list] : list));
    },
    [postId]
  );

  React.useEffect(() => {
    if (!postId) return;
    let active = true;
    const run = async () => {
      try {
        await loadPost();
        await loadComments(0, false);
      } finally {
        if (active) setLoading(false);
      }
    };
    run();
    return () => {
      active = false;
    };
  }, [loadComments, loadPost, postId]);

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
      await loadComments(0, false);
    } catch (error) {
      window.alert("댓글 작성에 실패했습니다. 잠시 후 다시 시도해주세요.");
    }
  };

  const loadReplies = async (parentId: number) => {
    if (!postId) return;
    setReplyState((prev) => ({
      ...prev,
      [parentId]: {
        items: prev[parentId]?.items ?? [],
        page: prev[parentId]?.page ?? 0,
        hasNext: prev[parentId]?.hasNext ?? true,
        loading: true,
      },
    }));

    try {
      const current = replyState[parentId];
      const nextPage = current ? current.page + 1 : 0;
      const response = await get(`/api/posts/${postId}/comments`, {
        withAuth: true,
        query: { parentCommentId: parentId, page: nextPage },
      });
      const data = response.data as CommentSlice;
      const list = data?.content ?? [];
      const isLast = data?.last ?? list.length === 0;
      setReplyState((prev) => ({
        ...prev,
        [parentId]: {
          items: [...(prev[parentId]?.items ?? []), ...list],
          page: nextPage,
          hasNext: !isLast,
          loading: false,
        },
      }));
    } catch (error) {
      setReplyState((prev) => ({
        ...prev,
        [parentId]: {
          items: prev[parentId]?.items ?? [],
          page: prev[parentId]?.page ?? 0,
          hasNext: false,
          loading: false,
        },
      }));
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-50 px-6 py-10 text-neutral-900">
        <div className="mx-auto w-full max-w-4xl text-sm text-neutral-500">
          불러오는 중...
        </div>
      </div>
    );
  }

  if (!postData) {
    return (
      <div className="min-h-screen bg-zinc-50 px-6 py-10 text-neutral-900">
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
  const contentHtml = markdownToHtml(postData.content ?? "", {
    preserveEmptyLines: true,
    highlight: true,
  });
  const myId: number | null = null;

  return (
    <div className="min-h-screen bg-zinc-50 px-6 py-10 text-neutral-900">
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-10">
        <section className="rounded-2xl border border-neutral-200 bg-white p-8 shadow-sm">
          <div className="text-3xl font-bold text-neutral-900">
            {postData.title}
          </div>
          <div className="mt-2 text-sm text-neutral-500">{metaText}</div>
          <div className="mt-6">
            <div
              className="tiptap-preview"
              dangerouslySetInnerHTML={{ __html: contentHtml }}
            />
          </div>
          <div className="mt-8 flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-neutral-200" />
            <div className="h-4 w-24 rounded-full bg-neutral-200" />
          </div>
        </section>

        <section className="rounded-2xl border border-neutral-200 bg-white p-8 shadow-sm">
          <div className="text-lg font-semibold text-neutral-900">댓글</div>

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

          <div className="mt-6 flex flex-col gap-6">
            {comments.map((comment) => {
              const commentDate = getDateLabel(
                comment.modifyDate ?? comment.createDate
              );
              const replies = replyState[comment.id];
              const showActions = myId !== null && myId === comment.authorId;
              return (
                <div
                  key={comment.id}
                  className="rounded-xl border border-neutral-200 bg-white p-4"
                >
                  <div className="flex items-center justify-between gap-4">
                    <div className="text-sm font-semibold text-neutral-900">
                      {comment.authorNickname ?? "작성자"}
                    </div>
                    <div className="text-xs text-neutral-500">{commentDate}</div>
                  </div>
                  <div className="mt-3 whitespace-pre-line text-sm text-neutral-800">
                    {comment.content}
                  </div>
                  {showActions && (
                    <div className="mt-2 flex gap-3 text-xs text-blue-600">
                      <button type="button">수정</button>
                      <button type="button">삭제</button>
                    </div>
                  )}

                  {comment.replyCount > 0 && (
                    <div className="mt-3">
                      <button
                        type="button"
                        onClick={() => loadReplies(comment.id)}
                        className="text-xs font-semibold text-neutral-600"
                        disabled={replies?.loading}
                      >
                        {replies?.loading
                          ? "답글 불러오는 중..."
                          : `답글 더보기 (${comment.replyCount})`}
                      </button>
                    </div>
                  )}

                  {replies?.items?.length ? (
                    <div className="mt-4 flex flex-col gap-3 border-l border-neutral-200 pl-4">
                      {replies.items.map((reply) => {
                        const replyDate = getDateLabel(
                          reply.modifyDate ?? reply.createDate
                        );
                        const showReplyActions =
                          myId !== null && myId === reply.authorId;
                        return (
                          <div key={reply.id} className="text-sm text-neutral-800">
                            <div className="flex items-center justify-between text-xs text-neutral-500">
                              <span className="font-semibold text-neutral-700">
                                {reply.authorNickname ?? "작성자"}
                              </span>
                              <span>{replyDate}</span>
                            </div>
                            <div className="mt-1 whitespace-pre-line">
                              {reply.content}
                            </div>
                            {showReplyActions && (
                              <div className="mt-1 flex gap-3 text-[11px] text-blue-600">
                                <button type="button">수정</button>
                                <button type="button">삭제</button>
                              </div>
                            )}
                          </div>
                        );
                      })}
                      {replies.hasNext && (
                        <button
                          type="button"
                          onClick={() => loadReplies(comment.id)}
                          className="text-xs font-semibold text-neutral-600"
                          disabled={replies.loading}
                        >
                          {replies.loading ? "불러오는 중..." : "답글 더보기"}
                        </button>
                      )}
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
