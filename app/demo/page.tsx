import { RoadmapPageClient } from "@/components/roadmap/RoadmapPageClient";
import { DEMO_ROADMAP_DOC } from "@/lib/demo/polaris";

export default function DemoPage() {
  return (
    <RoadmapPageClient
      defaultLevel="hsc"
      initialProfile={{ country: "Bangladesh", degree: "undergrad", targetTier: "elite" }}
      initialDoc={DEMO_ROADMAP_DOC}
      apiBase="/api/demo/roadmap"
      demo
    />
  );
}
