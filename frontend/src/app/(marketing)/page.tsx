import { CTASection } from "@/components/marketing/CTASection";
import { FAQSection } from "@/components/marketing/FAQSection";
import { FeaturesGrid } from "@/components/marketing/FeaturesGrid";
import { HeroSection } from "@/components/marketing/HeroSection";
import { HowItWorksSection } from "@/components/marketing/HowItWorksSection";
import { InteractiveDemoSection } from "@/components/marketing/InteractiveDemoSection";
import { PricingSection } from "@/components/marketing/PricingSection";
import { TrustSection } from "@/components/marketing/TrustSection";

export default function HomePage() {
  return (
    <>
      <HeroSection />
      <TrustSection />
      <HowItWorksSection />
      <InteractiveDemoSection />
      <FeaturesGrid />
      <PricingSection />
      <FAQSection limit={6} />
      <CTASection />
    </>
  );
}
