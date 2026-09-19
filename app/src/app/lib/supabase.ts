import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

function normalizeRoomCode(code: string) {
  return code.trim().toUpperCase();
}

export function roomCreatorTokenStorageKey(code: string) {
  return `zm_roomCreatorToken_${normalizeRoomCode(code)}`;
}

export function roomPlayerTokenStorageKey(code: string) {
  return `zm_roomPlayerToken_${normalizeRoomCode(code)}`;
}

function browserRoomCode() {
  if (typeof window === "undefined") return null;

  const match = window.location.pathname.match(/^\/room\/([^/]+)/i);
  if (!match?.[1]) return null;

  try {
    return normalizeRoomCode(decodeURIComponent(match[1]));
  } catch {
    return normalizeRoomCode(match[1]);
  }
}

async function roomAwareFetch(input: RequestInfo | URL, init?: RequestInit) {
  const headers = new Headers(
    init?.headers ??
      (typeof Request !== "undefined" && input instanceof Request
        ? input.headers
        : undefined)
  );

  if (typeof window !== "undefined") {
    const roomCode = browserRoomCode();

    if (roomCode) {
      headers.set("x-zm-room-code", roomCode);

      const creatorToken = window.localStorage.getItem(
        roomCreatorTokenStorageKey(roomCode)
      );
      const playerToken = window.localStorage.getItem(
        roomPlayerTokenStorageKey(roomCode)
      );

      if (creatorToken) {
        headers.set("x-zm-creator-token", creatorToken);
      }

      if (playerToken) {
        headers.set("x-zm-player-token", playerToken);
      }
    }
  }

  return fetch(input, { ...init, headers });
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  global: {
    fetch: roomAwareFetch,
  },
});

export function createRoomSupabaseClient(
  roomCode: string,
  creatorToken: string
) {
  return createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: {
        "x-zm-room-code": normalizeRoomCode(roomCode),
        "x-zm-creator-token": creatorToken,
      },
    },
  });
}

export function createAccessToken() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(36).slice(2)}-${Math.random()
    .toString(36)
    .slice(2)}`;
}

export async function hashAccessToken(token: string) {
  if (typeof crypto === "undefined" || !crypto.subtle) {
    throw new Error("Secure token hashing is unavailable.");
  }

  const bytes = new TextEncoder().encode(token);
  const digest = await crypto.subtle.digest("SHA-256", bytes);

  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}
