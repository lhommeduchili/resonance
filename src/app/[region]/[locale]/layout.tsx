import type { ReactNode } from "react";
import { LocaleDocumentSync } from "@/components/i18n/LocaleDocumentSync";
import { getAllLocalizedParamPairs } from "@/lib/i18n/config";
import { resolveLocalizedRuntime, type LocalizedRouteParams } from "@/lib/i18n/route";

export function generateStaticParams() {
  return getAllLocalizedParamPairs();
}

export default async function LocalizedLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<LocalizedRouteParams>;
}) {
  const resolvedParams = await params;
  const { locale, region } = resolveLocalizedRuntime(resolvedParams);

  return (
    <>
      <LocaleDocumentSync locale={locale} region={region} />
      {children}
    </>
  );
}
