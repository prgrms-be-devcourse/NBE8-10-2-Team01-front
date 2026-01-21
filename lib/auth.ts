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
}

export function removeToken(storage?: TokenStorage) {
  if (storage) {
    const store = getStorage(storage);
    store?.removeItem("jwt");
    return;
  }
  if (typeof window === "undefined") return;
  localStorage.removeItem("jwt");
  sessionStorage.removeItem("jwt");
}

export function isAuthed() {
  return !!getToken();
}
