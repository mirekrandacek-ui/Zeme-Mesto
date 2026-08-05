"use client";

import { Capacitor } from "@capacitor/core";
import { useEffect } from "react";

export default function NativeServiceWorker() {
  useEffect(() => {
    if (
      process.env.NODE_ENV !== "production" ||
      !Capacitor.isNativePlatform() ||
      !("serviceWorker" in navigator)
    ) {
      return;
    }

    let cancelled = false;

    async function registerServiceWorker() {
      try {
        const registration = await navigator.serviceWorker.register(
          "/sw.js",
          {
            scope: "/",
            updateViaCache: "none",
          }
        );

        if (!cancelled) {
          void registration.update();
        }
      } catch (error) {
        console.error(
          "Native offline cache registration failed:",
          error
        );
      }
    }

    void registerServiceWorker();

    return () => {
      cancelled = true;
    };
  }, []);

  return null;
}
