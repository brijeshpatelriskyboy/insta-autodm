import { getSiteUrl } from "./site";

export const siteConfig = {
  name: "Insta AutoDM",
  tagline: "Turn Instagram Comments Into Conversations Automatically.",
  description:
    "Automatically DM people who comment on your posts, capture leads, and grow your audience on autopilot.",
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
  { value: "2.4M+", label: "DMs Sent" },
  { value: "580K+", label: "Leads Generated" },
  { value: "12K+", label: "Active Creators" },
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
    description: "Insta AutoDM instantly matches the comment to your keyword rule.",
    highlight: null,
  },
  {
    step: 3,
    title: "DM sent automatically",
    description: "A personalized DM is delivered in seconds — no manual work.",
    highlight: null,
  },
  {
    step: 4,
    title: "Lead captured",
    description: "The interaction is logged, tracked, and ready for follow-up.",
    highlight: null,
  },
];

export const features = [
  {
    title: "Keyword Triggers",
    description:
      "Set custom keywords like GUIDE, START, or PDF. Every matching comment fires your automation instantly.",
    icon: "keyword",
  },
  {
    title: "Automated DMs",
    description:
      "Send personalized welcome messages, freebies, and booking links the moment someone engages.",
    icon: "dm",
  },
  {
    title: "Lead Capture",
    description:
      "Turn commenters into leads automatically. Every DM interaction is stored and ready to export.",
    icon: "lead",
  },
  {
    title: "Analytics",
    description:
      "Track DMs sent, conversion rates, and top-performing keywords with beautiful real-time dashboards.",
    icon: "analytics",
  },
  {
    title: "Activity Tracking",
    description:
      "See every comment, DM, and lead in a live activity feed. Never miss an engagement again.",
    icon: "activity",
  },
  {
    title: "Instagram Integration",
    description:
      "Connect your Instagram Business account securely. Built for Meta's official API standards.",
    icon: "instagram",
  },
];

export const pricingPlans = [
  {
    name: "Starter",
    slug: "starter" as const,
    price: 9.9,
    description: "Perfect for creators just getting started with DM automation.",
    features: [
      "1 Instagram account",
      "3 keyword rules",
      "500 DMs / month",
      "Basic analytics",
      "Email support",
    ],
    cta: "Start Free Trial",
    popular: false,
  },
  {
    name: "Creator",
    slug: "creator" as const,
    price: 19,
    description: "For growing creators and coaches scaling their audience.",
    features: [
      "2 Instagram accounts",
      "15 keyword rules",
      "5,000 DMs / month",
      "Advanced analytics",
      "Activity tracking",
      "Priority support",
    ],
    cta: "Start Free Trial",
    popular: true,
  },
  {
    name: "Pro",
    slug: "pro" as const,
    price: 49,
    description: "For agencies, teams, and high-volume businesses.",
    features: [
      "5 Instagram accounts",
      "Unlimited keyword rules",
      "25,000 DMs / month",
      "Full analytics suite",
      "Team members (3 seats)",
      "API access",
      "Dedicated support",
    ],
    cta: "Start Free Trial",
    popular: false,
  },
];

export const testimonials = [
  {
    quote:
      "I went from manually DMing 50 people a day to zero. Insta AutoDM handles everything while I focus on creating content.",
    name: "Sarah Chen",
    role: "Fitness Coach",
    followers: "124K followers",
    avatar: "SC",
  },
  {
    quote:
      "My lead magnet comments went from a 12% response rate to 89%. The keyword trigger for 'GUIDE' alone generated 340 leads last month.",
    name: "Marcus Rivera",
    role: "Real Estate Agent",
    followers: "28K followers",
    avatar: "MR",
  },
  {
    quote:
      "We use it for three client accounts. The analytics alone paid for the subscription in the first week.",
    name: "Elena Vasquez",
    role: "Social Media Agency Owner",
    followers: "Agency · 8 clients",
    avatar: "EV",
  },
  {
    quote:
      "Setup took 4 minutes. Connected Instagram, added my keywords, and had my first automated DM within an hour.",
    name: "Jordan Blake",
    role: "Lifestyle Influencer",
    followers: "89K followers",
    avatar: "JB",
  },
  {
    quote:
      "As a small bakery, we capture catering inquiries automatically when people comment 'MENU'. It's like having a 24/7 sales rep.",
    name: "Priya Sharma",
    role: "Small Business Owner",
    followers: "12K followers",
    avatar: "PS",
  },
];

export const faqs = [
  {
    question: "How does Insta AutoDM work?",
    answer:
      "You connect your Instagram Business account, create keyword rules (like GUIDE or START), and set the DM message to send. When someone comments that keyword on your post or reel, Insta AutoDM automatically sends your personalized DM within seconds.",
  },
  {
    question: "Is this allowed by Instagram / Meta?",
    answer:
      "Yes. Insta AutoDM uses Meta's official Instagram Messaging API for Business accounts. We follow Meta's platform policies and rate limits to keep your account safe and compliant.",
  },
  {
    question: "Do I need an Instagram Business account?",
    answer:
      "Yes. You need an Instagram Business or Creator account connected to a Facebook Page. Personal accounts cannot use the Instagram Messaging API. We'll guide you through setup in under 5 minutes.",
  },
  {
    question: "How fast are DMs sent after a comment?",
    answer:
      "DMs are typically sent within 5–15 seconds of a matching comment. Our system monitors comments in real time and triggers your automation instantly.",
  },
  {
    question: "Can I use multiple keywords?",
    answer:
      "Absolutely. Create as many keyword rules as your plan allows. Each keyword can have its own custom DM message, so you can run different campaigns on different posts.",
  },
  {
    question: "What happens if I exceed my DM limit?",
    answer:
      "We'll notify you when you reach 80% of your monthly limit. You can upgrade your plan anytime, or automations will pause until your next billing cycle resets.",
  },
  {
    question: "Is there a free trial?",
    answer:
      "Yes. Every plan includes a 14-day free trial with full access to features. No credit card required to start. Cancel anytime during the trial with no charge.",
  },
  {
    question: "Can I track leads and conversions?",
    answer:
      "Yes. Our analytics dashboard shows DMs sent, leads captured, conversion rates, and keyword performance. The activity feed logs every comment and DM in real time.",
  },
  {
    question: "Do you support Reels and carousel posts?",
    answer:
      "Yes. Keyword triggers work on feed posts, Reels, and carousel posts. Any public comment on content linked to your connected account can trigger an automation.",
  },
  {
    question: "How do I get support?",
    answer:
      "Starter plans include email support with 24-hour response times. Creator and Pro plans get priority support. Pro customers also get a dedicated account manager and onboarding call.",
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
