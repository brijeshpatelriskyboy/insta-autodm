export interface MetaSetupStep {
  step: number;
  title: string;
  summary: string;
  instructions: string[];
  links?: { label: string; href: string }[];
}

export const META_SETUP_REQUIREMENTS = [
  "Instagram Professional account (Business or Creator)",
  "Meta Developer account with Instagram API (Instagram Login)",
  "Valid OAuth Redirect URI matching META_REDIRECT_URI exactly",
];

export const META_SETUP_STEPS: MetaSetupStep[] = [
  {
    step: 1,
    title: "Create Meta Developer Account",
    summary: "Register as a Meta developer to access the App Dashboard.",
    instructions: [
      "Go to developers.facebook.com and log in with Facebook.",
      "Complete developer registration and verify your account.",
      "Accept the Meta Platform Terms and Developer Policies.",
    ],
    links: [{ label: "Meta for Developers", href: "https://developers.facebook.com/" }],
  },
  {
    step: 2,
    title: "Create Meta App",
    summary: "Create a Business app for Insta AutoDM in the App Dashboard.",
    instructions: [
      "Click Create App → choose Business as the app type.",
      "Name the app (e.g. Insta AutoDM) and connect a Business portfolio if prompted.",
      "Note your Instagram App ID — you will add it as INSTAGRAM_APP_ID on Railway.",
    ],
    links: [{ label: "Create a Meta App", href: "https://developers.facebook.com/apps/" }],
  },
  {
    step: 3,
    title: "Add Instagram API with Instagram Login",
    summary: "Enable Instagram Business Login for comment and messaging access.",
    instructions: [
      "In your app dashboard, click Add Product.",
      "Add Instagram → set up Instagram API with Instagram Login (Business Login).",
      "Add Instagram tester accounts while the app remains in Development mode.",
    ],
    links: [
      {
        label: "Business Login for Instagram",
        href: "https://developers.facebook.com/docs/instagram-platform/instagram-api-with-instagram-login/business-login/",
      },
    ],
  },
  {
    step: 4,
    title: "Configure Instagram OAuth Redirect",
    summary: "Register the production callback URL in your Instagram app settings.",
    instructions: [
      "Under Instagram → API setup with Instagram login, add a Valid OAuth Redirect URI.",
      "Use exactly: https://insta-autodm-production.up.railway.app/api/meta/callback",
      "Do not add a trailing slash — it must match META_REDIRECT_URI character-for-character.",
    ],
    links: [
      {
        label: "Instagram OAuth authorize reference",
        href: "https://developers.facebook.com/docs/instagram-platform/reference/oauth-authorize",
      },
    ],
  },
  {
    step: 5,
    title: "Set Railway Environment Variables",
    summary: "Paste Instagram credentials and the callback URL into Railway.",
    instructions: [
      "Set META_REDIRECT_URI=https://insta-autodm-production.up.railway.app/api/meta/callback",
      "Set INSTAGRAM_APP_ID and INSTAGRAM_APP_SECRET from the Meta app dashboard.",
      "Set META_OAUTH_ENABLED=true after redirect URI and credentials are saved.",
      "Redeploy the backend after saving environment variables.",
    ],
  },
  {
    step: 6,
    title: "Connect Instagram Professional Account",
    summary: "Prepare your Instagram account before OAuth goes live.",
    instructions: [
      "Convert Instagram to a Professional (Business or Creator) account.",
      "Confirm the account can grant Instagram Business Login permissions.",
      "Use Connect Instagram in Insta AutoDM to start the OAuth flow.",
    ],
    links: [
      {
        label: "Instagram professional accounts",
        href: "https://help.instagram.com/502981923235522",
      },
    ],
  },
  {
    step: 7,
    title: "Configure Instagram Webhooks",
    summary: "Point Meta comment webhooks at Insta AutoDM to detect keyword triggers.",
    instructions: [
      "In Meta App Dashboard → Webhooks, add a callback URL (shown on this page).",
      "Paste the Verify Token shown on this page — it must match META_VERIFY_TOKEN on Railway.",
      "Subscribe to the Instagram object and enable the comments field.",
      "Send a test comment containing one of your keyword rules to verify Activity Log entries.",
      "Real DMs are not sent yet — matched comments log as DM pending.",
    ],
    links: [
      {
        label: "Meta Webhooks docs",
        href: "https://developers.facebook.com/docs/graph-api/webhooks/getting-started/",
      },
    ],
  },
];
