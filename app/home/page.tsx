"use client";

import * as React from "react";
import Link from "next/link";
import { get } from "@/lib/apiClient";
import { OutputBlock } from "@/components/ui/display/OutputBlock";
import { formatDateTime } from "@/lib/date";

type PostInfoRes = {
  id: number;
  title: string;
  content: string;
  summary: string;
  viewCount: number;
  createDate: string | null;
  modifyDate: string | null;
  thumbnail?: string | null;
  nickname?: string | null;
  profileImage?: string | null;
  hashtags?: string[] | null;
};

export default function HomePage() {
  const [posts, setPosts] = React.useState<PostInfoRes[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [searchOpen, setSearchOpen] = React.useState(false);
  const [searchType, setSearchType] = React.useState<"title" | "hashTag">("title");
  const [searchKeyword, setSearchKeyword] = React.useState("");
  const [hasSearched, setHasSearched] = React.useState(false);

  const fetchRecentPosts = React.useCallback(async () => {
    setLoading(true);
    try {
      const response = await get("/api/posts", { withAuth: true });
      const data = response.data as unknown;
      const items = Array.isArray(data)
        ? (data as PostInfoRes[])
        : Array.isArray((data as { content?: PostInfoRes[] })?.content)
          ? ((data as { content: PostInfoRes[] }).content ?? [])
          : [];
      setPosts(items);
      setError(null);
    } catch {
      setError("목록을 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }, []);

  const handleSearch = React.useCallback(async () => {
    const keyword = searchKeyword.trim();
    if (!keyword) {
      setHasSearched(false);
      fetchRecentPosts();
      return;
    }

    setLoading(true);
    try {
      const response = await get("/api/posts/search", {
        query: {
          [searchType]: keyword,
        },
      });
      const data = response.data as unknown;
      const items = Array.isArray((data as { content?: PostInfoRes[] })?.content)
        ? ((data as { content: PostInfoRes[] }).content ?? [])
        : [];
      setPosts(items);
      setHasSearched(true);
      setError(null);
    } catch {
      setError("검색 결과를 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }, [fetchRecentPosts, searchKeyword, searchType]);

  React.useEffect(() => {
    fetchRecentPosts();
  }, [fetchRecentPosts]);

  const handleToggleSearch = () => {
    setSearchOpen((prev) => {
      if (prev) {
        setSearchKeyword("");
        setHasSearched(false);
        fetchRecentPosts();
      }
      return !prev;
    });
  };

  return (
    <div className="min-h-screen bg-zinc-50 px-6 pb-10 pt-24 text-neutral-900">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
        <header className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">게시글</h1>
            <p className="text-sm text-neutral-500">최근 게시글을 확인하세요.</p>
          </div>
          <div className="flex items-center gap-2">
            <div
              className={`flex items-center gap-2 overflow-hidden rounded-xl border border-neutral-200 bg-white px-2 py-1 shadow-sm transition-all duration-300 ${
                searchOpen ? "w-[min(68vw,480px)] opacity-100" : "w-0 border-transparent p-0 opacity-0"
              }`}
            >
              <select
                value={searchType}
                onChange={(e) => setSearchType(e.target.value as "title" | "hashTag")}
                className="h-9 rounded-lg border border-neutral-200 px-2 text-sm text-neutral-700 outline-none focus:border-neutral-400"
              >
                <option value="title">제목</option>
                <option value="hashTag">해시태그</option>
              </select>
              <input
                type="text"
                value={searchKeyword}
                onChange={(e) => setSearchKeyword(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    handleSearch();
                  }
                }}
                placeholder={searchType === "title" ? "제목 검색" : "해시태그 검색"}
                className="h-9 flex-1 rounded-lg border border-neutral-200 px-3 text-sm outline-none focus:border-neutral-400"
              />
              <button
                type="button"
                onClick={handleSearch}
                className="h-9 rounded-lg bg-neutral-900 px-3 text-sm font-medium text-white hover:bg-neutral-700"
              >
                검색
              </button>
            </div>
            <button
              type="button"
              onClick={handleToggleSearch}
              className="flex h-10 w-10 items-center justify-center rounded-full border border-neutral-200 bg-white text-neutral-700 shadow-sm hover:border-neutral-300 hover:text-neutral-900"
              aria-label={searchOpen ? "검색 닫기" : "검색 열기"}
            >
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <circle cx="11" cy="11" r="7" strokeWidth="2" />
                <path d="m20 20-3.5-3.5" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </button>
          </div>
        </header>

        {loading && <div className="text-sm text-neutral-500">불러오는 중...</div>}
        {error && <div className="text-sm text-rose-600">{error}</div>}

        {!loading && !error && hasSearched && (
          <div className="overflow-hidden rounded-2xl border border-neutral-200 bg-white">
            <div className="grid grid-cols-[1fr_90px_140px] gap-2 border-b border-neutral-200 bg-neutral-50 px-4 py-3 text-xs font-semibold text-neutral-600">
              <div>제목</div>
              <div className="text-center">조회</div>
              <div className="text-right">작성/수정일</div>
            </div>
            <div className="divide-y divide-neutral-100">
              {posts.length === 0 ? (
                <div className="px-4 py-10 text-center text-sm text-neutral-500">
                  검색 결과가 없습니다.
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

        {!loading && !error && !hasSearched && (
          <div className="grid gap-6 [grid-template-columns:repeat(auto-fit,minmax(320px,1fr))]">
            {posts.map((post) => {
              const dateValue = post.modifyDate ?? post.createDate;
              const dateText = dateValue
                ? formatDateTime(dateValue, "ko-KR")
                : "";
              const meta = dateText
                ? `${dateText} · 조회 ${post.viewCount ?? 0}`
                : `조회 ${post.viewCount ?? 0}`;
              return (
                <Link key={post.id} href={`/posts/${post.id}`} className="block">
                  <OutputBlock
                    title={post.title}
                    summary={post.summary}
                    meta={meta}
                    imageUrl={post.thumbnail ?? undefined}
                    authorName={post.nickname ?? undefined}
                    authorImageUrl={post.profileImage ?? undefined}
                    hashtags={post.hashtags ?? undefined}
                  />
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
