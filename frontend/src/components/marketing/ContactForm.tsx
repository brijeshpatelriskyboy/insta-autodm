"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { api, ApiError } from "@/lib/api";
import {
  CONTACT_UNAVAILABLE_MESSAGE,
  contactRequestSucceeded,
  friendlyContactError,
  validateContactForm,
} from "@/lib/contact-forms";

export function ContactForm() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSuccess(false);

    const validationError = validateContactForm({ name, email, subject, message });
    if (validationError) {
      setError(validationError);
      return;
    }

    setSubmitting(true);
    try {
      await api.submitContact({
        name: name.trim(),
        email: email.trim(),
        subject: subject.trim(),
        message: message.trim(),
      });
      if (!contactRequestSucceeded(200)) {
        setError(CONTACT_UNAVAILABLE_MESSAGE);
        return;
      }
      setSuccess(true);
      setName("");
      setEmail("");
      setSubject("");
      setMessage("");
    } catch (err) {
      const status = err instanceof ApiError ? err.status : 0;
      const messageText = err instanceof Error ? err.message : undefined;
      setError(friendlyContactError(status, messageText));
    } finally {
      setSubmitting(false);
    }
  }

  if (success) {
    return (
      <div className="rounded-2xl border border-emerald-200 bg-white p-8 shadow-card">
        <h3 className="text-lg font-semibold text-slate-900">Message sent</h3>
        <p className="mt-2 text-sm leading-relaxed text-slate-600">
          Your note reached the Comment2DM team. We will reply to the email you
          provided when we can. There is no live chat or 24-hour SLA during beta.
        </p>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-2xl border border-slate-200/80 bg-white p-8 shadow-card space-y-5"
    >
      <div>
        <h3 className="text-lg font-semibold text-slate-900">Send a message</h3>
        <p className="mt-2 text-sm leading-relaxed text-slate-600">
          This form emails the Comment2DM team. Success appears only after the
          server confirms delivery.
        </p>
      </div>
      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}
      <Input
        label="Name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        required
      />
      <Input
        label="Email"
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required
      />
      <Input
        label="Subject"
        value={subject}
        onChange={(e) => setSubject(e.target.value)}
        required
      />
      <label className="block">
        <span className="mb-1.5 block text-sm font-medium text-slate-700">Message</span>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          required
          rows={6}
          className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none ring-brand-500/20 focus:border-brand-500 focus:ring-4"
        />
      </label>
      <Button type="submit" className="w-full" size="lg" disabled={submitting}>
        {submitting ? "Sending..." : "Send message"}
      </Button>
    </form>
  );
}
