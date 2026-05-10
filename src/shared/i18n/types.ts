import type { en } from "./locales/en";

type DeepStringify<T> = {
  [K in keyof T]: T[K] extends string ? string : DeepStringify<T[K]>;
};

export type TranslationSchema = DeepStringify<typeof en>;
