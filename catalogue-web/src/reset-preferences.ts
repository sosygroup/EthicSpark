/** Scope storage cleanup to EthicSpark; never clear storage belonging to other apps. */
export const SETTINGS_KEYS = [
  "ethicspark-provider",
  "ethicspark-model",
  "ethicspark-consents",
  "ethicspark-preload",
  "ethicspark-retention",
  "ethicspark-thinking",
];
export function clearSettingsPreferences(storage: Storage) {
  SETTINGS_KEYS.forEach((key) => storage.removeItem(key));
}
export function clearWorkspacePreferences(local: Storage, session: Storage) {
  for (const storage of [local, session]) {
    const keys = Array.from({ length: storage.length }, (_, index) =>
      storage.key(index),
    );
    keys.forEach((key) => {
      if (
        key &&
        (key.startsWith("ethicspark-") ||
          key === "ethics-project" ||
          key === "ethics-actor")
      )
        storage.removeItem(key);
    });
  }
}
