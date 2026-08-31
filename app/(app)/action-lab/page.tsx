import { ActionLabClient } from "@/components/app/ActionLabClient";
import { LangProvider } from "@/lib/i18n/LangProvider";

export const metadata = { title: "Action Lab" };

export default function ActionLabPage() {
  return (
    <LangProvider>
      <ActionLabClient />
    </LangProvider>
  );
}
