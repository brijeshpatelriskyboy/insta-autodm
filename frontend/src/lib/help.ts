export const faqItems = [
  {
    question: "How does Comment2DM work?",
    answer:
      "When someone comments a specific keyword on your Instagram post or reel, Comment2DM automatically sends them a personalized DM with your pre-configured message or link.",
  },
  {
    question: "Do I need a Business Instagram account?",
    answer:
      "Yes. Meta requires an Instagram Business or Creator account to use the Messaging API and webhooks. Comment2DM supports Instagram Login for professional accounts.",
  },
  {
    question: "Can I use multiple keywords?",
    answer:
      "Absolutely. Create as many keyword rules as you need. Each rule can have its own DM message and active/inactive status.",
  },
  {
    question: "What happens if two keywords match?",
    answer:
      "The first matching active rule triggers. We recommend using unique, specific keywords like GUIDE or START to avoid conflicts.",
  },
  {
    question: "Is my data secure?",
    answer:
      "Your credentials are encrypted and stored securely. We never share your data with third parties. Access tokens are encrypted at rest and never exposed in client-side code.",
  },
  {
    question: "Is Comment2DM in beta?",
    answer:
      "Yes. Comment2DM is currently in beta. Instagram Business and Creator account automation is available for connected test accounts while we complete Meta App Review.",
  },
];

export const gettingStartedSteps = [
  {
    step: 1,
    title: "Create your account",
    description: "Sign up and access your Comment2DM dashboard.",
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
    description: "Track DMs sent, leads captured, and top keywords in Analytics and Activity Log.",
  },
];
