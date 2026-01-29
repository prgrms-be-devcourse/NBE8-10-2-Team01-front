"use client";

import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { get } from "@/lib/apiClient";
import { formatDateTime } from "@/lib/date";
import { isAuthed } from "@/lib/auth";

type PostInfoRes = {
  id: number;
  title: string;
  content: string;
  viewCount: number;
  createDate: string | null;
  modifyDate: string | null;
  hashtags?: string[] | null;
};

type Slice<T> = {
  content: T[];
  number?: number;
  size?: number;
  totalElements?: number;
  totalPages?: number;
  first?: boolean;
  last?: boolean;
  empty?: boolean;
};

const PAGE_SIZE = 10;

export default function MemberPostsPage() {
  const params = useParams<{ memberId: string }>();
  const memberId = params?.memberId ? Number(params.memberId) : null;
  const [loggedIn, setLoggedIn] = React.useState<boolean | null>(null);
  const [posts, setPosts] = React.useState<PostInfoRes[]>([]);
  const [page, setPage] = React.useState(0);
  const [totalPages, setTotalPages] = React.useState(1);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    const handleAuthChange = () => {
      setLoggedIn(isAuthed());
    };
    handleAuthChange();
    window.addEventListener("auth-change", handleAuthChange);
    return () => {
      window.removeEventListener("auth-change", handleAuthChange);
    };
  }, []);

  React.useEffect(() => {
    if (loggedIn === false) return;
    if (loggedIn === null) return;
    if (!memberId) return;

    let active = true;
    const fetchPosts = async () => {
      setLoading(true);
      try {
        const response = await get(`/api/posts/members/${memberId}`, {
          withAuth: true,
          query: { pageNumber: page, pageSize: PAGE_SIZE },
        });
        const payload = (response.data as { data?: Slice<PostInfoRes> })?.data;
        const slice = payload ?? (response.data as Slice<PostInfoRes>);
        const items = Array.isArray(slice?.content) ? slice.content : [];

        const currentPage = typeof slice?.number === "number" ? slice.number : page;
        let computedPages = 1;
        if (typeof slice?.totalPages === "number") {
          computedPages = Math.max(1, slice.totalPages);
        } else if (typeof slice?.totalElements === "number" && typeof slice?.size === "number") {
          computedPages = Math.max(1, Math.ceil(slice.totalElements / slice.size));
        } else if (typeof slice?.last === "boolean") {
          computedPages = slice.last ? currentPage + 1 : currentPage + 2;
        }

        if (!active) return;
        setPosts(items);
        setTotalPages(computedPages);
        setError(null);
      } catch (err) {
        if (!active) return;
        setError("작성한 글 목록을 불러오지 못했습니다.");
      } finally {
        if (!active) return;
        setLoading(false);
      }
    };
    fetchPosts();
    return () => {
      active = false;
    };
  }, [loggedIn, memberId, page]);

  if (loggedIn === false) {
    return (
      <div className="min-h-screen bg-zinc-50 px-6 pb-10 pt-24 text-neutral-900">
        <div className="mx-auto w-full max-w-5xl">
          <div className="rounded-2xl border border-neutral-200 bg-white p-8 text-sm text-neutral-600">
            로그인 후 작성한 글 목록을 확인할 수 있습니다.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-50 px-6 pb-10 pt-24 text-neutral-900">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
        <header>
          <h1 className="text-2xl font-bold">작성한 글 목록</h1>
          <p className="text-sm text-neutral-500">작성자의 게시글을 확인하세요.</p>
        </header>

        {loading && <div className="text-sm text-neutral-500">불러오는 중...</div>}
        {error && <div className="text-sm text-rose-600">{error}</div>}

        {!loading && !error && (
          <div className="overflow-hidden rounded-2xl border border-neutral-200 bg-white">
            <div className="grid grid-cols-[1fr_90px_140px] gap-2 border-b border-neutral-200 bg-neutral-50 px-4 py-3 text-xs font-semibold text-neutral-600">
              <div>제목</div>
              <div className="text-center">조회</div>
              <div className="text-right">작성/수정일</div>
            </div>
            <div className="divide-y divide-neutral-100">
              {posts.length === 0 ? (
                <div className="px-4 py-10 text-center text-sm text-neutral-500">
                  작성한 글이 없습니다.
                </div>
              ) : (
                posts.map((post) => {
                  const dateValue = post.modifyDate ?? post.createDate;
                  const dateText = dateValue ? formatDateTime(dateValue, "ko-KR") : "-";
                  return (
                    <div
                      key={post.id}
                      className="grid grid-cols-[1fr_90px_140px] gap-2 px-4 py-4 text-sm"
                    >
                      <Link
                        href={`/posts/${post.id}`}
                        className="truncate font-semibold text-neutral-800 hover:text-neutral-900"
                      >
                        {post.title}
                      </Link>
                      <div className="text-center text-neutral-600">{post.viewCount ?? 0}</div>
                      <div className="text-right text-neutral-500">{dateText}</div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {!loading && !error && totalPages > 1 && (
          <div className="flex flex-wrap justify-center gap-2">
            {Array.from({ length: totalPages }, (_, index) => (
              <button
                key={index}
                type="button"
                onClick={() => setPage(index)}
                className={`min-w-[36px] rounded-full border px-3 py-1 text-sm ${
                  page === index
                    ? "border-neutral-900 bg-neutral-900 text-white"
                    : "border-neutral-200 bg-white text-neutral-700 hover:border-neutral-400"
                }`}
              >
                {index + 1}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
