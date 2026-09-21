"use client";

import { useEffect, useState } from "react";
import {
  isAdMobPrivacyOptionsRequiredForNativeApp,
  showAdMobPrivacyOptionsForNativeApp,
} from "@/lib/admob";

export default function AdPrivacyOptionsButton() {
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;

    void isAdMobPrivacyOptionsRequiredForNativeApp().then((required) => {
      if (!cancelled) setVisible(required);
    });

    return () => {
      cancelled = true;
    };
  }, []);

  if (!visible) return null;

  async function handleClick() {
    if (busy) return;

    setBusy(true);

    try {
      await showAdMobPrivacyOptionsForNativeApp();
      const required = await isAdMobPrivacyOptionsRequiredForNativeApp();
      setVisible(required);
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={busy}
      style={{
        margin: "8px 0 20px",
        padding: "12px 16px",
        border: "1px solid #777",
        borderRadius: 10,
        background: "#f5f5f5",
        color: "inherit",
        font: "inherit",
        fontWeight: 700,
        cursor: busy ? "default" : "pointer",
        opacity: busy ? 0.7 : 1,
      }}
    >
      {busy
        ? "Otevírám nastavení… / Opening settings…"
        : "Nastavení soukromí reklam / Ad privacy settings"}
    </button>
  );
}
