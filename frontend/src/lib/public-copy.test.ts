import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

const srcRoot = join(process.cwd(), "src");

function readSrc(relativePath: string): string {
  return readFileSync(join(srcRoot, relativePath), "utf8");
}

describe("public login and demo lock-down", () => {
  it("does not expose demo credentials on /login or /demo", () => {
    const files = [
      "app/login/page.tsx",
      "app/demo/page.tsx",
      "components/auth/AuthPage.tsx",
    ].map(readSrc);
    for (const source of files) {
      assert.doesNotMatch(source, /demo@comment2dm\.com/i);
      assert.doesNotMatch(source, /demo1234/i);
      assert.doesNotMatch(source, /sign in with demo/i);
    }
    assert.match(readSrc("app/demo/page.tsx"), /redirect\("\/login"\)/);
  });
});

describe("public website truth", () => {
  it("does not advertise a free trial CTA or fake office/chat", () => {
    const marketing = [
      "components/marketing/HeroSection.tsx",
      "components/marketing/CTASection.tsx",
      "components/marketing/PricingSection.tsx",
      "components/marketing/MarketingHeader.tsx",
      "app/(marketing)/pricing/page.tsx",
      "app/(marketing)/contact/page.tsx",
      "app/(marketing)/terms/page.tsx",
      "app/(marketing)/privacy/page.tsx",
      "lib/marketing-data.ts",
    ].map(readSrc);

    for (const source of marketing) {
      assert.doesNotMatch(source, /Start Free Trial/);
      assert.doesNotMatch(source, /No credit card required/i);
      assert.doesNotMatch(source, /hello@comment2dm\.com/);
      assert.doesNotMatch(source, /privacy@comment2dm\.com/);
      assert.doesNotMatch(source, /legal@comment2dm\.com/);
      assert.doesNotMatch(source, /San Francisco/);
    }

    const contact = readSrc("app/(marketing)/contact/page.tsx");
    assert.match(contact, /no live chat/i);
    assert.match(contact, /no dedicated account manager/i);
    assert.match(contact, /ContactForm/);

    const pricing = readSrc("app/(marketing)/pricing/page.tsx");
    assert.doesNotMatch(pricing, /14-day free trial/);
    assert.doesNotMatch(pricing, /launching soon/i);

    const pricingData = readSrc("lib/marketing-data.ts");
    assert.match(pricingData, /name: "Starter"/);
    assert.match(pricingData, /price: 9/);
    assert.match(pricingData, /offerPrice: 5/);
    assert.match(pricingData, /introductoryMonths: 3/);
    assert.match(pricingData, /name: "Creator"/);
    assert.match(pricingData, /name: "Pro"/);
  });

  it("requires registration consent and labels example dashboard data", () => {
    const auth = readSrc("components/auth/AuthPage.tsx");
    assert.match(auth, /acceptedLegal/);
    assert.match(auth, /validateRegistrationConsent/);
    assert.match(auth, /Terms of Service/);
    assert.match(auth, /Privacy Policy/);

    const hero = readSrc("components/marketing/HeroSection.tsx");
    assert.match(hero, /Example \/ illustrative data/);

    const demo = readSrc("components/marketing/InteractiveDemoSection.tsx");
    assert.match(demo, /Example \/ illustrative data/);
  });
});
