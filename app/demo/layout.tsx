import type { Metadata } from "next";
import { LeftNav } from "@/components/app/LeftNav";
import { TopBar } from "@/components/app/TopBar";
import { AgentChat } from "@/components/app/AgentChat";
import { DemoWorkspaceSeed } from "@/components/demo/DemoWorkspaceSeed";
import { DEMO_PATHS, DEMO_USER } from "@/lib/demo/polaris";

export const metadata: Metadata = {
  title: "Live Demo",
  description: "Explore how Polaris turns student ambition into an evidence-backed academic plan.",
};

export default function DemoLayout({ children }: { children: React.ReactNode }) {
  return (
    <DemoWorkspaceSeed>
      <div className="polaris-workspace-shell h-[100dvh] min-h-0 flex bg-bg overflow-hidden" data-agent-open="true">
        <LeftNav
          plan={DEMO_USER.plan}
          studentName={DEMO_USER.name}
          studentInitials={DEMO_USER.initials}
          studentGrade={DEMO_USER.grade}
          paths={DEMO_PATHS}
          activePathId={DEMO_PATHS[0].id}
          basePath="/demo"
          demo
        />
        <div className="flex-1 min-w-0 flex flex-col h-full">
          <TopBar basePath="/demo" demoUser={DEMO_USER} />
          <main className="polaris-scrollbar flex-1 min-h-0 overflow-y-auto">{children}</main>
        </div>
        <AgentChat
          studentInitials={DEMO_USER.initials}
          pathLabel={DEMO_PATHS[0].name}
          contextChips={["Polaris AI", DEMO_USER.grade, DEMO_USER.country]}
          demo
        />
      </div>
    </DemoWorkspaceSeed>
  );
}
