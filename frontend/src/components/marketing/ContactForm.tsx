"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { useToast } from "@/components/providers/ToastProvider";

export function ContactForm() {
  const toast = useToast();
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    await new Promise((r) => setTimeout(r, 800));
    toast.success("Message sent! We'll get back to you within 24 hours.");
    setLoading(false);
    (e.target as HTMLFormElement).reset();
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-2xl border border-slate-200/80 bg-white p-8 shadow-card"
    >
      <div className="space-y-4">
        <Input label="Name" name="name" placeholder="Your name" required />
        <Input
          label="Email"
          name="email"
          type="email"
          placeholder="you@example.com"
          required
        />
        <Input label="Subject" name="subject" placeholder="How can we help?" required />
        <Textarea
          label="Message"
          name="message"
          placeholder="Tell us more..."
          rows={5}
          required
        />
      </div>
      <Button type="submit" className="mt-6 w-full" disabled={loading} size="lg">
        {loading ? "Sending..." : "Send Message"}
      </Button>
    </form>
  );
}
