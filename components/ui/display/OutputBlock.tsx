import { cn } from "@/lib/cn";

type OutputBlockProps = {
  title: string;

  /** 카드 요약 텍스트 */
  summary: string;

  /** 상단 이미지 URL (없으면 이미지 섹션 숨김) */
  imageUrl?: string;

  className?: string;
};

export function OutputBlock({
  title,
  summary,
  imageUrl,
  className,
}: OutputBlockProps) {
  return (
    <div
      className={cn(
        "w-full overflow-hidden rounded-lg border border-neutral-200 bg-white",
        className
      )}
    >
      {imageUrl && (
        <div className="h-40 w-full">
          {/* next/image로 바꿔도 됨 */}
          <img
            src={imageUrl}
            alt=""
            className="h-full w-full object-cover"
          />
        </div>
      )}
      <div className="flex flex-col gap-2 p-4">
        <div className="text-lg font-semibold text-neutral-900">{title}</div>
        <div className="text-sm leading-6 text-neutral-700">{summary}</div>
      </div>
    </div>
  );
}
