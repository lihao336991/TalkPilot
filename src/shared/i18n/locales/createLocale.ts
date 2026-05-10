import { en } from "./en";
import type { TranslationSchema } from "../types";

type DeepPartial<T> = {
  [K in keyof T]?: T[K] extends string ? string : DeepPartial<T[K]>;
};

function mergeLocale<T extends Record<string, unknown>>(
  base: T,
  override: DeepPartial<T>,
): T {
  const result: Record<string, unknown> = { ...base };

  for (const key of Object.keys(override) as Array<keyof T>) {
    const overrideValue = override[key];
    const baseValue = base[key];

    if (
      overrideValue &&
      baseValue &&
      typeof overrideValue === "object" &&
      typeof baseValue === "object" &&
      !Array.isArray(overrideValue) &&
      !Array.isArray(baseValue)
    ) {
      result[key as string] = mergeLocale(
        baseValue as Record<string, unknown>,
        overrideValue as DeepPartial<Record<string, unknown>>,
      );
    } else if (overrideValue !== undefined) {
      result[key as string] = overrideValue;
    }
  }

  return result as T;
}

export function createLocale(
  override: DeepPartial<TranslationSchema>,
): TranslationSchema {
  return mergeLocale(en, override);
}
