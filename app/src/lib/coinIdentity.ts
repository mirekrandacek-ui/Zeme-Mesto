import { getOrCreateLetterDeckOwnerId } from "@/lib/letterDeckOwner";

const COIN_SECRET_STORAGE_KEY = "zm_coinDeviceSecret_v1";

function createSecret(): string {
  if (typeof window !== "undefined" && window.crypto?.getRandomValues) {
    const bytes = new Uint8Array(32);
    window.crypto.getRandomValues(bytes);
    return Array.from(bytes, (value) => value.toString(16).padStart(2, "0")).join("");
  }

  return Date.now().toString(36) + "-" + Math.random().toString(36).slice(2) + "-" + Math.random().toString(36).slice(2);
}

export type CoinIdentity = {
  deviceId: string;
  secret: string;
};

export function getCoinIdentity(): CoinIdentity {
  const deviceId = getOrCreateLetterDeckOwnerId();

  if (typeof window === "undefined") {
    return { deviceId, secret: createSecret() };
  }

  try {
    const saved = window.localStorage.getItem(COIN_SECRET_STORAGE_KEY);
    if (saved && saved.length >= 32) {
      return { deviceId, secret: saved };
    }

    const created = createSecret();
    window.localStorage.setItem(COIN_SECRET_STORAGE_KEY, created);
    return { deviceId, secret: created };
  } catch {
    return { deviceId, secret: createSecret() };
  }
}
