"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "react-hot-toast";
import { TextInput } from "@/components/ui/inputs/TextInput";
import { PasswordInput } from "@/components/ui/inputs/PasswordInput";
import { ColorButton } from "@/components/ui/buttons/ColorButton";
import { post, ApiError } from "@/lib/apiClient";

export default function SignupPage() {
  const [email, setEmail] = React.useState("");
  const [nickname, setNickname] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [confirmPassword, setConfirmPassword] = React.useState("");
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      toast.error("비밀번호가 일치하지 않습니다.");
      return;
    }

    try {
      await post("/api/members/sign-up", {
        email,
        nickname,
        password,
      });

      toast.success("회원가입이 완료되었습니다. 로그인 페이지로 이동합니다.");
      router.push("/signin");
    } catch (err) {
      if (err instanceof ApiError) {
        toast.error(err.message || "회원가입 중 오류가 발생했습니다. 다시 시도해 주세요.");
      } else {
        toast.error("알 수 없는 오류가 발생했습니다.");
      }
      console.error(err);
    }
  };

  return (
    <div className="flex min-h-full flex-col justify-center bg-zinc-50 py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <h2 className="mt-6 text-center text-3xl font-bold tracking-tight text-neutral-900">
          회원가입
        </h2>
        <p className="mt-2 text-center text-sm text-neutral-600">
          이미 계정이 있으신가요?{" "}
          <Link
            href="/signin"
            className="font-medium text-amber-600 hover:text-amber-500"
          >
            로그인
          </Link>
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
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

            <TextInput
              name="nickname"
              label="닉네임"
              type="text"
              value={nickname}
              onChange={setNickname}
              required={true}
            />

            <PasswordInput
              name="password"
              label="비밀번호"
              value={password}
              onChange={setPassword}
              required={true}
            />

            <PasswordInput
              name="confirmPassword"
              label="비밀번호 확인"
              value={confirmPassword}
              onChange={setConfirmPassword}
              required={true}
            />

            <div>
              <ColorButton type="submit" color="black" fullWidth>
                회원가입
              </ColorButton>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
