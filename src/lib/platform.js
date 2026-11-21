// Which kind of FileForge is running?
//   "desktop"  inside the Tauri app (Windows, macOS, Linux)
//   "android"  inside the Capacitor app (Android)
//   "web"      in a normal browser or the installed PWA
//
// Detection uses globals injected by the native shells, so the web build never
// loads native code.

export function getPlatform(scope = globalThis) {
  try {
    if (scope.Capacitor?.isNativePlatform?.()) return "android";
  } catch {
    // Fall through to the other checks.
  }
  if (scope.__TAURI__ || scope.__TAURI_INTERNALS__) return "desktop";
  return "web";
}

export function isNativeApp(scope = globalThis) {
  return getPlatform(scope) !== "web";
}
