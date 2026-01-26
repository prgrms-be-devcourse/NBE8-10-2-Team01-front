"use client";

import * as React from "react";
import Link from "next/link";
import { isAuthed, removeToken } from "@/lib/auth";
import { useRouter } from "next/navigation";
import { get } from "@/lib/apiClient";

export default function GNB() {
  const [loggedIn, setLoggedIn] = React.useState<boolean | null>(null);
  const router = useRouter();

  React.useEffect(() => {
    const handleAuthChange = () => {
      setLoggedIn(isAuthed());
    };

    handleAuthChange(); // 초기 인증 상태 확인
    window.addEventListener("auth-change", handleAuthChange);

    return () => {
      window.removeEventListener("auth-change", handleAuthChange);
    };
  }, []);

  const handleLogout = async () => {
    try {
      await get("/api/members/logout", { withAuth: true });
    } catch (error) {
      console.error("Logout failed", error);
    } finally {
      removeToken();
      router.push("/");
    }
  };

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-sm shadow-sm">
      <nav className="container mx-auto flex h-16 max-w-5xl items-center justify-between px-6">
        <div className="flex items-center gap-8">
          <Link href="/" className="text-xl font-bold text-neutral-900">
            PLog
          </Link>
        </div>
        <div className="flex items-center gap-6 text-sm font-medium">
          {loggedIn === null ? null : loggedIn ? (
            <>
              <Link
                href="/write"
                className="text-neutral-600 hover:text-neutral-900"
              >
                글 쓰기
              </Link>
              <Link
                href="/mypage"
                className="text-neutral-600 hover:text-neutral-900"
              >
                마이페이지
              </Link>
              <button
                onClick={handleLogout}
                className="rounded-md bg-neutral-200 px-3 py-1.5 text-neutral-700 hover:bg-neutral-300"
              >
                로그아웃
              </button>
            </>
          ) : (
            <Link
              href="/signin"
              className="rounded-md bg-amber-500 px-3 py-1.5 text-white hover:bg-amber-600"
            >
              로그인
            </Link>
          )}
        </div>
      </nav>
    </header>
  );
}
