"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "react-hot-toast";
import { del, get, post, put } from "@/lib/apiClient";
import { getMyId, isAuthed, setMyProfileImage } from "@/lib/auth";

const fallbackAvatar =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120" viewBox="0 0 96 96"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#e2e8f0"/><stop offset="100%" stop-color="#cbd5f5"/></linearGradient></defs><rect width="96" height="96" rx="48" fill="url(#g)"/><circle cx="48" cy="38" r="16" fill="#ffffff"/><path d="M20 80c4-16 20-24 28-24s24 8 28 24" fill="#ffffff"/></svg>'
  );

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

    get<UserData>(`/api/members/id/${myId}`, { withAuth: true })
      .then((res) => {
        setUser(res.data);
        setPreview(res.data.profileImageUrl || "");
        setMyProfileImage(res.data.profileImageUrl ?? null);
      })
      .catch((err) => {
        console.error("내 정보 로드 실패", err);
        toast.error("정보를 불러오지 못했습니다.");
      });
  }, [router]);

  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    if (file.size > 20 * 1024 * 1024) {
      toast.error("파일 크기는 20MB를 초과할 수 없습니다.");
      return;
    }

    const validExtensions = ["jpg", "jpeg", "png", "gif"];
    const ext = file.name.split(".").pop()?.toLowerCase();
    if (!ext || !validExtensions.includes(ext)) {
      toast.error("jpg, jpeg, png, gif 파일만 업로드 가능합니다.");
      return;
    }

    const oldPreview = preview;
    const objectUrl = URL.createObjectURL(file);
    setPreview(objectUrl);
    setIsUploading(true);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await post<{ profileImageUrl?: string | null }>(
        `/api/members/${user.id}/profile-image`,
        formData,
        { withAuth: true }
      );
      const nextUrl = res.data?.profileImageUrl || objectUrl;

      setUser((prev) => {
        if (!prev) return null;
        return { ...prev, profileImageUrl: nextUrl };
      });
      setMyProfileImage(nextUrl);

      toast.success("프로필 이미지가 변경되었습니다.");
    } catch (err: any) {
      console.error("이미지 업로드 실패:", err);
      toast.error(err.message || "이미지 변경에 실패했습니다.");
      
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
      await del(`/api/members/${user.id}/profile-image`, { withAuth: true });

      setUser((prev) => {
        if (!prev) return null;
        return { ...prev, profileImageUrl: null };
      });
      setPreview("");
      setMyProfileImage(null);

      toast.success("프로필 이미지가 삭제되었습니다.");
    } catch (err: any) {
      console.error("이미지 삭제 실패:", err);
      toast.error(err.message || "이미지 삭제에 실패했습니다.");
    } finally {
      setIsDeleting(false);
    }
  };

  const handleNicknameUpdate = async () => {
    if (!newNickname.trim()) {
      toast.error("닉네임을 입력해주세요.");
      return;
    }

    if (newNickname === user?.nickname) {
      setIsEditing(false);
      return;
    }

    if (newNickname.length < 2 || newNickname.length > 20) {
      toast.error("닉네임은 2~20자 사이여야 합니다.");
      return;
    }

    try {
      await put(`/api/members/update`, { nickname: newNickname }, { withAuth: true });

      setUser((prev) => {
        if (!prev) return null;
        return { ...prev, nickname: newNickname };
      });

      setIsEditing(false);
      toast.success("닉네임이 변경되었습니다!");
    } catch (err: any) {
      console.error("닉네임 변경 실패:", err);
      toast.error(err.message || "닉네임 변경에 실패했습니다.");
    }
  };

  if (!user) {
    return (
      <div className="flex justify-center items-center h-screen">
        <div className="text-xl font-medium text-gray-500">로딩 중...</div>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto mt-20 p-6 bg-white rounded-xl shadow-md border border-gray-100">
      <h1 className="text-2xl font-bold text-center mb-8 text-gray-800">마이페이지</h1>

      <div className="flex flex-col items-center gap-6">
        <div className="relative group w-32 h-32">
          <img
            src={preview || user.profileImageUrl || fallbackAvatar}
            alt="Profile"
            className="w-full h-full rounded-full object-cover border-2 border-gray-100 shadow-sm"
          />

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
                  className="border border-blue-400 p-1 px-2 rounded text-lg font-medium text-center w-40 bg-white text-black focus:outline-none ring-2 ring-blue-100"
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
