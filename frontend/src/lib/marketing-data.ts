import { getSiteUrl } from "./site";

export const siteConfig = {
  name: "Comment2DM",
  tagline: "Turn Instagram Comments Into Conversations Automatically",
  description:
    "Automatically DM people who comment a keyword on your posts or reels. Instagram Business and Creator comment-to-DM automation is available through Meta's approved production permissions.",
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
  {
    value: "Meta-approved",
    label: "Instagram Business and Creator comment-to-DM automation is available through Meta's approved production permissions.",
  },
  {
    value: "Keyword DMs",
    label: "Send a private reply when someone comments a keyword you configured.",
  },
  {
    value: "Post or reel",
    label: "Scope a keyword to one post or reel, or use it across your content.",
  },
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
    description: "A private reply is sent with the message you configured.",
    highlight: null,
  },
  {
    step: 4,
    title: "Activity logged",
    description: "The comment and DM outcome are stored on your account for follow-up.",
    highlight: null,
  },
];

export const features = [
  {
    title: "Keyword Triggers",
    description:
      "Set custom keywords like GUIDE, START, or PDF. Matching comments can trigger your configured DM.",
    icon: "keyword",
  },
  {
    title: "Automated DMs",
    description:
      "Send a private reply with your message when someone comments a matching keyword.",
    icon: "dm",
  },
  {
    title: "Activity records",
    description:
      "Comment matches and DM send outcomes are stored on your account.",
    icon: "lead",
  },
  {
    title: "Analytics",
    description:
      "See keyword-rule counts and DM event totals from your own connected account data.",
    icon: "analytics",
  },
  {
    title: "Activity Tracking",
    description:
      "Review comment, match, and DM events in your activity feed.",
    icon: "activity",
  },
  {
    title: "Instagram Integration",
    description:
      "Instagram Business and Creator comment-to-DM automation is available through Meta's approved production permissions.",
    icon: "instagram",
  },
];

export const pricingPlans = [
  {
    name: "Starter",
    slug: "starter" as const,
    price: 9,
    annualPrice: 86.4,
    offerPrice: 4.5,
    introductoryMonths: 3,
    description: "For new creators testing comment-to-DM automation.",
    features: [
      "1 Instagram account",
      "5 keyword rules",
      "1,000 DMs / month",
      "Automatic comment-to-DM replies",
      "Analytics dashboard",
      "Activity log",
      "Email support via the contact form",
      "Cancel anytime",
    ],
    cta: "Create Account",
    popular: false,
  },
  {
    name: "Creator",
    slug: "creator" as const,
    price: 19,
    annualPrice: 182.4,
    offerPrice: 9.5,
    introductoryMonths: 3,
    description: "For growing creators managing regular campaigns.",
    features: [
      "3 Instagram accounts",
      "Unlimited keyword rules",
      "10,000 DMs / month",
      "Analytics dashboard",
      "Activity log",
      "Email support via the contact form",
      "Cancel anytime",
    ],
    cta: "Create Account",
    popular: true,
  },
  {
    name: "Pro",
    slug: "pro" as const,
    price: 49,
    annualPrice: 470.4,
    offerPrice: 24.5,
    introductoryMonths: 3,
    description: "For high-volume comment-to-DM automation.",
    features: [
      "15 Instagram accounts",
      "Unlimited keyword rules",
      "25,000 DMs / month",
      "Analytics dashboard",
      "Activity log",
      "Email support via the contact form",
      "Cancel anytime",
    ],
    cta: "Create Account",
    popular: false,
  },
];

export const faqs = [
  {
    question: "How does Comment2DM work?",
    answer:
      "You connect an Instagram Business or Creator account, create keyword rules (like GUIDE or START), and set the DM message. When someone comments that keyword on a matching post or reel, Comment2DM can send your private reply.",
  },
  {
    question: "Is this allowed by Instagram / Meta?",
    answer:
      "Instagram Business and Creator comment-to-DM automation is available through Meta's approved production permissions. You still must follow Meta's platform policies.",
  },
  {
    question: "Do I need an Instagram Business account?",
    answer:
      "Yes. You need an Instagram Business or Creator account. Personal accounts cannot use Instagram messaging APIs.",
  },
  {
    question: "How fast are DMs sent after a comment?",
    answer:
      "Delivery depends on Instagram delivering the comment webhook and on Meta private-reply eligibility. Comment2DM sends after a matching comment is received and claimed.",
  },
  {
    question: "Can I use multiple keywords?",
    answer:
      "Yes. Create as many keyword rules as your plan allows. Each keyword can have its own message, and a rule can be scoped to one post or reel.",
  },
  {
    question: "Does creating an account start billing?",
    answer:
      "Creating an account does not start a paid subscription. Billing begins only after you select a paid plan and complete Stripe checkout.",
  },
  {
    question: "Is there a free trial?",
    answer:
      "There is no 14-day free trial. You can create an account before subscribing, but live automations require an active paid subscription.",
  },
  {
    question: "Can I track leads and conversions?",
    answer:
      "Your dashboard shows keyword-rule counts, DM events, and activity from your connected account. Marketing screenshots on this site are example / illustrative data.",
  },
  {
    question: "Do you support Reels and carousel posts?",
    answer:
      "Keyword triggers can run on feed posts and Reels when Instagram delivers the comment webhook for that media.",
  },
  {
    question: "How do I get support?",
    answer:
      "Use the contact form. There is no live chat, guaranteed response time, or dedicated account manager.",
  },
];

export const audiences = [
  "Instagram creators",
  "Coaches",
  "Real estate agents",
  "Small businesses",
  "Influencers",
];

export const billingDisclosure =
  "Follow @comment2dm.ai and comment GREAT on our pinned Instagram post to unlock 50% off any plan for your first 3 months. The offer requires one continuous initial subscription; cancelling ends the promotion and it cannot be restored or reused. Billing begins only after Stripe checkout is completed.";
