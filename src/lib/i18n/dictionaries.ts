import type { AppMessages } from "@/lib/i18n/messages/en";
import { enMessages } from "@/lib/i18n/messages/en";
import { esCLMessages } from "@/lib/i18n/messages/es-CL";
import type { Locale } from "@/lib/i18n/config";

const DICTIONARIES: Record<Locale, AppMessages> = {
  en: enMessages,
  "es-CL": esCLMessages,
};

export function getMessages(locale: Locale): AppMessages {
  return DICTIONARIES[locale] ?? enMessages;
}

export type { AppMessages };
