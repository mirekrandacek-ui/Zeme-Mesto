const fs = require("fs");
const path = require("path");

const file = path.join(
  process.cwd(),
  "node_modules/@capacitor-community/admob/android/src/main/java/com/getcapacitor/community/admob/banner/BannerExecutor.java"
);

if (!fs.existsSync(file)) {
  console.log("AdMob BannerExecutor.java not found, skipping patch");
  process.exit(0);
}

let text = fs.readFileSync(file, "utf8");

const original = "mAdViewLayoutParams.setMargins(0, topInset, 0, 0);";
const patched = "mAdViewLayoutParams.setMargins(0, 0, 0, 0);";

if (text.includes(patched)) {
  console.log("AdMob top banner patch already applied");
  process.exit(0);
}

if (!text.includes(original)) {
  throw new Error("AdMob top banner patch target not found");
}

text = text.replace(original, patched);
fs.writeFileSync(file, text);
console.log("AdMob top banner patch applied");
