import fs from "node:fs";
import path from "node:path";

const pluginRoot = path.resolve(
  process.cwd(),
  "node_modules/@capacitor-community/admob"
);
const packagePath = path.join(pluginRoot, "package.json");
const bannerPath = path.join(
  pluginRoot,
  "android/src/main/java/com/getcapacitor/community/admob/banner/BannerExecutor.java"
);

if (!fs.existsSync(packagePath) || !fs.existsSync(bannerPath)) {
  throw new Error("AdMob Android source was not found. Run npm install/ci first.");
}

const pluginPackage = JSON.parse(fs.readFileSync(packagePath, "utf8"));
if (pluginPackage.version !== "8.0.0") {
  throw new Error(
    `Země Město inset patch is validated for @capacitor-community/admob 8.0.0, found ${pluginPackage.version}. Review the patch before upgrading.`
  );
}

let source = fs.readFileSync(bannerPath, "utf8");
const patchMarker = "ZEMEMESTO_INSET_PATCH_V041";

if (source.includes(patchMarker)) {
  console.log("AdMob Android inset patch already applied.");
  process.exit(0);
}

const safeAreaComment = "  // set Safe Area only for Android 15+";
const layoutMarker = "  mAdViewLayout.setLayoutParams(mAdViewLayoutParams);";
const safeStart = source.indexOf(safeAreaComment);

if (safeStart < 0) {
  throw new Error("Expected AdMob Android 15+ safe-area block was not found.");
}

const firstLayout = source.indexOf(layoutMarker, safeStart);
const secondLayout = source.indexOf(layoutMarker, firstLayout + layoutMarker.length);

if (firstLayout < 0 || secondLayout < 0) {
  throw new Error("Could not locate the AdMob banner layout block safely.");
}

// Remove the plugin's Android 15+ listener from DecorView. It blindly adds the
// full system inset and can therefore double-apply navigation-bar space when
// Capacitor/SystemBars has already inset or padded the banner parent.
source = source.slice(0, safeStart) + source.slice(secondLayout);

const createMarker = "  createNewAdView(adOptions);";
const createIndex = source.indexOf(createMarker);

if (createIndex < 0) {
  throw new Error("Could not locate createNewAdView() in AdMob BannerExecutor.");
}

const adaptiveInsetBlock = `  // ${patchMarker}
  // Android 15+ is edge-to-edge. Apply only the part of the system-bar inset
  // that the Capacitor parent has NOT already handled. This avoids duplicate
  // space with 3-button navigation while still protecting banners in a truly
  // edge-to-edge parent (gesture navigation and OEM variants included).
  if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.VANILLA_ICE_CREAM) {
    final int baseLeftMargin = mAdViewLayoutParams.leftMargin;
    final int baseTopMargin = mAdViewLayoutParams.topMargin;
    final int baseRightMargin = mAdViewLayoutParams.rightMargin;
    final int baseBottomMargin = mAdViewLayoutParams.bottomMargin;

    mAdViewLayout.setOnApplyWindowInsetsListener((v, insets) -> {
      android.view.WindowInsets rootInsets =
        activitySupplier.get().getWindow().getDecorView().getRootWindowInsets();
      android.view.WindowInsets effectiveInsets = rootInsets != null ? rootInsets : insets;

      int bottomInset =
        effectiveInsets.getInsets(android.view.WindowInsets.Type.navigationBars()).bottom;
      int topInset =
        effectiveInsets.getInsets(android.view.WindowInsets.Type.statusBars()).top;

      int[] parentLocation = new int[2];
      mViewGroup.getLocationOnScreen(parentLocation);

      int parentTopGap = Math.max(0, parentLocation[1]);
      int parentBottom =
        parentLocation[1] + mViewGroup.getHeight();
      int parentBottomGap =
        Math.max(0, metrics.heightPixels - parentBottom);

      int topAlreadyHandled =
        Math.max(parentTopGap, mViewGroup.getPaddingTop());
      int bottomAlreadyHandled =
        Math.max(parentBottomGap, mViewGroup.getPaddingBottom());

      int missingTopInset =
        Math.max(0, topInset - topAlreadyHandled);
      int missingBottomInset =
        Math.max(0, bottomInset - bottomAlreadyHandled);

      if ("TOP_CENTER".equals(adOptions.position)) {
        mAdViewLayoutParams.setMargins(
          baseLeftMargin,
          baseTopMargin + missingTopInset,
          baseRightMargin,
          baseBottomMargin
        );
      } else if ("BOTTOM_CENTER".equals(adOptions.position)) {
        mAdViewLayoutParams.setMargins(
          baseLeftMargin,
          baseTopMargin,
          baseRightMargin,
          baseBottomMargin + missingBottomInset
        );
      }

      mAdViewLayout.setLayoutParams(mAdViewLayoutParams);
      return insets;
    });
  }

`;

source =
  source.slice(0, createIndex) +
  adaptiveInsetBlock +
  source.slice(createIndex);

const addViewMarker = "  mViewGroup.addView(mAdViewLayout);";
if (!source.includes(addViewMarker)) {
  throw new Error("Could not locate banner addView() call.");
}

source = source.replace(
  addViewMarker,
  `${addViewMarker}
  if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.KITKAT_WATCH) {
    mAdViewLayout.requestApplyInsets();
  }`
);

fs.writeFileSync(bannerPath, source, "utf8");
console.log("Applied Země Město Android banner inset patch for API 35+.");
