export type ThinkingValue = boolean | string;
export type ThinkingOptions = {
  model: string;
  values: ThinkingValue[];
  defaultValue: ThinkingValue | null;
  automaticValue: ThinkingValue | null;
  legacyBoolean: boolean;
};
export function thinkingChoice(value: ThinkingValue) {
  return "value:" + JSON.stringify(value);
}
export function thinkingRequest(choice: string): ThinkingValue | undefined {
  if (choice === "auto") return undefined;
  if (choice === "default") return "";
  try {
    const value = JSON.parse(choice.slice(6));
    return choice.startsWith("value:") &&
      (typeof value === "boolean" ||
        (typeof value === "string" && value.length <= 100))
      ? value
      : undefined;
  } catch {
    return undefined;
  }
}
export function thinkingLabel(value: ThinkingValue | null): string {
  return value === null
    ? "Model default"
    : typeof value === "boolean"
      ? value
        ? "On"
        : "Off"
      : value.charAt(0).toUpperCase() + value.slice(1);
}

export function readThinkingPreferences(
  raw: string | null,
): Record<string, string> {
  try {
    const parsed = JSON.parse(raw || "{}");
    const preferences: Record<string, string> = {};
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      for (const [key, value] of Object.entries(parsed)) {
        if (
          typeof value === "string" &&
          (value === "auto" ||
            value === "default" ||
            thinkingRequest(value) !== undefined)
        ) {
          preferences[key] = value;
        }
      }
    }
    return preferences;
  } catch {
    return {};
  }
}
