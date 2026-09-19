export function stripHeaderInjection(value: string): string {
  return value.replace(/[\r\n\0]+/g, " ").trim();
}

export function containsHeaderInjection(value: string): boolean {
  return /[\r\n\0]/.test(value);
}

export const CONTACT_LIMITS = {
  name: 100,
  email: 254,
  subject: 200,
  message: 5000,
} as const;

export const CONTACT_RATE_LIMIT = { windowMs: 15 * 60 * 1000, max: 5 } as const;
