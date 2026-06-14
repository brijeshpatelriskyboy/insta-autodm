export const BILLING_PLANS = [
  {
    slug: "starter" as const,
    name: "Starter",
    price: 9.9,
    features: ["1 Instagram account", "3 keyword rules", "500 DMs / month", "Basic analytics"],
  },
  {
    slug: "creator" as const,
    name: "Creator",
    price: 19,
    popular: true,
    features: [
      "2 Instagram accounts",
      "15 keyword rules",
      "5,000 DMs / month",
      "Advanced analytics",
      "Activity tracking",
    ],
  },
  {
    slug: "pro" as const,
    name: "Pro",
    price: 49,
    features: [
      "5 Instagram accounts",
      "Unlimited keyword rules",
      "25,000 DMs / month",
      "Full analytics suite",
      "Team seats",
      "API access",
    ],
  },
];
