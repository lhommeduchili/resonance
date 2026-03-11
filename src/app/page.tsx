import { redirect } from "next/navigation";
import { getDefaultLocalizedPath } from "@/lib/i18n/route";

export default function RootPage() {
  redirect(getDefaultLocalizedPath());
}
