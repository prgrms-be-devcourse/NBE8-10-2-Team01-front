"use client";

import {API_BASE_URL} from "@/lib/apiConfig";

export default function SocialLoginGroup() {
  const handleSocialLogin = (provider: "google" | "kakao" | "naver") => {
    const currentPath = window.location.pathname;
    if (!currentPath.includes("sign")) {
      window.sessionStorage.setItem("socialRedirectPath", currentPath);
    }

    window.location.href = `${API_BASE_URL}/oauth2/authorization/${provider}`;
  };

  return (
    <div className="flex flex-col gap-4 mt-8 w-full">
      <div className="flex items-center gap-2 text-neutral-400 text-xs">
        <div className="h-[1px] bg-neutral-200 flex-1" />
        <span>SNS 계정으로 시작하기</span>
        <div className="h-[1px] bg-neutral-200 flex-1" />
      </div>

      <div className="flex justify-center gap-5">
        {/* 카카오: 기존 w-6 -> w-[22px]로 미세 조정 */}
        <button
          onClick={() => handleSocialLogin("kakao")}
          className="w-12 h-12 rounded-full bg-[#FEE500] flex items-center justify-center hover:opacity-90 transition shadow-sm"
          aria-label="카카오 로그인"
        >
          <svg className="w-[22px] h-[22px]" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path
              fillRule="evenodd"
              clipRule="evenodd"
              d="M12 3C6.477 3 2 6.483 2 10.785c0 2.758 1.83 5.176 4.568 6.51l-1.157 4.24c-.056.208.188.384.364.267l4.985-3.298c.404.047.818.072 1.24.072 5.523 0 10-3.483 10-7.785S17.523 3 12 3z"
              fill="#3C1E1E"
            />
          </svg>
        </button>

        {/* 네이버: 기존 w-5(20px) -> w-[18px]로 축소하여 균형 맞춤 */}
        <button
          onClick={() => handleSocialLogin("naver")}
          className="w-12 h-12 rounded-full bg-[#03C75A] flex items-center justify-center hover:opacity-90 transition shadow-sm"
          aria-label="네이버 로그인"
        >
          <svg className="w-[16px] h-[16px]" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M16.273 12.845L7.376 0H0V24h7.726V11.155L16.624 24H24V0h-7.727v12.845z" fill="white" />
          </svg>
        </button>

        {/* 구글: w-5(20px) 유지 (기준점) */}
        <button
          onClick={() => handleSocialLogin("google")}
          className="w-12 h-12 rounded-full bg-white border border-neutral-200 flex items-center justify-center hover:bg-neutral-50 transition shadow-sm"
          aria-label="구글 로그인"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24">
            <path
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              fill="#4285F4"
            />
            <path
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              fill="#34A853"
            />
            <path
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"
              fill="#FBBC05"
            />
            <path
              d="M12 5.38c1.62 0 3.06.56 4.21 1.66l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              fill="#EA4335"
            />
          </svg>
        </button>
      </div>
    </div>
  );
}
