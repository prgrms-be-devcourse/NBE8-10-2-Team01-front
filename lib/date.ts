type DateInput = Date | string | number;

function toDate(input: DateInput): Date | null {
  const date = input instanceof Date ? input : new Date(input);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function formatDate(input: DateInput, locale = "en-US") {
  const date = toDate(input);
  if (!date) return "";
  return new Intl.DateTimeFormat(locale, {
    year: "numeric",
    month: "short",
    day: "2-digit",
  }).format(date);
}

export function formatDateTime(input: DateInput, locale = "en-US") {
  const date = toDate(input);
  if (!date) return "";
  return new Intl.DateTimeFormat(locale, {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export function formatRelative(input: DateInput, now = new Date()) {
  const date = toDate(input);
  if (!date) return "";

  const diffMs = date.getTime() - now.getTime();
  const diff = Math.round(diffMs / 1000);
  const abs = Math.abs(diff);

  if (abs < 10) return "just now";

  const minutes = Math.round(abs / 60);
  if (minutes < 60) return diff < 0 ? `${minutes}m ago` : `in ${minutes}m`;

  const hours = Math.round(minutes / 60);
  if (hours < 24) return diff < 0 ? `${hours}h ago` : `in ${hours}h`;

  const days = Math.round(hours / 24);
  if (days < 7) return diff < 0 ? `${days}d ago` : `in ${days}d`;

  const weeks = Math.round(days / 7);
  if (weeks < 5) return diff < 0 ? `${weeks}w ago` : `in ${weeks}w`;

  const months = Math.round(days / 30);
  if (months < 12) return diff < 0 ? `${months}mo ago` : `in ${months}mo`;

  const years = Math.round(days / 365);
  return diff < 0 ? `${years}y ago` : `in ${years}y`;
}
