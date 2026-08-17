import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  CONTACT_UNAVAILABLE_MESSAGE,
  contactRequestSucceeded,
  friendlyContactError,
  validateContactForm,
} from "./contact-forms";

const valid = {
  name: "Ada",
  email: "ada@example.com",
  subject: "Beta question",
  message: "How do keyword rules work?",
};

describe("contact form", () => {
  it("accepts a complete message", () => {
    assert.equal(validateContactForm(valid), null);
  });

  it("rejects empty, invalid email, oversized, and header-injection fields", () => {
    assert.equal(validateContactForm({ ...valid, name: "" }), "Name is required");
    assert.equal(validateContactForm({ ...valid, email: "not-an-email" }), "Enter a valid email address");
    assert.equal(validateContactForm({ ...valid, message: "" }), "Message is required");
    assert.equal(
      validateContactForm({ ...valid, message: "x".repeat(5001) }),
      "Message is too long",
    );
    assert.equal(
      validateContactForm({ ...valid, subject: "Hello\r\nBcc: evil@example.com" }),
      "Invalid input",
    );
  });

  it("treats only backend 2xx as success — provider failure is not success", () => {
    assert.equal(contactRequestSucceeded(200), true);
    assert.equal(contactRequestSucceeded(503), false);
    assert.equal(friendlyContactError(503), CONTACT_UNAVAILABLE_MESSAGE);
    assert.equal(friendlyContactError(429), "Too many attempts. Try again later.");
  });
});
