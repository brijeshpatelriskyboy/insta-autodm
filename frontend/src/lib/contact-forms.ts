export const CONTACT_LIMITS = {
  name: 100,
  email: 254,
  subject: 200,
  message: 5000,
} as const;

export const CONTACT_UNAVAILABLE_MESSAGE =
  "Unable to send your message. Try again later.";

function containsHeaderInjection(value: string): boolean {
  return /[\r\n\0]/.test(value);
}

function isEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export function validateContactForm(input: {
  name: string;
  email: string;
  subject: string;
  message: string;
}): string | null {
  const name = input.name.trim();
  const email = input.email.trim();
  const subject = input.subject.trim();
  const message = input.message.trim();

  if (!name) return "Name is required";
  if (name.length > CONTACT_LIMITS.name) return "Name is too long";
  if (containsHeaderInjection(name) || containsHeaderInjection(email) || containsHeaderInjection(subject)) {
    return "Invalid input";
  }
  if (!email) return "Email is required";
  if (!isEmail(email) || email.length > CONTACT_LIMITS.email) {
    return "Enter a valid email address";
  }
  if (!subject) return "Subject is required";
  if (subject.length > CONTACT_LIMITS.subject) return "Subject is too long";
  if (!message) return "Message is required";
  if (message.length > CONTACT_LIMITS.message) return "Message is too long";
  return null;
}

/** Success UI is shown only after the backend confirms delivery (HTTP 2xx). */
export function contactRequestSucceeded(status: number): boolean {
  return status >= 200 && status < 300;
}

export function friendlyContactError(status: number, message?: string): string {
  if (status === 429) {
    return "Too many attempts. Try again later.";
  }
  if (status === 503) {
    return CONTACT_UNAVAILABLE_MESSAGE;
  }
  return message?.trim() || CONTACT_UNAVAILABLE_MESSAGE;
}
