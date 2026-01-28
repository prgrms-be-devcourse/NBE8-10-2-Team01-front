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
