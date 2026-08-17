import { getSiteUrl } from "./site";

export const siteConfig = {
  name: "Comment2DM",
  tagline: "Turn Instagram Comments Into Conversations Automatically",
  description:
    "Automatically DM people who comment a keyword on your Instagram posts. Comment2DM is in beta — Instagram OAuth and comment-to-DM automation work for approved and test accounts while we complete Meta App Review.",
  get url() {
    return getSiteUrl();
  },
};

export const navLinks = [
  { href: "/features", label: "Features" },
  { href: "/pricing", label: "Pricing" },
  { href: "/faq", label: "FAQ" },
  { href: "/contact", label: "Contact" },
];

export const trustStats = [
  { value: "Comment → DM", label: "Keyword automation that actually sends" },
  { value: "Keyword rules", label: "Create, edit, and scope triggers to posts" },
  { value: "Early access", label: "Beta product — Meta App Review in progress" },
];

export const howItWorksSteps = [
  {
    step: 1,
    title: "User comments",
    description: 'A follower comments "GUIDE" on your post or reel.',
    highlight: "GUIDE",
  },
  {
    step: 2,
    title: "Keyword detected",
    description: "Comment2DM matches the comment to your keyword rule.",
    highlight: null,
  },
  {
    step: 3,
    title: "DM sent automatically",
    description: "A personalized DM is delivered — no manual copy-paste.",
    highlight: null,
  },
  {
    step: 4,
    title: "Activity logged",
    description: "The comment and DM attempt appear in your activity feed so you can see what ran.",
    highlight: null,
  },
];

export const features = [
  {
    title: "Keyword Triggers",
    description:
      "Set custom keywords like GUIDE, START, or PDF. Matching comments fire your automation.",
    icon: "keyword",
  },
  {
    title: "Automated DMs",
    description:
      "Send a pre-written DM the moment someone comments your keyword on a connected professional account.",
    icon: "dm",
  },
  {
    title: "Activity Tracking",
    description:
      "See comments, DM sends, and failures in a live activity feed for your account.",
    icon: "activity",
  },
  {
    title: "DM analytics",
    description:
      "Track how many keyword rules you have and how many DMs your account has sent. Lead export and conversion funnels are not in this beta.",
    icon: "analytics",
  },
  {
    title: "Instagram Integration",
    description:
      "Connect an Instagram Business or Creator account with Meta OAuth. Live automation is available for approved and test accounts while Meta App Review is in progress.",
    icon: "instagram",
  },
  {
    title: "Smart Campaigns (staging)",
    description:
      "Giveaway-style campaigns with unique codes exist in our staging environment. They are not generally available in this public beta.",
    icon: "lead",
  },
];

const BETA_PLAN_FEATURES = [
  "Keyword comment → DM automation",
  "Keyword rules (create, edit, delete)",
  "1 Instagram professional account",
  "Activity log and DM send counts",
  "Meta OAuth for approved / test accounts",
];

export const pricingPlans = [
  {
    name: "Starter",
    slug: "starter" as const,
    price: 9.9,
    description: "Early-access billing option. Same product as every other beta plan.",
    features: BETA_PLAN_FEATURES,
    cta: "Create account",
    popular: false,
  },
  {
    name: "Creator",
    slug: "creator" as const,
    price: 19,
    description: "Early-access billing option. Same product as every other beta plan.",
    features: BETA_PLAN_FEATURES,
    cta: "Create account",
    popular: true,
  },
  {
    name: "Pro",
    slug: "pro" as const,
    price: 49,
    description: "Early-access billing option. Same product as every other beta plan.",
    features: BETA_PLAN_FEATURES,
    cta: "Create account",
    popular: false,
  },
];

export const faqs = [
  {
    question: "How does Comment2DM work?",
    answer:
      "You connect an Instagram Business or Creator account, create keyword rules (like GUIDE or START), and set the DM message. When someone comments that keyword on a connected post, Comment2DM sends your DM.",
  },
  {
    question: "Is this allowed by Instagram / Meta?",
    answer:
      "Comment2DM uses Meta's official Instagram APIs for Business and Creator accounts. Public, unrestricted automation for all Instagram accounts depends on Meta App Review. Today, live connect and DMs work for approved and test accounts.",
  },
  {
    question: "Do I need an Instagram Business account?",
    answer:
      "Yes. You need an Instagram Business or Creator account. Personal accounts cannot use the Instagram Messaging API.",
  },
  {
    question: "How fast are DMs sent after a comment?",
    answer:
      "When Meta delivers the comment webhook, Comment2DM sends the DM immediately. Timing depends on Meta delivery; there is no guaranteed 5–15 second SLA.",
  },
  {
    question: "Can I use multiple keywords?",
    answer:
      "Yes. Create as many keyword rules as you need in this beta. Plan names do not currently enforce rule or DM caps.",
  },
  {
    question: "Are plan limits enforced?",
    answer:
      "Not yet. Starter, Creator, and Pro are billing labels. Extra Instagram accounts, team seats, a public API, and monthly DM caps are not available in this beta.",
  },
  {
    question: "Is there a free trial?",
    answer:
      "There is no 14-day free trial and no “no credit card required” checkout. You can create an account during beta. Paid billing uses Stripe when it is configured; otherwise checkout is unavailable.",
  },
  {
    question: "Can I track leads and conversions?",
    answer:
      "The dashboard shows keyword-rule counts, DMs sent, and an activity feed. Lead capture, lead export, and conversion-rate reporting are not implemented in this beta.",
  },
  {
    question: "Do you support Reels and carousel posts?",
    answer:
      "Keyword rules can be global or scoped to a specific media ID. Public comments on connected professional-account content can trigger automation when Meta delivers the webhook.",
  },
  {
    question: "How do I get support?",
    answer:
      "Comment2DM is in beta. Email hello@comment2dm.com — we do not offer 24-hour SLA, live chat, or a dedicated account manager yet.",
  },
  {
    question: "What about Smart Campaigns?",
    answer:
      "Smart Campaigns (unique codes / giveaway inventory) exist in staging and are not generally available on the public product yet.",
  },
];

export const audiences = [
  "Instagram creators",
  "Coaches",
  "Real estate agents",
  "Small businesses",
  "Influencers",
];

export const socialLinks = [
  { label: "Instagram", href: "https://instagram.com" },
  { label: "Twitter", href: "https://twitter.com" },
  { label: "LinkedIn", href: "https://linkedin.com" },
];
