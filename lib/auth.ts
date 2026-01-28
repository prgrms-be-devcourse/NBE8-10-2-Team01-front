type TokenStorage = "local" | "session";

function getStorage(type: TokenStorage) {
  if (typeof window === "undefined") return null;
  return type === "local" ? localStorage : sessionStorage;
}

export function getToken(storage?: TokenStorage) {
  if (storage) {
    const store = getStorage(storage);
    return store?.getItem("jwt") ?? null;
  }
  if (typeof window === "undefined") return null;
  return localStorage.getItem("jwt") ?? sessionStorage.getItem("jwt");
}

export function setToken(token: string, storage: TokenStorage = "local") {
  const store = getStorage(storage);
  store?.setItem("jwt", token);
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("auth-change"));
  }
}

export function removeToken(storage?: TokenStorage) {
  if (typeof window === "undefined") return;

  if (storage) {
    const store = getStorage(storage);
    store?.removeItem("jwt");
    store?.removeItem("id");
    store?.removeItem("nickname");
  } else {
    localStorage.removeItem("jwt");
    localStorage.removeItem("id");
    localStorage.removeItem("nickname");
    sessionStorage.removeItem("jwt");
    sessionStorage.removeItem("id");
    sessionStorage.removeItem("nickname");
  }

  window.dispatchEvent(new CustomEvent("auth-change"));
}

export function isAuthed() {
  return !!getToken();
}

// ✅ 추가: ID 가져오기
export function getMyId(storage?: TokenStorage): number | null {
  if (storage) {
    const store = getStorage(storage);
    const id = store?.getItem("id");
    return id ? Number(id) : null;
  }
  if (typeof window === "undefined") return null;
  const id = localStorage.getItem("id") ?? sessionStorage.getItem("id");
  return id ? Number(id) : null;
}

// ✅ 추가: 닉네임 가져오기
export function getMyNickname(storage?: TokenStorage): string | null {
  if (storage) {
    const store = getStorage(storage);
    return store?.getItem("nickname") ?? null;
  }
  if (typeof window === "undefined") return null;
  return localStorage.getItem("nickname") ?? sessionStorage.getItem("nickname");
}
