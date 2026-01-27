"use client";

import * as React from "react";
import { cn } from "@/lib/cn";

type TextInputProps = {
  /** 서버로 보낼 때 구분용 키(폼 name). */
  name: string;

  /** 라벨 텍스트(상단 검은 굵은 글씨). */
  label: string;

  /** 입력 전 예시 텍스트(placeholder). */
  placeholder?: string;

  /** 입력값(부모에서 상태로 들고 있음). */
  value: string;

  /** 값 변경 핸들러(부모에서 setState 연결). */
  onChange: (next: string) => void;

  /** disabled 처리 */
  disabled?: boolean;

  /** input type (기본 text) */
  type?: React.HTMLInputTypeAttribute;

  /** 필수 여부 */
  required?: boolean;

  /** tailwind class 확장 */
  className?: string;
};

export function TextInput({
  name,
  label,
  placeholder,
  value,
  onChange,
  disabled,
  type = "text",
  required,
  className,
}: TextInputProps) {
  return (
    <label className={cn("flex w-full flex-col gap-2", className)}>
      <span className="text-sm font-bold text-black">
        {label}
        {required && <span className="ml-1 text-red-500">*</span>}
      </span>
      <input
        name={name}
        type={type}
        disabled={disabled}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        className={cn(
          "w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm text-black caret-black",
          "placeholder:text-neutral-400",
          "focus:outline-none focus:ring-2 focus:ring-neutral-300",
          disabled && "bg-neutral-100 text-neutral-500"
        )}
      />
    </label>
  );
}
