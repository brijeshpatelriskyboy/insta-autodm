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
      "Yes. Create as many keyword rules as you need. Each rule can have its own DM message, active/inactive status, and optional post scope.",
  },
  {
    question: "What happens if two keywords match?",
    answer:
      "The first matching active rule triggers. We recommend using unique, specific keywords like GUIDE or START to avoid conflicts.",
  },
  {
    question: "Is my data secure?",
    answer:
      "Access tokens are encrypted at rest and are not exposed in client-side code. We do not sell your data.",
  },
  {
    question: "Is Comment2DM in beta?",
    answer:
      "Yes. Comment2DM is in beta / early access. Instagram Business and Creator automation is available for connected approved and test accounts while we complete Meta App Review. Smart Campaigns are not generally available yet.",
  },
  {
    question: "Does Instagram OAuth work today?",
    answer:
      "Yes. Connect Instagram from Integrations using Meta OAuth. Live comment-to-DM works for approved and test accounts. Public availability for every Instagram account still depends on Meta App Review.",
  },
];

export const gettingStartedSteps = [
  {
    step: 1,
    title: "Create your account",
    description: "Sign up and open your Comment2DM dashboard.",
  },
  {
    step: 2,
    title: "Connect Instagram",
    description:
      "Link your Business or Creator account via Meta OAuth from the Integrations page. This works for approved and test accounts during beta.",
  },
  {
    step: 3,
    title: "Add keyword rules",
    description:
      "Go to Keyword Rules and create triggers like GUIDE, START, or PDF with your DM message.",
  },
  {
    step: 4,
    title: "Publish your post",
    description:
      "Tell followers to comment your keyword on your post or reel to receive the DM.",
  },
  {
    step: 5,
    title: "Monitor results",
    description:
      "Track DMs sent and event history in Analytics and the Activity log. Lead export is not part of this beta.",
  },
];
