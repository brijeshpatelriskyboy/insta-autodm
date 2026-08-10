export interface OnboardingData {
  currentStep: number;
  keyword: string;
  dmMessage: string;
  instagramConnected: boolean;
  completed: boolean;
  skipped: boolean;
}

const DEFAULT_DATA: OnboardingData = {
  currentStep: 0,
  keyword: "GUIDE",
  dmMessage: "Hey! Here's your free guide:\nhttps://example.com",
  instagramConnected: false,
  completed: false,
  skipped: false,
};

function storageKey(userId: string): string {
  return `insta_autodm_onboarding_${userId}`;
}

export function getOnboardingData(userId: string): OnboardingData {
  if (typeof window === "undefined") return DEFAULT_DATA;

  const raw = localStorage.getItem(storageKey(userId));
  if (!raw) return { ...DEFAULT_DATA };

  try {
    return { ...DEFAULT_DATA, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_DATA };
  }
}

export function saveOnboardingData(userId: string, data: Partial<OnboardingData>): OnboardingData {
  const current = getOnboardingData(userId);
  const next = { ...current, ...data };
  localStorage.setItem(storageKey(userId), JSON.stringify(next));
  return next;
}

export function isOnboardingComplete(userId: string): boolean {
  const data = getOnboardingData(userId);
  return data.completed || data.skipped;
}

export function markOnboardingSkipped(userId: string): void {
  saveOnboardingData(userId, { skipped: true, completed: true });
}

export function markOnboardingComplete(userId: string): void {
  saveOnboardingData(userId, { completed: true, skipped: false });
}

function testPanelDismissKey(userId: string): string {
  return `comment2dm_test_automation_dismissed_${userId}`;
}

export function isTestAutomationPanelDismissed(userId: string): boolean {
  if (typeof window === "undefined" || !userId) return false;
  return localStorage.getItem(testPanelDismissKey(userId)) === "1";
}

export function dismissTestAutomationPanel(userId: string): void {
  if (typeof window === "undefined" || !userId) return;
  localStorage.setItem(testPanelDismissKey(userId), "1");
}

export function clearTestAutomationPanelDismiss(userId: string): void {
  if (typeof window === "undefined" || !userId) return;
  localStorage.removeItem(testPanelDismissKey(userId));
}

/** Pure visibility rule for the post-first-rule test panel. */
export function shouldShowTestAutomationPanel(options: {
  hasKeywordRule: boolean;
  hasSuccessfulDm: boolean;
  dismissed: boolean;
}): boolean {
  return (
    options.hasKeywordRule && !options.hasSuccessfulDm && !options.dismissed
  );
}

export const ONBOARDING_STEPS = [
  { id: "welcome", label: "Welcome" },
  { id: "keyword", label: "Keyword" },
  { id: "message", label: "DM Message" },
  { id: "instagram", label: "Instagram" },
  { id: "review", label: "Review" },
  { id: "success", label: "Done" },
] as const;

export const TOTAL_STEPS = ONBOARDING_STEPS.length;
