"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { get } from "@/lib/apiClient";
import { isAuthed, getMyId, getToken } from "@/lib/auth";

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

export default function MyPage() {
  const router = useRouter();
  const [isEditing, setIsEditing] = useState(false);
  const [newNickname, setNewNickname] = useState("");
  const [user, setUser] = useState<UserData | null>(null);
  const [preview, setPreview] = useState<string>("");
  const [isUploading, setIsUploading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    if (!isAuthed()) {
      alert("로그인이 필요합니다.");
      router.push("/signin");
      return;
    }

    const myId = getMyId();
    if (!myId) {
      alert("로그인 정보가 유효하지 않습니다.");
      router.push("/signin");
      return;
    }

    get(`api/members/id/${myId}`, {
      headers: { Authorization: `Bearer ${getToken()}` }
    })
      .then((res) => {
        const userData = res.data as UserData;
        setUser(userData);
        setPreview(userData.profileImageUrl || "");
      })
      .catch((err) => {
        console.error("내 정보 로드 실패", err);
        alert("정보를 불러오지 못했습니다.");
      });
  }, [router]);

  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    if (file.size > 20 * 1024 * 1024) {
      alert("파일 크기는 20MB를 초과할 수 없습니다.");
      return;
    }

    const validExtensions = ["jpg", "jpeg", "png", "gif"];
    const ext = file.name.split(".").pop()?.toLowerCase();
    if (!ext || !validExtensions.includes(ext)) {
      alert("jpg, jpeg, png, gif 파일만 업로드 가능합니다.");
      return;
    }

    const oldPreview = preview;
    const objectUrl = URL.createObjectURL(file);
    setPreview(objectUrl);
    setIsUploading(true);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const token = getToken();

      // ✅ 수정: 백엔드 경로에 맞춤
      const res = await fetch(`http://localhost:8080/api/members/${user.id}/profile-image`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.message || "업로드 실패");
      }

      const data = await res.json();
      
      setUser(prev => {
        if (!prev) return null;
        return { 
          ...prev, 
          profileImageUrl: data.data?.profileImageUrl || objectUrl 
        };
      });

      alert("프로필 이미지가 변경되었습니다.");

    } catch (err: any) {
      console.error("이미지 업로드 실패:", err);
      alert(err.message || "이미지 변경에 실패했습니다.");
      
      setPreview(oldPreview);
      URL.revokeObjectURL(objectUrl);
    } finally {
      setIsUploading(false);
    }
  };
  const handleImageDelete = async () => {
    if (!user?.profileImageUrl) return;
  
    // 삭제 확인
    if (!confirm("프로필 이미지를 삭제하시겠습니까?")) {
      return;
    }
  
    setIsDeleting(true);
  
    try {
      const token = getToken();
  
      const res = await fetch(`http://localhost:8080/api/members/${user.id}/profile-image`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
  
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.message || "삭제 실패");
      }
  
      // 성공 시 상태 업데이트
      setUser(prev => {
        if (!prev) return null;
        return { ...prev, profileImageUrl: null };
      });
      setPreview("");
  
      alert("프로필 이미지가 삭제되었습니다.");
  
    } catch (err: any) {
      console.error("이미지 삭제 실패:", err);
      alert(err.message || "이미지 삭제에 실패했습니다.");
    } finally {
      setIsDeleting(false);
    }
  };

  const handleNicknameUpdate = async () => {
    if (!newNickname.trim()) {
      return alert("닉네임을 입력해주세요.");
    }

    if (newNickname === user?.nickname) {
      setIsEditing(false);
      return;
    }

    if (newNickname.length < 2 || newNickname.length > 20) {
      return alert("닉네임은 2~20자 사이여야 합니다.");
    }

    try {
      const token = getToken();

      const res = await fetch(`http://localhost:8080/api/members/update`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ nickname: newNickname }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.message || "닉네임 수정 실패");
      }

      setUser(prev => {
        if (!prev) return null;
        return { ...prev, nickname: newNickname };
      });

      setIsEditing(false);
      alert("닉네임이 변경되었습니다!");

    } catch (err: any) {
      console.error("닉네임 변경 실패:", err);
      alert(err.message || "닉네임 변경에 실패했습니다.");
    }
  };

  if (!user) {
    return (
      <div className="flex justify-center items-center h-screen">
        <div className="text-xl font-medium text-gray-500">로딩 중...</div>
      </div>
    );
  }

  const initial = user.nickname.charAt(0).toUpperCase();
  const bgColor = getProfileColor(user.nickname);

  return (
    <div className="max-w-md mx-auto mt-20 p-6 bg-white rounded-xl shadow-md border border-gray-100">
      <h1 className="text-2xl font-bold text-center mb-8 text-gray-800">마이페이지</h1>

      <div className="flex flex-col items-center gap-6">
        <div className="relative group w-32 h-32">
          {user.profileImageUrl ? (
            <img
              src={preview || user.profileImageUrl}
              alt="Profile"
              className="w-full h-full rounded-full object-cover border-2 border-gray-100 shadow-sm"
            />
          ) : (
            <div className={`w-full h-full rounded-full ${bgColor} flex items-center justify-center border-2 border-gray-100 shadow-sm`}>
              <span className="text-6xl font-bold text-white/90">{initial}</span>
            </div>
          )}

          {isUploading ? (
            <div className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-full">
              <span className="text-white text-sm font-medium">업로드 중...</span>
            </div>
          ) : (
            <label className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-full opacity-0 group-hover:opacity-100 cursor-pointer transition-all duration-200">
              <span className="text-white text-sm font-medium">📷 변경</span>
              <input
                type="file"
                accept="image/jpg,image/jpeg,image/png,image/gif"
                className="hidden"
                onChange={handleImageChange}
              />
            </label>
          )}
        </div>
  {/* 삭제 버튼 */}
  {user.profileImageUrl && !isUploading && !isDeleting && (
    <button
      onClick={handleImageDelete}
      className="text-xs text-gray-500 hover:text-red-500 transition-colors duration-200 underline"
    >
     삭제
    </button>
  )}
        <div className="text-center w-full space-y-4">
          <div className="flex flex-col items-center justify-center">
            {isEditing ? (
              <div className="flex items-center gap-2 mb-1">
                <input
                  type="text"
                  className="border border-blue-400 p-1 px-2 rounded text-lg font-medium text-center w-40 focus:outline-none ring-2 ring-blue-100"
                  value={newNickname}
                  onChange={(e) => setNewNickname(e.target.value)}
                  onKeyPress={(e) => e.key === "Enter" && handleNicknameUpdate()}
                  autoFocus
                  maxLength={20}
                />
                <div className="flex gap-1">
                  <button
                    onClick={handleNicknameUpdate}
                    className="bg-blue-500 text-white p-1.5 rounded hover:bg-blue-600 transition"
                    title="저장"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </button>
                  <button
                    onClick={() => setIsEditing(false)}
                    className="bg-gray-200 text-gray-600 p-1.5 rounded hover:bg-gray-300 transition"
                    title="취소"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2 mb-1 group justify-center relative">
                <h2 className="text-2xl font-bold text-gray-800">{user.nickname}</h2>
                <button
                  onClick={() => {
                    setNewNickname(user.nickname);
                    setIsEditing(true);
                  }}
                  className="opacity-0 group-hover:opacity-100 transition-opacity text-gray-400 hover:text-blue-500 p-1 absolute -right-8"
                  title="닉네임 변경"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                  </svg>
                </button>
              </div>
            )}

            <p className="text-xs text-gray-500">
              가입일: {formatDate(user.createDate)}
            </p>
          </div>

          <div className="bg-gray-50 p-3 rounded-lg">
            <span className="text-xs text-gray-400 block mb-1">이메일</span>
            <p className="text-gray-600 font-medium">{user.email}</p>
          </div>
        </div>
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
