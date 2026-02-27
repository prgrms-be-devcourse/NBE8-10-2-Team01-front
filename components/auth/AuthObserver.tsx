"use client";

import * as React from "react";
import {captureTokenFromCookie} from "@/lib/auth";
import {get} from "@/lib/apiClient";
import {toast} from "react-hot-toast";
import {useRouter} from "next/navigation";

export default function AuthObserver() {
  const router = useRouter();

  React.useEffect(() => {
    const syncSocialAuth = async () => {

      const token = captureTokenFromCookie();

      if (token) {
        try {
          const response = await get<{id: number; nickname: string}>("/api/members/me", {
            withAuth: true,
          });

          localStorage.setItem("id", String(response.data.id));
          localStorage.setItem("nickname", response.data.nickname);

          window.dispatchEvent(new CustomEvent("auth-change"));

          toast.success(`로그인이 완료되었습니다.`);

          const redirectPath = window.sessionStorage.getItem("socialRedirectPath") || "/home";
          window.sessionStorage.removeItem("socialRedirectPath");
          router.push(redirectPath);
        } catch (error) {
          console.error("소셜 로그인 유저 정보 동기화 실패", error);
          toast.error("로그인 정보를 불러오는 중 오류가 발생했습니다.");
        }
      }
    };

    syncSocialAuth();
  }, [router]);

  return null;
}
