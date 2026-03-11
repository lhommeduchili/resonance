"use client";

import { useEffect } from "react";

export function LocaleDocumentSync({
  locale,
  region,
}: {
  locale: string;
  region: string;
}) {
  useEffect(() => {
    document.documentElement.lang = locale;
    document.documentElement.dataset.region = region;
  }, [locale, region]);

  return null;
}
