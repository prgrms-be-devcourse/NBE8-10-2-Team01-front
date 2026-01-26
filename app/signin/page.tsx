"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "react-hot-toast";
import { TextInput } from "@/components/ui/inputs/TextInput";
import { PasswordInput } from "@/components/ui/inputs/PasswordInput";
import { ColorButton } from "@/components/ui/buttons/ColorButton";
import { post, ApiError } from "@/lib/apiClient";
import { setToken } from "@/lib/auth";

export default function SigninPage() {
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    try {
      const response = await post<{ accessToken: string }>("/api/members/sign-in", {
        email,
        password,
      });

      setToken(response.data.accessToken);
      toast.success("로그인이 완료되었습니다.");
      router.push("/");
    } catch (err) {
      if (err instanceof ApiError) {
        toast.error(err.message || "로그인 중 오류가 발생했습니다. 다시 시도해 주세요.");
      } else {
        toast.error("알 수 없는 오류가 발생했습니다.");
      }
      console.error(err);
    }
  };

  return (
    <div className="w-full min-h-screen bg-zinc-50 flex items-center justify-center p-4  pt-16">
      <div className="w-full max-w-md">
        <div>
          <h2 className="text-center text-3xl font-bold tracking-tight text-neutral-900">로그인</h2>
          <p className="mt-2 text-center text-sm text-neutral-600">
            계정이 없으신가요?{" "}
            <Link href="/signup" className="font-medium text-amber-600 hover:text-amber-500">
              회원가입
            </Link>
          </p>
        </div>

        <div className="mt-8">
          <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
            <form className="space-y-6" onSubmit={handleSubmit}>
              <TextInput
                name="email"
                label="이메일 주소"
                type="email"
                value={email}
                onChange={setEmail}
                required={true}
              />

              <PasswordInput name="password" label="비밀번호" value={password} onChange={setPassword} required={true} />

              <div>
                <ColorButton type="submit" color="black" fullWidth>
                  로그인
                </ColorButton>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
