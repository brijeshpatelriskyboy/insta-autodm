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

export const ONBOARDING_STEPS = [
  { id: "welcome", label: "Welcome" },
  { id: "keyword", label: "Keyword" },
  { id: "message", label: "DM Message" },
  { id: "instagram", label: "Instagram" },
  { id: "review", label: "Review" },
  { id: "success", label: "Done" },
] as const;

export const TOTAL_STEPS = ONBOARDING_STEPS.length;
