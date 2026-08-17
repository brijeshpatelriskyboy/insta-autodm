export const BILLING_PLANS = [
  {
    slug: "starter" as const,
    name: "Starter",
    price: 9.9,
    features: [
      "Keyword comment → DM automation",
      "Keyword rules",
      "1 Instagram professional account",
      "Activity log and DM send counts",
    ],
  },
  {
    slug: "creator" as const,
    name: "Creator",
    price: 19,
    popular: true,
    features: [
      "Keyword comment → DM automation",
      "Keyword rules",
      "1 Instagram professional account",
      "Activity log and DM send counts",
    ],
  },
  {
    slug: "pro" as const,
    name: "Pro",
    price: 49,
    features: [
      "Keyword comment → DM automation",
      "Keyword rules",
      "1 Instagram professional account",
      "Activity log and DM send counts",
    ],
  },
];
