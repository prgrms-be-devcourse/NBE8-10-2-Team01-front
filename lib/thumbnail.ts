"use client";

export function extractImageUrls(markdown: string): string[] {
  const urls: string[] = [];
  const regex = /!\[[^\]]*\]\(([^)]+)\)/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(markdown)) !== null) {
    const url = match[1]?.trim();
    if (url) urls.push(url);
  }
  return Array.from(new Set(urls));
}

function titleSnippet(title: string) {
  const trimmed = title.trim();
  if (!trimmed) return "My Post";
  return trimmed.length > 16 ? `${trimmed.slice(0, 16)}…` : trimmed;
}

export type DefaultThumbnailSpec = {
  id: string;
  label: string;
  snippet: string;
  bg: string;
  accent: string;
};

export function buildDefaultThumbnails(title: string): DefaultThumbnailSpec[] {
  const snippet = titleSnippet(title);
  const variants = [
    { bg: "#FDE68A", accent: "#F59E0B" },
    { bg: "#BFDBFE", accent: "#60A5FA" },
    { bg: "#E9D5FF", accent: "#C084FC" },
  ];

  return variants.map((variant, index) => ({
    id: `default-${index + 1}`,
    label: `기본 썸네일 ${index + 1}`,
    snippet,
    bg: variant.bg,
    accent: variant.accent,
  }));
}

function canvasToBlob(canvas: HTMLCanvasElement) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error("썸네일 PNG 변환에 실패했습니다."));
          return;
        }
        resolve(blob);
      },
      "image/png",
      0.92
    );
  });
}

export async function renderDefaultThumbnail(spec: DefaultThumbnailSpec) {
  const width = 1200;
  const height = 630;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Canvas context를 가져오지 못했습니다.");
  }

  ctx.fillStyle = spec.bg;
  ctx.fillRect(0, 0, width, height);

  ctx.globalAlpha = 0.28;
  ctx.fillStyle = spec.accent;
  ctx.beginPath();
  ctx.arc(260, 150, 120, 0, Math.PI * 2);
  ctx.fill();

  ctx.globalAlpha = 0.22;
  ctx.beginPath();
  ctx.arc(1000, 520, 180, 0, Math.PI * 2);
  ctx.fill();

  ctx.globalAlpha = 0.82;
  ctx.fillStyle = "#ffffff";
  const cardX = 120;
  const cardY = 190;
  const cardW = 960;
  const cardH = 260;
  const radius = 28;
  ctx.beginPath();
  ctx.moveTo(cardX + radius, cardY);
  ctx.lineTo(cardX + cardW - radius, cardY);
  ctx.quadraticCurveTo(cardX + cardW, cardY, cardX + cardW, cardY + radius);
  ctx.lineTo(cardX + cardW, cardY + cardH - radius);
  ctx.quadraticCurveTo(
    cardX + cardW,
    cardY + cardH,
    cardX + cardW - radius,
    cardY + cardH
  );
  ctx.lineTo(cardX + radius, cardY + cardH);
  ctx.quadraticCurveTo(cardX, cardY + cardH, cardX, cardY + cardH - radius);
  ctx.lineTo(cardX, cardY + radius);
  ctx.quadraticCurveTo(cardX, cardY, cardX + radius, cardY);
  ctx.closePath();
  ctx.fill();

  ctx.globalAlpha = 1;
  ctx.fillStyle = "#111827";
  ctx.font = '700 64px Arial, Helvetica, sans-serif';
  ctx.textBaseline = "middle";
  ctx.fillText(spec.snippet, 160, 330);

  const blob = await canvasToBlob(canvas);
  const file = new File([blob], `${spec.id}.png`, { type: "image/png" });
  const previewUrl = URL.createObjectURL(blob);

  return { file, previewUrl };
}
