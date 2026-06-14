export const faqItems = [
  {
    question: "How does Insta AutoDM work?",
    answer:
      "When someone comments a specific keyword on your Instagram post or reel, Insta AutoDM automatically sends them a personalized DM with your pre-configured message or link.",
  },
  {
    question: "Do I need a Business Instagram account?",
    answer:
      "Yes. Meta requires an Instagram Business or Creator account connected to a Facebook Page to use the Messaging API and webhooks.",
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
      "Your credentials are encrypted and stored securely. We never share your data with third parties. Meta OAuth integration is coming in a future release.",
  },
  {
    question: "When will live Instagram integration be available?",
    answer:
      "Meta OAuth and live webhook processing are planned for the next phase. You can configure rules now and connect your account when the integration launches.",
  },
];

export const gettingStartedSteps = [
  {
    step: 1,
    title: "Create your account",
    description: "Sign up and access your Insta AutoDM dashboard.",
  },
  {
    step: 2,
    title: "Add keyword rules",
    description: "Go to Keyword Rules and create triggers like GUIDE, START, or PDF with your DM message.",
  },
  {
    step: 3,
    title: "Connect Instagram",
    description: "Link your Business account via Meta OAuth (coming soon) from the Integrations page.",
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
