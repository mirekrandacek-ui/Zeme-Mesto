import { Capacitor, registerPlugin } from "@capacitor/core";

interface AppControlPlugin {
  exitApp(): Promise<void>;
}

const AppControl = registerPlugin<AppControlPlugin>("AppControl");

export function isAppExitAvailable() {
  return Capacitor.getPlatform() === "android";
}

export async function exitAndroidApp() {
  await AppControl.exitApp();
}
