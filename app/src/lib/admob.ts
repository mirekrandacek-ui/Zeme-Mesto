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
let bannerRecoveryInstalled = false;

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

async function restoreFreeBannerIfRequested() {
  if (!bannerRequested || !isNativeAdMobAvailable()) return;

  try {
    await AdMob.resumeBanner();
  } catch {
    await showFreeBannerAdForNativeApp();
  }
}

function installBannerRecovery() {
  if (bannerRecoveryInstalled || typeof window === "undefined") return;

  bannerRecoveryInstalled = true;

  const restoreBanner = () => {
    if (document.visibilityState === "hidden") return;
    void restoreFreeBannerIfRequested();
  };

  document.addEventListener("visibilitychange", restoreBanner);
  window.addEventListener("focus", restoreBanner);
  window.addEventListener("pageshow", restoreBanner);
}

export async function showFreeBannerAdForNativeApp() {
  const initialized = await initializeAdMobForTesting();
  if (!initialized) return false;

  try {
    await AdMob.showBanner({
      adId: ADMOB_TEST_BANNER_ID,
      adSize: BannerAdSize.ADAPTIVE_BANNER,
      position: BannerAdPosition.TOP_CENTER,
      margin: 0,
      isTesting: false,
    });

    bannerRequested = true;
    installBannerRecovery();
    return true;
  } catch (error) {
    console.warn("AdMob banner failed", error);
    return false;
  }
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
    await restoreFreeBannerIfRequested();
  }
}

export async function hideFreeBannerAdForNativeApp() {
  if (!isNativeAdMobAvailable()) return false;

  bannerRequested = false;

  try {
    await AdMob.removeBanner();
    return true;
  } catch (error) {
    console.warn("AdMob banner remove failed", error);
    return false;
  }
}
