import { CTASection } from "@/components/marketing/CTASection";
import { FAQSection } from "@/components/marketing/FAQSection";
import { FeaturesGrid } from "@/components/marketing/FeaturesGrid";
import { HeroSection } from "@/components/marketing/HeroSection";
import { HowItWorksSection } from "@/components/marketing/HowItWorksSection";
import { InteractiveDemoSection } from "@/components/marketing/InteractiveDemoSection";
import { PricingSection } from "@/components/marketing/PricingSection";
import { TestimonialsSection } from "@/components/marketing/TestimonialsSection";
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
      <TestimonialsSection />
      <FAQSection limit={6} />
      <CTASection />
    </>
  );
}
