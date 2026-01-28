"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { get } from "@/lib/apiClient";
import { getToken, getMyId } from "@/lib/auth";

const BG_COLORS = [
  "bg-red-200", "bg-orange-200", "bg-amber-200",
  "bg-yellow-200", "bg-lime-200", "bg-green-200",
  "bg-emerald-200", "bg-teal-200", "bg-cyan-200",
  "bg-sky-200", "bg-blue-200", "bg-indigo-200",
  "bg-violet-200", "bg-purple-200", "bg-fuchsia-200",
  "bg-pink-200", "bg-rose-200"
];

const getProfileColor = (nickname: string) => {
  if (!nickname) return "bg-gray-200";
  let hash = 0;
  for (let i = 0; i < nickname.length; i++) {
    hash = nickname.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % BG_COLORS.length;
  return BG_COLORS[index];
};

interface UserData {
  id: number;
  email: string;
  nickname: string;
  profileImageUrl: string | null;
  createDate: string;
}

export default function ProfilePage() {
  const params = useParams();
  const router = useRouter();
  const nickname = decodeURIComponent(params.nickname as string);
  
  const [user, setUser] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>("");

  useEffect(() => {
    if (!nickname) return;

    get(`api/members/nickname/${nickname}`, {
      headers: { Authorization: `Bearer ${getToken()}` }
    })
      .then((res) => {
        const userData = res.data as UserData;
        
        // ✅ 내 프로필인지 확인 후 리다이렉트
        const myId = getMyId();
        if (myId && userData.id === Number(myId)) {
          router.push("/mypage");  // ✅ useEffect 안에서 호출
          return;
        }
        
        setUser(userData);
      })
      .catch((err) => {
        console.error("프로필 조회 실패", err);
        setError("존재하지 않는 사용자입니다.");
      })
      .finally(() => {
        setLoading(false);
      });
  }, [nickname, router]);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <div className="text-xl font-medium text-gray-500">로딩 중...</div>
      </div>
    );
  }

  if (error || !user) {
    return (
      <div className="flex flex-col justify-center items-center h-screen gap-4">
        <div className="text-xl font-medium text-gray-500">
          {error || "사용자를 찾을 수 없습니다."}
        </div>
        <button
          onClick={() => router.back()}
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
        >
          뒤로 가기
        </button>
      </div>
    );
  }

  const initial = user.nickname.charAt(0).toUpperCase();
  const bgColor = getProfileColor(user.nickname);

  return (
    <div className="max-w-md mx-auto mt-20 p-6 bg-white rounded-xl shadow-md border border-gray-100">
      <div className="flex flex-col items-center gap-6">
        {/* 프로필 이미지 */}
        <div className="w-32 h-32">
          {user.profileImageUrl ? (
            <img
              src={user.profileImageUrl}
              alt={`${user.nickname}의 프로필`}
              className="w-full h-full rounded-full object-cover border-2 border-gray-100 shadow-sm"
            />
          ) : (
            <div className={`w-full h-full rounded-full ${bgColor} flex items-center justify-center border-2 border-gray-100 shadow-sm`}>
              <span className="text-6xl font-bold text-white/90">{initial}</span>
            </div>
          )}
        </div>

        {/* 닉네임 & 정보 */}
        <div className="text-center w-full space-y-4">
          <div className="flex flex-col items-center justify-center">
            <h2 className="text-2xl font-bold text-gray-800 mb-1">{user.nickname}</h2>
            <p className="text-xs text-gray-500">
              가입일: {formatDate(user.createDate)}
            </p>
          </div>
        </div>

        {/* 뒤로 가기 버튼 */}
        <button
          onClick={() => router.back()}
          className="mt-4 px-6 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition"
        >
          뒤로 가기
        </button>
      </div>
    </div>
  );
}

const formatDate = (dateString: string) => {
  if (!dateString) return "";
  return new Date(dateString).toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
};