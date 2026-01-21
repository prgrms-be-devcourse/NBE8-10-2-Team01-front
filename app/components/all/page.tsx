"use client";

import * as React from "react";
import { CheckBox } from "@/components/ui/inputs/CheckBox";
import { PasswordInput } from "@/components/ui/inputs/PasswordInput";
import { TextInput } from "@/components/ui/inputs/TextInput";
import { ColorButton } from "@/components/ui/buttons/ColorButton";
import { MenuButton } from "@/components/ui/buttons/MenuButton";
import { OutputBlock } from "@/components/ui/display/OutputBlock";
import { OutputPage } from "@/components/ui/display/OutputPage";

export default function ComponentsAllPage() {
  const [name, setName] = React.useState("홍길동");
  const [password, setPassword] = React.useState("password123");
  const [agree, setAgree] = React.useState(true);

  return (
    <div className="min-h-screen bg-zinc-50 px-6 py-10 text-neutral-900">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-10">
        <header className="flex flex-col gap-2">
          <h1 className="text-2xl font-bold">Components / All</h1>
          <p className="text-sm text-neutral-600">
            기본 컴포넌트 렌더링 상태를 한 화면에서 확인합니다.
          </p>
        </header>

        <section className="rounded-lg border border-neutral-200 bg-white p-6">
          <h2 className="text-lg font-semibold">Inputs</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <TextInput
              name="name"
              label="이름"
              placeholder="이름을 입력하세요"
              value={name}
              onChange={setName}
            />
            <PasswordInput
              name="password"
              label="비밀번호"
              placeholder="비밀번호 입력"
              value={password}
              onChange={setPassword}
            />
            <div className="sm:col-span-2">
              <CheckBox
                name="agree"
                label="약관에 동의합니다"
                checked={agree}
                onChange={setAgree}
              />
            </div>
          </div>
        </section>

        <section className="rounded-lg border border-neutral-200 bg-white p-6">
          <h2 className="text-lg font-semibold">Buttons</h2>
          <div className="mt-4 flex flex-wrap gap-3">
            <ColorButton color="green">Green</ColorButton>
            <ColorButton color="red">Red</ColorButton>
            <ColorButton color="blue">Blue</ColorButton>
            <ColorButton color="black">Black</ColorButton>
            <ColorButton color="white">White</ColorButton>
            <ColorButton color="blue" size="lg">
              Large Button
            </ColorButton>
            <ColorButton color="red" size="sm" disabled>
              Disabled
            </ColorButton>
          </div>
          <div className="mt-6">
            <MenuButton label="메뉴 열기" side="right">
              <div className="text-sm text-neutral-700">
                메뉴 버튼 패널 컨텐츠입니다.
              </div>
            </MenuButton>
          </div>
        </section>

        <section className="rounded-lg border border-neutral-200 bg-white p-6">
          <h2 className="text-lg font-semibold">Display</h2>
          <div className="mt-4 flex flex-col gap-4">
            <OutputBlock
              title="출력 블록 타이틀"
              summary="이 영역은 OutputBlock의 요약입니다. 글의 핵심 내용을 짧게 보여줍니다."
              imageUrl="https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?q=80&w=300&auto=format&fit=crop"
            />
            <OutputPage
              title="출력 페이지 예시"
              author="홍길동"
              timestamp="2024-06-21 14:30"
              hashtags={["frontend", "nextjs", "ui"]}
              callout="이 영역은 콜아웃입니다. 입력이 없으면 숨겨집니다."
              content={`# 소개
이 영역은 OutputPage의 본문입니다.

## 핵심 내용
- 마크다운 문법을 간단히 렌더링합니다.
- 굵은 글씨는 **강조**, 기울임은 *이탤릭*입니다.
- 링크도 가능합니다: [Next.js](https://nextjs.org)

> 이건 인용문 형태의 콜아웃입니다.

마지막 문단입니다.`}
              onEdit={() => {}}
              onDelete={() => {}}
            />
          </div>
        </section>
      </div>
    </div>
  );
}
