import { Capacitor } from "@capacitor/core";
import {
  AdMob,
  BannerAdPluginEvents,
  BannerAdPosition,
  BannerAdSize,
} from "@capacitor-community/admob";

export const ADMOB_TEST_APP_ID = "ca-app-pub-9232105399279318~4724249575";
export const ADMOB_TEST_BANNER_ID = "ca-app-pub-9232105399279318/1813492693";
export const ADMOB_TEST_REWARDED_ID = "ca-app-pub-9232105399279318/1454400045";

let initializePromise: Promise<boolean> | null = null;
let bannerRequested = false;
let bannerExists = false;
let bannerRecoveryInstalled = false;
let bannerListenersInstalled = false;
let bannerRetryTimer: ReturnType<typeof setTimeout> | null = null;

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

function clearBannerRetry() {
  if (bannerRetryTimer === null) return;

  clearTimeout(bannerRetryTimer);
  bannerRetryTimer = null;
}

function scheduleBannerRetry() {
  if (
    bannerRetryTimer !== null ||
    !bannerRequested ||
    typeof window === "undefined"
  ) {
    return;
  }

  bannerRetryTimer = window.setTimeout(() => {
    bannerRetryTimer = null;
    void ensureFreeBannerVisible();
  }, 30000);
}

async function installBannerListeners() {
  if (bannerListenersInstalled) return;

  try {
    await Promise.all([
      AdMob.addListener(BannerAdPluginEvents.Loaded, () => {
        bannerExists = true;
        clearBannerRetry();
      }),
      AdMob.addListener(BannerAdPluginEvents.FailedToLoad, (error) => {
        console.warn("AdMob banner load failed", error);
        bannerExists = false;
        scheduleBannerRetry();
      }),
    ]);

    bannerListenersInstalled = true;
  } catch (error) {
    console.warn("AdMob banner listeners failed", error);
  }
}

async function createFreeBanner() {
  if (!bannerRequested || !isNativeAdMobAvailable()) return false;

  // Označ hned před showBanner, aby přechod na další screen neposlal
  // druhý showBanner do stejného nativního AdView během načítání reklamy.
  bannerExists = true;

  try {
    await AdMob.showBanner({
      adId: ADMOB_TEST_BANNER_ID,
      adSize: BannerAdSize.ADAPTIVE_BANNER,
      position: BannerAdPosition.TOP_CENTER,
      margin: 0,
      isTesting: false,
    });

    return true;
  } catch (error) {
    bannerExists = false;
    console.warn("AdMob banner failed", error);
    scheduleBannerRetry();
    return false;
  }
}

async function ensureFreeBannerVisible() {
  if (!bannerRequested || !isNativeAdMobAvailable()) return false;

  if (bannerExists) {
    try {
      // Při změně Next.js route banner znovu nenačítej.
      // Plugin 8.0.0 při druhém showBanner() reloaduje existující AdView
      // a při neúspěšném reloadu ho zničí.
      await AdMob.resumeBanner();
      return true;
    } catch (error) {
      console.warn("AdMob banner resume failed", error);
      bannerExists = false;
    }
  }

  return createFreeBanner();
}

async function restoreFreeBannerIfRequested() {
  if (!bannerRequested || !isNativeAdMobAvailable()) return;
  await ensureFreeBannerVisible();
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

  bannerRequested = true;
  await installBannerListeners();
  installBannerRecovery();

  return ensureFreeBannerVisible();
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
  bannerExists = false;
  clearBannerRetry();

  try {
    await AdMob.removeBanner();
    return true;
  } catch (error) {
    console.warn("AdMob banner remove failed", error);
    return false;
  }
}
