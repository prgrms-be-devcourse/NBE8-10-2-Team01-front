"use client";

export const WRITE_DRAFT_KEY = "write-draft";

export type WriteDraft = {
  title: string;
  content: string;
  tags: string[];
};

export function saveWriteDraft(draft: WriteDraft) {
  if (typeof window === "undefined") return;
  window.sessionStorage.setItem(WRITE_DRAFT_KEY, JSON.stringify(draft));
}

export function loadWriteDraft(): WriteDraft | null {
  if (typeof window === "undefined") return null;
  const raw = window.sessionStorage.getItem(WRITE_DRAFT_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as WriteDraft;
  } catch (error) {
    console.error("Failed to parse write draft", error);
    return null;
  }
}

export function clearWriteDraft() {
  if (typeof window === "undefined") return;
  window.sessionStorage.removeItem(WRITE_DRAFT_KEY);
}

