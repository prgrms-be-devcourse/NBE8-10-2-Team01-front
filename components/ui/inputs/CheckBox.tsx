"use client";

import * as React from "react";
import { cn } from "@/lib/cn";

type CheckBoxProps = {
  name: string;
  label: string;
  checked: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
  className?: string;
};

export function CheckBox({
  name,
  label,
  checked,
  onChange,
  disabled,
  className,
}: CheckBoxProps) {
  return (
    <label className={cn("flex items-center gap-3", className)}>
      <button
        type="button"
        aria-pressed={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cn(
          "relative h-5 w-5 rounded border border-neutral-400 bg-white",
          "focus:outline-none focus:ring-2 focus:ring-neutral-300",
          disabled && "opacity-60"
        )}
      >
        {/* 가운데 큰 점 */}
        {checked && (
          <span className="absolute left-1/2 top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-neutral-900" />
        )}
      </button>

      {/* 실제 폼 제출용 hidden input (필요 시) */}
      <input type="hidden" name={name} value={checked ? "true" : "false"} />

      <span className="text-sm text-neutral-900">{label}</span>
    </label>
  );
}
