import { ActionLabClient } from "@/components/app/ActionLabClient";
import { LangProvider } from "@/lib/i18n/LangProvider";

export const metadata = {
  title: "Action Lab | Polaris",
  description: "Stress-test decisions, map evidence, practise IELTS and SAT, build routines, and learn from curated videos.",
};

export default function ActionLabPage() {
  return (
    <LangProvider>
      <ActionLabClient />
    </LangProvider>
  );
}
