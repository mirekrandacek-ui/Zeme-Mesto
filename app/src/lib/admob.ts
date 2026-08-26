import { Capacitor } from "@capacitor/core";
import {
  AdMob,
  BannerAdPosition,
  BannerAdSize,
} from "@capacitor-community/admob";

export const ADMOB_TEST_APP_ID = "ca-app-pub-9232105399279318~4724249575";
export const ADMOB_TEST_BANNER_ID = "ca-app-pub-9232105399279318/1813492693";
export const ADMOB_TEST_REWARDED_ID = "ca-app-pub-9232105399279318/1454400045";

let initializePromise: Promise<boolean> | null = null;
let bannerRequested = false;
let bannerMayExist = false;
let bannerRecoveryInstalled = false;
let ensureBannerPromise: Promise<boolean> | null = null;

export function isNativeAdMobAvailable() {
  return Capacitor.getPlatform() !== "web";
}

export function initializeAdMobForTesting() {
  if (!isNativeAdMobAvailable()) return Promise.resolve(false);

  initializePromise ??= AdMob.initialize({
    initializeForTesting: false,
  })
    .then(() => true)
    .catch((error) => {
      console.warn("AdMob init failed", error);
      return false;
    });

  return initializePromise;
}

function installBannerRecovery() {
  if (bannerRecoveryInstalled || typeof window === "undefined") return;

  bannerRecoveryInstalled = true;

  const restoreBanner = () => {
    if (!bannerRequested || document.visibilityState === "hidden") return;
    void ensureFreeBannerVisibleForNativeApp();
  };

  document.addEventListener("visibilitychange", restoreBanner);
  window.addEventListener("focus", restoreBanner);
  window.addEventListener("pageshow", restoreBanner);
}

async function ensureFreeBannerVisibleForNativeApp() {
  if (!bannerRequested || !isNativeAdMobAvailable()) return false;

  const initialized = await initializeAdMobForTesting();
  if (!initialized) return false;

  if (ensureBannerPromise) return ensureBannerPromise;

  ensureBannerPromise = (async () => {
    if (bannerMayExist) {
      try {
        await AdMob.resumeBanner();
        return true;
      } catch {
        bannerMayExist = false;
      }
    }

    try {
      await AdMob.showBanner({
        adId: ADMOB_TEST_BANNER_ID,
        adSize: BannerAdSize.ADAPTIVE_BANNER,
        position: BannerAdPosition.TOP_CENTER,
        margin: 0,
        isTesting: false,
      });

      bannerMayExist = true;
      return true;
    } catch (error) {
      console.warn("AdMob banner failed", error);
      bannerMayExist = false;
      return false;
    }
  })().finally(() => {
    ensureBannerPromise = null;
  });

  return ensureBannerPromise;
}

export async function showFreeBannerAdForNativeApp() {
  if (!isNativeAdMobAvailable()) return false;

  bannerRequested = true;
  installBannerRecovery();
  return ensureFreeBannerVisibleForNativeApp();
}

export async function showFreeRewardedAdForNativeApp() {
  const initialized = await initializeAdMobForTesting();
  if (!initialized) return false;

  try {
    await AdMob.prepareRewardVideoAd({
      adId: ADMOB_TEST_REWARDED_ID,
      isTesting: false,
    });

    await AdMob.showRewardVideoAd();
    return true;
  } catch (error) {
    console.warn("AdMob rewarded failed", error);
    return false;
  } finally {
    if (bannerRequested) {
      void ensureFreeBannerVisibleForNativeApp();
    }
  }
}

export async function hideFreeBannerAdForNativeApp() {
  if (!isNativeAdMobAvailable()) return false;

  bannerRequested = false;
  bannerMayExist = false;

  try {
    await AdMob.removeBanner();
    return true;
  } catch (error) {
    console.warn("AdMob banner remove failed", error);
    return false;
  }
}
