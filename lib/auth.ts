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
    const keys = Object.keys(store ?? {}).filter((key) =>
      key.startsWith("profileImageUrl:")
    );
    keys.forEach((key) => store?.removeItem(key));
  } else {
    localStorage.removeItem("jwt");
    localStorage.removeItem("id");
    localStorage.removeItem("nickname");
    sessionStorage.removeItem("jwt");
    sessionStorage.removeItem("id");
    sessionStorage.removeItem("nickname");
    Object.keys(localStorage)
      .filter((key) => key.startsWith("profileImageUrl:"))
      .forEach((key) => localStorage.removeItem(key));
    Object.keys(sessionStorage)
      .filter((key) => key.startsWith("profileImageUrl:"))
      .forEach((key) => sessionStorage.removeItem(key));
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

export function getMyProfileImage(storage?: TokenStorage): string | null {
  const id = getMyId(storage);
  if (!id) return null;
  const key = `profileImageUrl:${id}`;
  if (storage) {
    const store = getStorage(storage);
    return store?.getItem(key) ?? null;
  }
  if (typeof window === "undefined") return null;
  return localStorage.getItem(key) ?? sessionStorage.getItem(key);
}

export function setMyProfileImage(
  url: string | null,
  storage: TokenStorage = "local"
) {
  const store = getStorage(storage);
  const id = getMyId(storage);
  if (!store || !id) return;
  const key = `profileImageUrl:${id}`;
  if (!url) {
    store.removeItem(key);
  } else {
    store.setItem(key, url);
  }
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("auth-change"));
  }
}
