export const FREE_ROUND_BLOCK_SIZE = 3;

const FREE_QUOTA_STORAGE_KEY = "zm_freeQuota_v1";
const MAX_SAVED_ROUND_KEYS = 1000;

export type FreeQuotaState = {
  remainingRounds: number;
  countedRoundKeys: string[];
};

function defaultState(): FreeQuotaState {
  return {
    remainingRounds: FREE_ROUND_BLOCK_SIZE,
    countedRoundKeys: [],
  };
}

function readStoredState(): FreeQuotaState {
  if (typeof window === "undefined") return defaultState();

  try {
    const raw = window.localStorage.getItem(FREE_QUOTA_STORAGE_KEY);
    if (!raw) return defaultState();

    const parsed = JSON.parse(raw) as Partial<FreeQuotaState>;

    const remainingRounds =
      typeof parsed.remainingRounds === "number" &&
      Number.isFinite(parsed.remainingRounds)
        ? Math.max(0, Math.floor(parsed.remainingRounds))
        : FREE_ROUND_BLOCK_SIZE;

    const countedRoundKeys = Array.isArray(parsed.countedRoundKeys)
      ? parsed.countedRoundKeys.filter(
          (value): value is string => typeof value === "string"
        )
      : [];

    return {
      remainingRounds,
      countedRoundKeys: Array.from(new Set(countedRoundKeys)).slice(
        -MAX_SAVED_ROUND_KEYS
      ),
    };
  } catch {
    return defaultState();
  }
}

function saveState(state: FreeQuotaState) {
  if (typeof window === "undefined") return;

  window.localStorage.setItem(
    FREE_QUOTA_STORAGE_KEY,
    JSON.stringify(state)
  );
}

export function getFreeQuotaState(): FreeQuotaState {
  return readStoredState();
}

export function consumeFreeRound(roundKey: string): FreeQuotaState {
  const current = readStoredState();

  if (current.countedRoundKeys.includes(roundKey)) {
    return current;
  }

  const next: FreeQuotaState = {
    remainingRounds: Math.max(0, current.remainingRounds - 1),
    countedRoundKeys: [...current.countedRoundKeys, roundKey].slice(
      -MAX_SAVED_ROUND_KEYS
    ),
  };

  saveState(next);
  return next;
}

export function unlockFreeRoundBlock(): FreeQuotaState {
  const current = readStoredState();

  const next: FreeQuotaState = {
    ...current,
    remainingRounds:
      current.remainingRounds + FREE_ROUND_BLOCK_SIZE,
  };

  saveState(next);
  return next;
}
