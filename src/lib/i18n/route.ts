import { notFound } from "next/navigation";
import {
  buildLocalizedPath,
  DEFAULT_LOCALE,
  DEFAULT_REGION,
  getRegionDefaultLocale,
  isSupportedLocale,
  isSupportedRegion,
  type Locale,
  type Region,
} from "@/lib/i18n/config";
import { getMessages } from "@/lib/i18n/dictionaries";

export type LocalizedRouteParams = {
  region: string;
  locale: string;
};

export type LocalizedRuntime = {
  region: Region;
  locale: Locale;
  messages: ReturnType<typeof getMessages>;
};

export function resolveLocalizedRuntime(params: LocalizedRouteParams): LocalizedRuntime {
  if (!isSupportedRegion(params.region) || !isSupportedLocale(params.locale)) {
    notFound();
  }

  return {
    region: params.region,
    locale: params.locale,
    messages: getMessages(params.locale),
  };
}

export function getDefaultLocalizedPath(suffix = ""): string {
  return buildLocalizedPath(DEFAULT_REGION, DEFAULT_LOCALE, suffix);
}

export function getRegionLocalizedPath(region: string, suffix = ""): string {
  if (!isSupportedRegion(region)) {
    return getDefaultLocalizedPath(suffix);
  }

  return buildLocalizedPath(region, getRegionDefaultLocale(region), suffix);
}
