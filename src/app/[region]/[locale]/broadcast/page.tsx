import { BroadcastTerminalScreen } from "@/components/screens/BroadcastTerminalScreen";
import { resolveLocalizedRuntime, type LocalizedRouteParams } from "@/lib/i18n/route";
import { getCuratorialGraphs } from "@/lib/curation/actions";

export default async function LocalizedBroadcastPage({
  params,
}: {
  params: Promise<LocalizedRouteParams>;
}) {
  const runtime = resolveLocalizedRuntime(await params);
  const curatorialGraphs = await getCuratorialGraphs();

  return <BroadcastTerminalScreen messages={runtime.messages} curatorialGraphs={curatorialGraphs} />;
}
