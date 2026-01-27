/**
 * @fileoverview
 * API Client 모듈 (클라이언트 전용)
 * -----------------------------------------------------------------------------
 * 이 모듈은 `fetch`를 감싼 경량 래퍼로, **baseURL**, **Authorization** 헤더,
 * **query/body 처리**, **응답 바인딩**을 일관되게 제공합니다.
 *
 * 핵심 동작
 * - `API_BASE_URL` 기준으로 요청 URL 구성
 * - `withAuth` 사용 시 `Authorization: Bearer <token>` 자동 주입
 * - `query`는 URLSearchParams로 변환
 * - `body`는 JSON 직렬화 후 전송
 * - 응답은 `content-type`에 따라 JSON 또는 텍스트로 파싱
 * - 실패 시 `ApiError`(status, data 포함) throw
 *
 * 토큰 탐색 순서
 * 1) options.token
 * 2) localStorage "jwt"
 * 3) sessionStorage "jwt"
 *
 * 사용 예시
 * ```ts
 * import { get, post, request } from "@/lib/apiClient";
 *
 * const list = await get("/posts", {
 *   query: { page: 1, size: 10 },
 *   withAuth: true,
 * });
 *
 * const created = await post("/posts", { title: "Hello" }, { withAuth: true });
 *
 * const user = await request("/me", {
 *   withAuth: true,
 *   bind: (data) => ({ id: (data as any).id }),
 * });
 * ```
 *
 * 주의 사항
 * - 이 모듈은 `"use client"`가 선언된 **클라이언트 전용** 파일입니다.
 * - JWT를 localStorage에 저장하면 XSS에 취약할 수 있으므로,
 *   보안 요구 사항에 따라 httpOnly 쿠키로 전환을 고려하세요.
 */
"use client";

import { API_BASE_URL } from "@/lib/apiConfig";
import { setToken } from "@/lib/auth";

export class ApiError extends Error {
  status: number;
  data: unknown;

  constructor(message: string, status: number, data: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.data = data;
  }
}

type QueryValue = string | number | boolean | null | undefined;

type RequestOptions<T> = {
  method?: string;
  headers?: HeadersInit;
  query?: Record<string, QueryValue>;
  body?: unknown;
  token?: string | null;
  withAuth?: boolean;
  bind?: (data: unknown) => T;
};

type ApiEnvelope<T> = {
  data: T;
  message?: string;
};

function buildUrl(path: string, query?: Record<string, QueryValue>) {
  const url = path.startsWith("http")
    ? new URL(path)
    : new URL(path.startsWith("/") ? path : `/${path}`, API_BASE_URL);

  if (query) {
    Object.entries(query).forEach(([key, value]) => {
      if (value === null || value === undefined) return;
      url.searchParams.set(key, String(value));
    });
  }

  return url;
}

function getAuthToken() {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("jwt") ?? sessionStorage.getItem("jwt");
}

export async function request<T = unknown>(
  path: string,
  options: RequestOptions<T> = {}
): Promise<ApiEnvelope<T>> {
  const url = buildUrl(path, options.query);
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string> | undefined),
  };

  if (options.withAuth) {
    const token = options.token ?? getAuthToken();
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }
  }

  const init: RequestInit = {
    method: options.method ?? (options.body ? "POST" : "GET"),
    headers,
    credentials: "include",
  };

  if (options.body !== undefined) {
    init.body = JSON.stringify(options.body);
  }

  const response = await fetch(url.toString(), init);

  // Automatic token re-issuance
  const newAuthHeader = response.headers.get("Authorization");
  if (newAuthHeader && newAuthHeader.startsWith("Bearer ")) {
    const newToken = newAuthHeader.substring(7);
    setToken(newToken);
  }

  const contentType = response.headers.get("content-type") ?? "";
  const data = contentType.includes("application/json")
    ? await response.json()
    : await response.text();

  if (!response.ok) {
    const errorMessage = (data as any)?.message || "Request failed";
    throw new ApiError(errorMessage, response.status, data);
  }

  const envelope = data as ApiEnvelope<unknown>;
  const boundData = options.bind ? options.bind(envelope.data) : (envelope.data as T);
  return {
    data: boundData,
    message: envelope.message,
  };
}

export function get<T = unknown>(
  path: string,
  options: Omit<RequestOptions<T>, "method" | "body"> = {}
) {
  return request<T>(path, { ...options, method: "GET" });
}

export function post<T = unknown>(
  path: string,
  body: unknown,
  options: Omit<RequestOptions<T>, "method" | "body"> = {}
) {
  return request<T>(path, { ...options, method: "POST", body });
}

export function put<T = unknown>(
  path: string,
  body: unknown,
  options: Omit<RequestOptions<T>, "method" | "body"> = {}
) {
  return request<T>(path, { ...options, method: "PUT", body });
}

export function patch<T = unknown>(
  path: string,
  body: unknown,
  options: Omit<RequestOptions<T>, "method" | "body"> = {}
) {
  return request<T>(path, { ...options, method: "PATCH", body });
}

export function del<T = unknown>(
  path: string,
  options: Omit<RequestOptions<T>, "method" | "body"> = {}
) {
  return request<T>(path, { ...options, method: "DELETE" });
}
