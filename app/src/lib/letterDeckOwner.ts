const LETTER_DECK_OWNER_STORAGE_KEY = "zm_letterDeckOwnerId_v1";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function createUuid(): string {
  if (typeof window !== "undefined" && window.crypto?.randomUUID) {
    return window.crypto.randomUUID();
  }

  const bytes = new Uint8Array(16);

  if (typeof window !== "undefined" && window.crypto?.getRandomValues) {
    window.crypto.getRandomValues(bytes);
  } else {
    for (let index = 0; index < bytes.length; index += 1) {
      bytes[index] = Math.floor(Math.random() * 256);
    }
  }

  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;

  const hex = Array.from(bytes, (value) =>
    value.toString(16).padStart(2, "0")
  );

  return [
    hex.slice(0, 4).join(""),
    hex.slice(4, 6).join(""),
    hex.slice(6, 8).join(""),
    hex.slice(8, 10).join(""),
    hex.slice(10, 16).join(""),
  ].join("-");
}

export function getOrCreateLetterDeckOwnerId(): string {
  if (typeof window === "undefined") {
    return createUuid();
  }

  try {
    const saved = window.localStorage.getItem(
      LETTER_DECK_OWNER_STORAGE_KEY
    );

    if (saved && UUID_PATTERN.test(saved)) {
      return saved;
    }

    const created = createUuid();

    window.localStorage.setItem(
      LETTER_DECK_OWNER_STORAGE_KEY,
      created
    );

    return created;
  } catch {
    return createUuid();
  }
}
