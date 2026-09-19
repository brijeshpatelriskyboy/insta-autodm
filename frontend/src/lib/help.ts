export const faqItems = [
  {
    question: "How does Comment2DM work?",
    answer:
      "When someone comments a keyword on your Instagram post or reel, Comment2DM can send the private-reply message you configured for that keyword rule.",
  },
  {
    question: "Do I need a Business Instagram account?",
    answer:
      "Yes. Meta requires an Instagram Business or Creator account to use the Messaging API and webhooks. Comment2DM supports Instagram Login for professional accounts. Instagram Business and Creator comment-to-DM automation is available through Meta's approved production permissions.",
  },
  {
    question: "Can I use multiple keywords?",
    answer:
      "Yes. Create as many keyword rules as your plan allows. Each rule can have its own DM message and can be scoped to one post or reel, or used across your content.",
  },
  {
    question: "What happens if two keywords match?",
    answer:
      "The first matching active rule is used. Use distinct keywords such as GUIDE or START to avoid overlap.",
  },
  {
    question: "Is my data secure?",
    answer:
      "Passwords are stored as hashes. Instagram access tokens are stored encrypted and are not exposed in client-side application code. See the Privacy Policy for what we collect and which processors we use.",
  },
  {
    question: "Is Comment2DM in beta?",
    answer:
      "Yes. Comment2DM is still in beta as a product. Instagram Business and Creator comment-to-DM automation is available through Meta's approved production permissions.",
  },
];

export const gettingStartedSteps = [
  {
    step: 1,
    title: "Create your account",
    description: "Sign up and access your Comment2DM dashboard. Creating an account does not start a paid subscription.",
  },
  {
    step: 2,
    title: "Add keyword rules",
    description: "Go to Keyword Rules and create triggers like GUIDE, START, or PDF with your DM message.",
  },
  {
    step: 3,
    title: "Connect Instagram",
    description: "Link your Business or Creator account via Meta OAuth from the Integrations page.",
  },
  {
    step: 4,
    title: "Publish your post",
    description: "Tell followers to comment your keyword on your post or reel to receive the DM.",
  },
  {
    step: 5,
    title: "Monitor results",
    description: "Review DM send outcomes and activity from your connected account in Analytics and the activity feed.",
  },
];
