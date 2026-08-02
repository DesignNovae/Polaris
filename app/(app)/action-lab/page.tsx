import { ActionLabClient } from "@/components/app/ActionLabClient";
import { LangProvider } from "@/lib/i18n/LangProvider";

export default function ActionLabPage() {
  return (
    <LangProvider>
      <ActionLabClient />
    </LangProvider>
  );
}
