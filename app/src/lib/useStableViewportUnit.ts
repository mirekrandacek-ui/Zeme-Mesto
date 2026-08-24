"use client";

import { useEffect } from "react";

const STABLE_VIEWPORT_UNIT = "--zm-stable-vh";

export function useStableViewportUnit() {
  useEffect(() => {
    const root = document.documentElement;
    const currentOrientation = () =>
      window.matchMedia("(orientation: portrait)").matches
        ? "portrait"
        : "landscape";

    const saveViewportUnit = () => {
      root.style.setProperty(
        STABLE_VIEWPORT_UNIT,
        `${window.innerHeight / 100}px`
      );
      root.dataset.zmStableOrientation = currentOrientation();
    };

    if (
      !root.style.getPropertyValue(STABLE_VIEWPORT_UNIT) ||
      root.dataset.zmStableOrientation !== currentOrientation()
    ) {
      saveViewportUnit();
    }

    let orientationTimer: number | undefined;
    const handleOrientationChange = () => {
      window.clearTimeout(orientationTimer);
      orientationTimer = window.setTimeout(saveViewportUnit, 300);
    };

    window.addEventListener("orientationchange", handleOrientationChange);

    return () => {
      window.clearTimeout(orientationTimer);
      window.removeEventListener("orientationchange", handleOrientationChange);
    };
  }, []);
}
