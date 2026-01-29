"use client";

import * as React from "react";
import Link from "next/link";
import { getMyId, isAuthed, removeToken } from "@/lib/auth";
import { usePathname, useRouter } from "next/navigation";
import { get } from "@/lib/apiClient";

type MemberInfo = {
  id: number;
  email: string;
  nickname: string;
  profileImageUrl: string | null;
  createDate: string;
};

const fallbackAvatar =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80" viewBox="0 0 80 80"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#e2e8f0"/><stop offset="100%" stop-color="#cbd5f5"/></linearGradient></defs><rect width="80" height="80" rx="40" fill="url(#g)"/><circle cx="40" cy="32" r="13" fill="#ffffff"/><path d="M16 68c3.5-13 16-20 24-20s20.5 7 24 20" fill="#ffffff"/></svg>'
  );

export default function GNB() {
  const [loggedIn, setLoggedIn] = React.useState<boolean | null>(null);
  const [member, setMember] = React.useState<MemberInfo | null>(null);
  const [menuOpen, setMenuOpen] = React.useState(false);
  const menuRef = React.useRef<HTMLDivElement | null>(null);
  const router = useRouter();
  const pathname = usePathname();

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

  React.useEffect(() => {
    if (!loggedIn) {
      setMember(null);
      return;
    }
    const myId = getMyId();
    if (!myId) return;
    let active = true;
    const fetchMember = async () => {
      try {
        const response = await get<MemberInfo>(`/api/members/id/${myId}`, {
          withAuth: true,
        });
        if (!active) return;
        setMember(response.data);
      } catch (error) {
        console.error("Failed to load member info", error);
      }
    };
    fetchMember();
    return () => {
      active = false;
    };
  }, [loggedIn, pathname]);

  React.useEffect(() => {
    if (!menuOpen) return;
    const handleClickOutside = (event: MouseEvent) => {
      if (!menuRef.current) return;
      if (!menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    };
    window.addEventListener("mousedown", handleClickOutside);
    return () => {
      window.removeEventListener("mousedown", handleClickOutside);
    };
  }, [menuOpen]);

  const handleLogout = async () => {
    try {
      await get("/api/members/logout", { withAuth: true });
    } catch (error) {
      console.error("Logout failed", error);
    } finally {
      removeToken();
      setMenuOpen(false);
      router.push("/");
    }
  };

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-sm shadow-sm">
      <nav className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
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
              <div className="relative" ref={menuRef}>
                <button
                  type="button"
                  onClick={() => setMenuOpen((prev) => !prev)}
                  className="flex items-center gap-2 rounded-full border border-neutral-200 bg-white px-2 py-1 shadow-sm hover:border-neutral-300"
                >
                  <img
                    src={member?.profileImageUrl ?? fallbackAvatar}
                    alt=""
                    className="h-8 w-8 rounded-full object-cover"
                  />
                  <svg
                    className={`h-4 w-4 text-neutral-500 transition ${menuOpen ? "rotate-180" : ""}`}
                    viewBox="0 0 20 20"
                    fill="currentColor"
                    aria-hidden="true"
                  >
                    <path
                      fillRule="evenodd"
                      d="M5.23 7.21a.75.75 0 0 1 1.06.02L10 11.293l3.71-4.06a.75.75 0 1 1 1.1 1.02l-4.25 4.65a.75.75 0 0 1-1.1 0L5.21 8.27a.75.75 0 0 1 .02-1.06Z"
                      clipRule="evenodd"
                    />
                  </svg>
                </button>
                {menuOpen && (
                  <div className="absolute right-0 mt-2 w-48 overflow-hidden rounded-xl border border-neutral-200 bg-white text-sm shadow-lg">
                    <Link
                      href="/mypage"
                      className="block px-4 py-3 text-neutral-700 hover:bg-neutral-50"
                      onClick={() => setMenuOpen(false)}
                    >
                      마이페이지
                    </Link>
                    <Link
                      href="/myposts"
                      className="block px-4 py-3 text-neutral-700 hover:bg-neutral-50"
                      onClick={() => setMenuOpen(false)}
                    >
                      작성한 글 목록
                    </Link>
                    <button
                      onClick={handleLogout}
                      className="block w-full px-4 py-3 text-left text-neutral-700 hover:bg-neutral-50"
                    >
                      로그아웃
                    </button>
                  </div>
                )}
              </div>
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
