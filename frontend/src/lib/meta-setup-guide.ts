export interface MetaSetupStep {
  step: number;
  title: string;
  summary: string;
  instructions: string[];
  links?: { label: string; href: string }[];
}

export const META_SETUP_REQUIREMENTS = [
  "Instagram Professional account (Business or Creator)",
  "Facebook Page linked to that Instagram account",
  "Meta Developer account with a configured app",
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
      "Note your App ID — you will add it as META_APP_ID on Railway.",
    ],
    links: [{ label: "Create a Meta App", href: "https://developers.facebook.com/apps/" }],
  },
  {
    step: 3,
    title: "Add Instagram Graph API",
    summary: "Enable Instagram API products for comment and profile access.",
    instructions: [
      "In your app dashboard, click Add Product.",
      "Add Instagram → set up Instagram API / Instagram Graph API.",
      "Add Instagram test users while the app remains in Development mode.",
    ],
    links: [
      {
        label: "Instagram API docs",
        href: "https://developers.facebook.com/docs/instagram-api/",
      },
    ],
  },
  {
    step: 4,
    title: "Add Facebook Login",
    summary: "Facebook Login is required to authorize Instagram Business accounts.",
    instructions: [
      "Add the Facebook Login product to your Meta app.",
      "Under Facebook Login → Settings, enable Client OAuth Login and Web OAuth Login.",
      "Add your site URL under App Domains and Valid OAuth Redirect URIs (next step).",
    ],
    links: [
      {
        label: "Facebook Login docs",
        href: "https://developers.facebook.com/docs/facebook-login/",
      },
    ],
  },
  {
    step: 5,
    title: "Configure Redirect URL",
    summary: "Paste the Insta AutoDM callback URL into your Meta app settings.",
    instructions: [
      "Copy the Redirect URI shown on this page into Meta → Facebook Login → Valid OAuth Redirect URIs.",
      "Set META_REDIRECT_URI on Railway to the exact same URL (no trailing slash).",
      "Set META_APP_ID and META_APP_SECRET from the Meta app dashboard on Railway.",
      "Redeploy the backend after saving environment variables.",
    ],
  },
  {
    step: 6,
    title: "Connect Instagram Professional Account",
    summary: "Prepare your Instagram account before OAuth goes live.",
    instructions: [
      "Convert Instagram to a Professional (Business or Creator) account.",
      "In Instagram → Professional dashboard → Linked accounts, connect a Facebook Page.",
      "Confirm the Page appears in Meta Business Suite before enabling OAuth in Insta AutoDM.",
    ],
    links: [
      {
        label: "Connect IG to a Facebook Page",
        href: "https://www.facebook.com/business/help/898752960195806",
      },
    ],
  },
];
