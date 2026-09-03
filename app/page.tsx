/**
 * Landing page - the front door of Polaris.
 *
 * A scroll story through the real product: cinematic hero with a floating
 * 3D product mockup → connected ecosystem orbit → growing roadmap tree →
 * Strategist context field → the grounding proof behind it → the Action Lab
 * constellation → Exam Lab and Essay Studio → universities + deadline radar →
 * resources galaxy → integrations data-flow → the interpreter track →
 * partner offers → pricing → final CTA.
 *
 * Ordering is an argument, not a list. Grounding proof sits directly under the
 * Strategist because it is the evidence for the claim that section just made;
 * Action Lab follows because that is where the plan turns into work.
 *
 * Sections alternate dark/light and carry data-section-theme markers so the
 * glass Nav pill adapts as you scroll. Every vignette mirrors a module that
 * actually exists in the app - no invented features.
 */

import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";
import { WhatsNewRibbon } from "@/components/landing/WhatsNewRibbon";
import { LandingHero } from "@/components/landing/LandingHero";
import { FloatingDemoVideo } from "@/components/landing/FloatingDemoVideo";
import { EcosystemOrbit } from "@/components/landing/EcosystemOrbit";
import { RoadmapMotionPreview } from "@/components/landing/RoadmapMotionPreview";
import { StrategistMotionPreview } from "@/components/landing/StrategistMotionPreview";
import { GroundingProof } from "@/components/landing/GroundingProof";
import { ActionLabConstellation } from "@/components/landing/ActionLabConstellation";
import { ExamEssayShowcase } from "@/components/landing/ExamEssayShowcase";
import { UniversityDeadlinePreview } from "@/components/landing/UniversityDeadlinePreview";
import { ResourcesDreamPreview } from "@/components/landing/ResourcesDreamPreview";
import { IntegrationsOrbitPreview } from "@/components/landing/IntegrationsOrbitPreview";
import { InterpreterSection } from "@/components/landing/InterpreterSection";
import { PartnersPreview } from "@/components/landing/PartnersPreview";
import { PricingSection } from "@/components/landing/PricingSection";
import { LandingCTA } from "@/components/landing/LandingCTA";

export default function HomePage() {
  return (
    // bg-ink behind everything so the floating nav pill sits on the dark hero;
    // light sections paint their own bg-paper over it.
    <main className="min-h-screen bg-ink text-paper">
      <Nav />
      <WhatsNewRibbon />
      <LandingHero />
      <FloatingDemoVideo />
      <EcosystemOrbit />
      <RoadmapMotionPreview />
      <StrategistMotionPreview />
      <GroundingProof />
      <ActionLabConstellation />
      <ExamEssayShowcase />
      <UniversityDeadlinePreview />
      <ResourcesDreamPreview />
      <IntegrationsOrbitPreview />
      <InterpreterSection />
      <PartnersPreview />
      <PricingSection />
      <LandingCTA />
      <Footer />
    </main>
  );
}
