"use client";

import * as React from "react";
import { cn } from "@/lib/cn";

type ButtonColor = "green" | "red" | "blue" | "black" | "white";
type ButtonSize = "sm" | "md" | "lg";

type ColorButtonProps = {
  children: React.ReactNode;

  /** 버튼 색상 프리셋 */
  color: ButtonColor;

  /** 버튼 크기 프리셋 */
  size?: ButtonSize;

  /** w-full 같은 레이아웃 옵션을 주고 싶을 때 */
  fullWidth?: boolean;

  /** 클릭 이벤트 */
  onClick?: () => void;

  /** submit 용도로 쓰고 싶을 때 */
  type?: "button" | "submit" | "reset";

  disabled?: boolean;
  className?: string;
};

const sizeClass: Record<ButtonSize, string> = {
  sm: "px-3 py-2 text-sm",
  md: "px-4 py-2 text-sm",
  lg: "px-5 py-3 text-base",
};

const colorClass: Record<ButtonColor, string> = {
  green: "bg-green-600 text-white hover:bg-green-700",
  red: "bg-red-600 text-white hover:bg-red-700",
  blue: "bg-blue-600 text-white hover:bg-blue-700",
  black: "bg-black text-white hover:bg-neutral-800",
  white: "bg-white text-black border border-neutral-300 hover:bg-neutral-50",
};

export function ColorButton({
  children,
  color,
  size = "md",
  fullWidth,
  onClick,
  type = "button",
  disabled,
  className,
}: ColorButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "rounded-md font-medium transition",
        "focus:outline-none focus:ring-2 focus:ring-neutral-300",
        sizeClass[size],
        colorClass[color],
        fullWidth && "w-full",
        disabled && "cursor-not-allowed opacity-60",
        className
      )}
    >
      {children}
    </button>
  );
}
