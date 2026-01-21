import * as React from "react";
import { cn } from "@/lib/cn";

type OutputPageProps = {
  title: string;

  /** 작성자 이름 */
  author: string;

  /** 작성 시간/날짜 */
  timestamp: string;

  /** 해시태그 배열 (없으면 섹션 숨김) */
  hashtags?: string[];

  /** 강조 콜아웃(없으면 섹션 숨김) */
  callout?: string;

  /** 본문(마크다운) */
  content: string;

  /** 텍스트 액션 */
  onEdit?: () => void;
  onDelete?: () => void;

  className?: string;
};

function renderInline(text: string) {
  const tokenRegex =
    /(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`|\[[^\]]+\]\([^)]+\))/g;
  const parts = text.split(tokenRegex).filter(Boolean);

  return parts.map((part, index) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={index}>{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith("*") && part.endsWith("*")) {
      return <em key={index}>{part.slice(1, -1)}</em>;
    }
    if (part.startsWith("`") && part.endsWith("`")) {
      return (
        <code
          key={index}
          className="rounded bg-neutral-100 px-1 py-0.5 text-[0.9em]"
        >
          {part.slice(1, -1)}
        </code>
      );
    }
    if (part.startsWith("[")) {
      const match = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
      if (match) {
        const [, label, href] = match;
        return (
          <a
            key={index}
            href={href}
            className="text-blue-700 underline underline-offset-2"
          >
            {label}
          </a>
        );
      }
    }
    return <React.Fragment key={index}>{part}</React.Fragment>;
  });
}

function renderMarkdown(markdown: string) {
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  const blocks: React.ReactNode[] = [];
  let i = 0;

  while (i < lines.length) {
    const raw = lines[i];
    const line = raw.trim();
    if (!line) {
      i += 1;
      continue;
    }

    if (line.startsWith("- ") || line.startsWith("* ")) {
      const items: string[] = [];
      while (i < lines.length) {
        const listLine = lines[i].trim();
        if (!(listLine.startsWith("- ") || listLine.startsWith("* "))) break;
        items.push(listLine.slice(2));
        i += 1;
      }
      blocks.push(
        <ul key={`list-${i}`} className="list-inside list-disc space-y-1">
          {items.map((item, idx) => (
            <li key={idx}>{renderInline(item)}</li>
          ))}
        </ul>
      );
      continue;
    }

    if (line.startsWith("### ")) {
      blocks.push(
        <h3 key={`h3-${i}`} className="text-base font-semibold">
          {renderInline(line.slice(4))}
        </h3>
      );
      i += 1;
      continue;
    }

    if (line.startsWith("## ")) {
      blocks.push(
        <h2 key={`h2-${i}`} className="text-lg font-semibold">
          {renderInline(line.slice(3))}
        </h2>
      );
      i += 1;
      continue;
    }

    if (line.startsWith("# ")) {
      blocks.push(
        <h1 key={`h1-${i}`} className="text-xl font-bold">
          {renderInline(line.slice(2))}
        </h1>
      );
      i += 1;
      continue;
    }

    if (line.startsWith("> ")) {
      blocks.push(
        <blockquote
          key={`quote-${i}`}
          className="border-l-2 border-neutral-300 pl-3 text-neutral-700"
        >
          {renderInline(line.slice(2))}
        </blockquote>
      );
      i += 1;
      continue;
    }

    blocks.push(
      <p key={`p-${i}`} className="leading-7 text-neutral-900">
        {renderInline(line)}
      </p>
    );
    i += 1;
  }

  return <div className="space-y-4">{blocks}</div>;
}

export function OutputPage({
  title,
  author,
  timestamp,
  hashtags,
  callout,
  content,
  onEdit,
  onDelete,
  className,
}: OutputPageProps) {
  const hasTags = !!hashtags && hashtags.length > 0;

  return (
    <div className={cn("mx-auto w-full max-w-3xl bg-white p-6", className)}>
      <div className="text-2xl font-bold text-neutral-900">{title}</div>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-sm text-neutral-500">
        <div>
          {author} · {timestamp}
        </div>
        <div className="flex items-center gap-3">
          {onEdit && (
            <button
              type="button"
              onClick={onEdit}
              className="text-xs text-neutral-500 underline underline-offset-2 hover:text-neutral-900"
            >
              수정
            </button>
          )}
          {onDelete && (
            <button
              type="button"
              onClick={onDelete}
              className="text-xs text-neutral-500 underline underline-offset-2 hover:text-neutral-900"
            >
              삭제
            </button>
          )}
        </div>
      </div>

      {hasTags && (
        <div className="mt-4 flex flex-wrap gap-2">
          {hashtags!.map((tag) => (
            <span
              key={tag}
              className="rounded-full bg-neutral-100 px-3 py-1 text-xs text-neutral-700"
            >
              #{tag}
            </span>
          ))}
        </div>
      )}

      {callout && (
        <div className="mt-4 rounded-md border border-neutral-200 bg-neutral-50 p-4 text-sm text-neutral-800">
          {callout}
        </div>
      )}

      <div className="mt-6 text-sm">{renderMarkdown(content)}</div>
    </div>
  );
}
