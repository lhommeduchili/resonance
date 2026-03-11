export const REGION_DEFAULT_LOCALE = {
  global: "en",
  cl: "es-CL",
} as const;

export type Region = keyof typeof REGION_DEFAULT_LOCALE;
export type Locale = (typeof REGION_DEFAULT_LOCALE)[Region] | "en";

export const SUPPORTED_REGIONS = Object.keys(REGION_DEFAULT_LOCALE) as Region[];
export const SUPPORTED_LOCALES = ["en", "es-CL"] as const satisfies readonly Locale[];

export const DEFAULT_REGION: Region = "global";
export const DEFAULT_LOCALE: Locale = "en";

export const REGION_LOCALE_MATRIX: Record<Region, readonly Locale[]> = {
  global: ["en", "es-CL"],
  cl: ["es-CL", "en"],
};

export function isSupportedRegion(value: string): value is Region {
  return SUPPORTED_REGIONS.includes(value as Region);
}

export function isSupportedLocale(value: string): value is Locale {
  return SUPPORTED_LOCALES.includes(value as Locale);
}

export function getRegionDefaultLocale(region: Region): Locale {
  return REGION_DEFAULT_LOCALE[region];
}

export function getRegionLocales(region: Region): readonly Locale[] {
  return REGION_LOCALE_MATRIX[region];
}

export function resolveLocale(region: Region, locale: string): Locale {
  if (isSupportedLocale(locale)) {
    return locale;
  }

  return getRegionDefaultLocale(region);
}

export function buildLocalizedPath(region: Region, locale: Locale, suffix = ""): string {
  const normalizedSuffix = suffix.startsWith("/") ? suffix : `/${suffix}`;
  return suffix ? `/${region}/${locale}${normalizedSuffix}` : `/${region}/${locale}`;
}

export function getAllLocalizedParamPairs(): Array<{ region: Region; locale: Locale }> {
  return SUPPORTED_REGIONS.flatMap((region) =>
    getRegionLocales(region).map((locale) => ({ region, locale })),
  );
}
