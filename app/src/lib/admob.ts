import { Capacitor } from "@capacitor/core";
import {
  AdMob,
  AdmobConsentStatus,
  PrivacyOptionsRequirementStatus,
  BannerAdPluginEvents,
  BannerAdPosition,
  BannerAdSize,
} from "@capacitor-community/admob";

export const ADMOB_TEST_APP_ID = "ca-app-pub-9232105399279318~4724249575";
export const ADMOB_TEST_BANNER_ID = "ca-app-pub-9232105399279318/1813492693";
export const ADMOB_TEST_REWARDED_ID = "ca-app-pub-9232105399279318/1454400045";

let initializePromise: Promise<boolean> | null = null;
let consentPromise: Promise<boolean> | null = null;
let consentResolvedForSession = false;
let consentAllowsAds = false;
let privacyOptionsRequiredForSession = false;
let bannerRequested = false;
let bannerExists = false;
let bannerRecoveryInstalled = false;
let bannerListenersInstalled = false;
let bannerListenersPromise: Promise<void> | null = null;
let bannerLoading = false;
let bannerRetryTimer: number | null = null;
let bannerLoadWatchdogTimer: number | null = null;

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

async function ensureAdMobConsentForAds() {
  if (!isNativeAdMobAvailable()) return false;
  if (consentResolvedForSession) return consentAllowsAds;
  if (consentPromise) return consentPromise;

  consentPromise = (async () => {
    try {
      let consentInfo = await AdMob.requestConsentInfo();

      if (
        consentInfo.isConsentFormAvailable &&
        consentInfo.status === AdmobConsentStatus.REQUIRED
      ) {
        consentInfo = await AdMob.showConsentForm();
      }

      consentResolvedForSession = true;
      consentAllowsAds = Boolean(consentInfo.canRequestAds);
      privacyOptionsRequiredForSession =
        consentInfo.privacyOptionsRequirementStatus ===
        PrivacyOptionsRequirementStatus.REQUIRED;

      if (!consentAllowsAds) {
        console.info("AdMob consent does not currently allow ad requests");
      }

      return consentAllowsAds;
    } catch (error) {
      console.warn("AdMob consent flow failed", error);
      return false;
    } finally {
      consentPromise = null;
    }
  })();

  return consentPromise;
}

function setBannerBottomInset(height: number) {
  if (typeof document === "undefined") return;

  const safeHeight = Number.isFinite(height) ? Math.max(0, height) : 0;
  document.documentElement.style.setProperty(
    "--zm-banner-bottom-inset",
    `${safeHeight}px`
  );
}

function clearBannerRetry() {
  if (bannerRetryTimer === null) return;

  clearTimeout(bannerRetryTimer);
  bannerRetryTimer = null;
}

function clearBannerLoadWatchdog() {
  if (bannerLoadWatchdogTimer === null) return;

  clearTimeout(bannerLoadWatchdogTimer);
  bannerLoadWatchdogTimer = null;
}

function scheduleBannerLoadWatchdog() {
  if (typeof window === "undefined") return;

  clearBannerLoadWatchdog();

  bannerLoadWatchdogTimer = window.setTimeout(() => {
    bannerLoadWatchdogTimer = null;

    if (!bannerRequested || !bannerLoading || bannerExists) return;

    console.warn("AdMob banner load timed out; scheduling retry");
    bannerLoading = false;
    setBannerBottomInset(0);
    scheduleBannerRetry();
  }, 30000);
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
  if (bannerListenersPromise) return bannerListenersPromise;

  bannerListenersPromise = (async () => {
    try {
      await Promise.all([
        AdMob.addListener(BannerAdPluginEvents.Loaded, () => {
          bannerExists = true;
          bannerLoading = false;
          clearBannerLoadWatchdog();
          clearBannerRetry();
          console.info("AdMob banner loaded");
        }),
        AdMob.addListener(BannerAdPluginEvents.SizeChanged, (size) => {
          setBannerBottomInset(Number(size.height));
        }),
        AdMob.addListener(BannerAdPluginEvents.FailedToLoad, (error) => {
          console.warn("AdMob banner load failed", {
            code: error.code,
            message: error.message,
            error,
          });

          bannerExists = false;
          bannerLoading = false;
          clearBannerLoadWatchdog();
          setBannerBottomInset(0);
          scheduleBannerRetry();
        }),
      ]);

      bannerListenersInstalled = true;
    } catch (error) {
      console.warn("AdMob banner listeners failed", error);
    } finally {
      bannerListenersPromise = null;
    }
  })();

  return bannerListenersPromise;
}

async function createFreeBanner() {
  if (!bannerRequested || !isNativeAdMobAvailable()) return false;

  // A route change can request the same native banner again while AdMob is
  // still loading it. Keep "loading" separate from "loaded" so we never send
  // a second showBanner() into the same native AdView.
  if (bannerLoading) return true;

  bannerLoading = true;
  scheduleBannerLoadWatchdog();

  try {
    await AdMob.showBanner({
      adId: ADMOB_TEST_BANNER_ID,
      adSize: BannerAdSize.ADAPTIVE_BANNER,
      position: BannerAdPosition.BOTTOM_CENTER,
      margin: 0,
      isTesting: false,
    });

    return true;
  } catch (error) {
    bannerExists = false;
    bannerLoading = false;
    clearBannerLoadWatchdog();
    setBannerBottomInset(0);
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
      bannerLoading = false;
      clearBannerLoadWatchdog();
    }
  }

  if (bannerLoading) return true;

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

export async function isAdMobPrivacyOptionsRequiredForNativeApp() {
  if (!isNativeAdMobAvailable()) return false;

  const initialized = await initializeAdMobForTesting();
  if (!initialized) return false;

  await ensureAdMobConsentForAds();
  return privacyOptionsRequiredForSession;
}

export async function showAdMobPrivacyOptionsForNativeApp() {
  if (!isNativeAdMobAvailable()) return false;

  const initialized = await initializeAdMobForTesting();
  if (!initialized) return false;

  try {
    await AdMob.showPrivacyOptionsForm();

    const consentInfo = await AdMob.requestConsentInfo();
    consentResolvedForSession = true;
    consentAllowsAds = Boolean(consentInfo.canRequestAds);
    privacyOptionsRequiredForSession =
      consentInfo.privacyOptionsRequirementStatus ===
      PrivacyOptionsRequirementStatus.REQUIRED;

    return true;
  } catch (error) {
    console.warn("AdMob privacy options failed", error);
    return false;
  }
}

export async function showFreeBannerAdForNativeApp() {
  const initialized = await initializeAdMobForTesting();
  if (!initialized) return false;

  const consentAllowsRequest = await ensureAdMobConsentForAds();
  if (!consentAllowsRequest) return false;

  bannerRequested = true;
  await installBannerListeners();
  installBannerRecovery();

  return ensureFreeBannerVisible();
}

export async function showFreeRewardedAdForNativeApp() {
  const initialized = await initializeAdMobForTesting();
  if (!initialized) return false;

  const consentAllowsRequest = await ensureAdMobConsentForAds();
  if (!consentAllowsRequest) return false;

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
  bannerLoading = false;
  clearBannerLoadWatchdog();
  clearBannerRetry();
  setBannerBottomInset(0);

  try {
    await AdMob.removeBanner();
    return true;
  } catch (error) {
    console.warn("AdMob banner remove failed", error);
    return false;
  }
}
