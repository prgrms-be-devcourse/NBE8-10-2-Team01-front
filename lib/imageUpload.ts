"use client";

import { API_BASE_URL } from "@/lib/apiConfig";
import { getToken } from "@/lib/auth";

export async function uploadImageFile(file: File): Promise<string> {
  const formData = new FormData();
  formData.append("file", file);

  const token = getToken();
  const headers: HeadersInit = token
    ? {
        Authorization: `Bearer ${token}`,
      }
    : {};

  const url = new URL("/api/images", API_BASE_URL).toString();
  const response = await fetch(url, {
    method: "POST",
    headers,
    body: formData,
  });

  const contentType = response.headers.get("content-type") ?? "";
  const data = contentType.includes("application/json")
    ? await response.json()
    : await response.text();

  if (!response.ok) {
    const errorMessage = (data as any)?.message || "이미지 업로드에 실패했습니다.";
    console.error("Image upload failed", { status: response.status, data });
    throw new Error(`[${response.status}] ${errorMessage}`);
  }

  const resolvedUrl =
    (data as any)?.data?.successUrls?.[0] ??
    (typeof (data as any)?.data === "string" ? (data as any).data : undefined) ??
    (data as any)?.data?.url ??
    (data as any)?.data?.imageUrl ??
    (data as any)?.url ??
    (data as any)?.imageUrl;

  if (!resolvedUrl || typeof resolvedUrl !== "string") {
    throw new Error("업로드 응답에서 이미지 URL을 찾지 못했습니다.");
  }

  return resolvedUrl;
}
