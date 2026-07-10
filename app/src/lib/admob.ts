import { Capacitor } from "@capacitor/core";
import {
  AdMob,
  BannerAdPosition,
  BannerAdSize,
} from "@capacitor-community/admob";

export const ADMOB_TEST_APP_ID = "ca-app-pub-3940256099942544~3347511713";
export const ADMOB_TEST_BANNER_ID = "ca-app-pub-3940256099942544/9214589741";
export const ADMOB_TEST_REWARDED_ID = "ca-app-pub-3940256099942544/5224354917";

let initializePromise: Promise<boolean> | null = null;

export function isNativeAdMobAvailable() {
  return Capacitor.getPlatform() !== "web";
}

export function initializeAdMobForTesting() {
  if (!isNativeAdMobAvailable()) return Promise.resolve(false);

  initializePromise ??= AdMob.initialize({
    initializeForTesting: true,
  })
    .then(() => true)
    .catch((error) => {
      console.warn("AdMob init failed", error);
      return false;
    });

  return initializePromise;
}

export async function showFreeBannerAdForNativeApp() {
  const initialized = await initializeAdMobForTesting();
  if (!initialized) return false;

  try {
    await AdMob.showBanner({
      adId: ADMOB_TEST_BANNER_ID,
      adSize: BannerAdSize.ADAPTIVE_BANNER,
      position: BannerAdPosition.TOP_CENTER,
      isTesting: true,
    });

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
      isTesting: true,
    });

    await AdMob.showRewardVideoAd();
    return true;
  } catch (error) {
    console.warn("AdMob rewarded failed", error);
    return false;
  }
}

export async function hideFreeBannerAdForNativeApp() {
  if (!isNativeAdMobAvailable()) return false;

  try {
    await AdMob.removeBanner();
    return true;
  } catch (error) {
    console.warn("AdMob banner remove failed", error);
    return false;
  }
}
