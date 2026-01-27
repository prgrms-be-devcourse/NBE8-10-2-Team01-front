import { cn } from "@/lib/cn";

type OutputBlockProps = {
  title: string;

  /** 카드 요약 텍스트 */
  summary: string;

  /** 메타 정보 (예: 날짜 · 조회수) */
  meta?: string;

  /** 상단 이미지 URL (없으면 이미지 섹션 숨김) */
  imageUrl?: string;

  className?: string;
};

export function OutputBlock({
  title,
  summary,
  meta,
  imageUrl,
  className,
}: OutputBlockProps) {
  const fallbackImage =
    "data:image/svg+xml;utf8," +
    encodeURIComponent(
      '<svg xmlns="http://www.w3.org/2000/svg" width="800" height="420" viewBox="0 0 800 420"><defs><linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#f8fafc"/><stop offset="100%" stop-color="#e2e8f0"/></linearGradient></defs><rect width="800" height="420" fill="url(#bg)"/><rect x="60" y="70" width="680" height="280" rx="28" fill="#ffffff" opacity="0.75"/><rect x="110" y="130" width="420" height="24" rx="12" fill="#cbd5f5"/><rect x="110" y="180" width="520" height="16" rx="8" fill="#dbeafe"/><rect x="110" y="210" width="480" height="16" rx="8" fill="#dbeafe"/><rect x="110" y="240" width="380" height="16" rx="8" fill="#dbeafe"/><circle cx="650" cy="230" r="48" fill="#e0f2fe"/><circle cx="650" cy="230" r="28" fill="#bae6fd"/></svg>'
    );
  const resolvedImage = imageUrl ?? fallbackImage;
  return (
    <div
      className={cn(
        "w-full overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm",
        className
      )}
    >
      <div className="h-44 w-full">
        {/* next/image로 바꿔도 됨 */}
        <img
          src={resolvedImage}
          alt=""
          className="h-full w-full object-cover"
        />
      </div>
      <div className="flex flex-col gap-2 p-5">
        <div className="truncate text-xl font-semibold text-neutral-900">
          {title}
        </div>
        {meta && <div className="text-xs text-neutral-500">{meta}</div>}
        <div className="whitespace-normal break-words text-sm leading-6 text-neutral-700">
          {summary}
        </div>
        <div className="mt-4 flex items-center gap-3">
          <div className="h-8 w-8 rounded-full bg-neutral-200" />
          <div className="h-3 w-24 rounded-full bg-neutral-200" />
        </div>
      </div>
    </div>
  );
}
