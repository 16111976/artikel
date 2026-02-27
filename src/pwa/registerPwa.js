export async function registerPwa(nav = navigator) {
  if (!("serviceWorker" in nav)) return false;
  try {
    await nav.serviceWorker.register("/sw.js");
    return true;
  } catch {
    return false;
  }
}
