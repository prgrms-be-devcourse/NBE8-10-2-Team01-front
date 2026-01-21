"use client";

import * as React from "react";
import { cn } from "@/lib/cn";

type MenuButtonProps = {
  /** 버튼 라벨 */
  label: string;

  /** 패널이 뜨는 방향 */
  side?: "left" | "right";

  /** 패널 내용 */
  children: React.ReactNode;

  /** 패널 너비(px) - 기본 240 */
  panelWidthPx?: number;

  className?: string;
};

export function MenuButton({
  label,
  side = "right",
  children,
  panelWidthPx = 240,
  className,
}: MenuButtonProps) {
  const [open, setOpen] = React.useState(false);
  const rootRef = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (!rootRef.current) return;
      if (!rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  return (
    <div ref={rootRef} className={cn("relative inline-flex", className)}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm",
          "hover:bg-neutral-50",
          "focus:outline-none focus:ring-2 focus:ring-neutral-300"
        )}
      >
        {label}
      </button>

      {open && (
        <div
          className={cn(
            "absolute top-0 z-50 rounded-md border border-neutral-200 bg-white p-3 shadow-md"
          )}
          style={{
            width: panelWidthPx,
            left: side === "left" ? `calc(-${panelWidthPx}px - 8px)` : "calc(100% + 8px)",
            right: side === "right" ? "auto" : "auto",
          }}
        >
          {children}
        </div>
      )}
    </div>
  );
}
