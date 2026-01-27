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

function svgDataUrl(svg: string) {
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

function titleSnippet(title: string) {
  const trimmed = title.trim();
  if (!trimmed) return "My Post";
  return trimmed.length > 16 ? `${trimmed.slice(0, 16)}…` : trimmed;
}

export function buildDefaultThumbnails(title: string) {
  const snippet = titleSnippet(title);
  const variants = [
    { bg: "#FDE68A", accent: "#F59E0B" },
    { bg: "#BFDBFE", accent: "#60A5FA" },
    { bg: "#E9D5FF", accent: "#C084FC" },
  ];

  return variants.map((variant, index) => {
    const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <rect width="1200" height="630" fill="${variant.bg}" />
  <circle cx="${200 + index * 140}" cy="140" r="120" fill="${variant.accent}" opacity="0.28" />
  <circle cx="${1030 - index * 80}" cy="520" r="180" fill="${variant.accent}" opacity="0.22" />
  <rect x="120" y="190" rx="28" ry="28" width="960" height="260" fill="white" opacity="0.82" />
  <text x="160" y="330" font-size="64" font-family="Arial, Helvetica, sans-serif" font-weight="700" fill="#111827">
    ${snippet}
  </text>
</svg>`;
    return {
      id: `default-${index + 1}`,
      url: svgDataUrl(svg),
      label: `기본 썸네일 ${index + 1}`,
    };
  });
}

