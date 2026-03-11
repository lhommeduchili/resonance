import { HomeScreen } from "@/components/screens/HomeScreen";
import { resolveLocalizedRuntime, type LocalizedRouteParams } from "@/lib/i18n/route";

export default async function LocalizedHomePage({
  params,
}: {
  params: Promise<LocalizedRouteParams>;
}) {
  const runtime = resolveLocalizedRuntime(await params);

  return <HomeScreen messages={runtime.messages} />;
}
