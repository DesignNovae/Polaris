/**
 * Landing page - the front door of Polaris.
 *
 * A scroll story through the real product: cinematic hero → product demo
 * video → connected ecosystem orbit → growing roadmap tree → Strategist →
 * universities + deadline radar → resources galaxy → integrations data-flow
 * → partner offers → pricing → final CTA.
 *
 * Sections alternate dark/light and carry data-section-theme markers so the
 * glass Nav pill adapts as you scroll. The demo is a recorded walkthrough,
 * not a live sandbox: every call to action leads to sign-up or sign-in.
 */

import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";
import { LandingHero } from "@/components/landing/LandingHero";
import { FloatingDemoVideo } from "@/components/landing/FloatingDemoVideo";
import { EcosystemOrbit } from "@/components/landing/EcosystemOrbit";
import { RoadmapMotionPreview } from "@/components/landing/RoadmapMotionPreview";
import { StrategistMotionPreview } from "@/components/landing/StrategistMotionPreview";
import { UniversityDeadlinePreview } from "@/components/landing/UniversityDeadlinePreview";
import { ResourcesDreamPreview } from "@/components/landing/ResourcesDreamPreview";
import { IntegrationsOrbitPreview } from "@/components/landing/IntegrationsOrbitPreview";
import { PartnersPreview } from "@/components/landing/PartnersPreview";
import { PricingSection } from "@/components/landing/PricingSection";
import { LandingCTA } from "@/components/landing/LandingCTA";

export default function HomePage() {
  return (
    // bg-ink behind everything so the floating nav pill sits on the dark hero;
    // light sections paint their own bg-paper over it.
    <main className="min-h-screen bg-ink text-paper">
      <Nav />
      <LandingHero />
      <FloatingDemoVideo />
      <EcosystemOrbit />
      <RoadmapMotionPreview />
      <StrategistMotionPreview />
      <UniversityDeadlinePreview />
      <ResourcesDreamPreview />
      <IntegrationsOrbitPreview />
      <PartnersPreview />
      <PricingSection />
      <LandingCTA />
      <Footer />
    </main>
  );
}
