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

  React.useEffect(() => {
    let active = true;
    const fetchPosts = async () => {
      try {
        const response = await get("/api/posts", { withAuth: true });
        const data = response.data as unknown;
        const items = Array.isArray(data)
          ? (data as PostInfoRes[])
          : Array.isArray((data as { content?: PostInfoRes[] })?.content)
            ? ((data as { content: PostInfoRes[] }).content ?? [])
            : [];
        if (!active) return;
        setPosts(items);
        setError(null);
      } catch (err) {
        if (!active) return;
        setError("목록을 불러오지 못했습니다.");
      } finally {
        if (!active) return;
        setLoading(false);
      }
    };
    fetchPosts();
    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="min-h-screen bg-zinc-50 px-6 pb-10 pt-24 text-neutral-900">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
        <header className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">게시글</h1>
            <p className="text-sm text-neutral-500">최근 게시글을 확인하세요.</p>
          </div>
        </header>

        {loading && <div className="text-sm text-neutral-500">불러오는 중...</div>}
        {error && <div className="text-sm text-rose-600">{error}</div>}

        {!loading && !error && (
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
