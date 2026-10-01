import Link from "next/link";
import { ArrowRight, Play, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { audiences } from "@/lib/marketing-data";

export function HeroSection() {
  const promo =
    "Meta-approved · Instagram Business and Creator comment-to-DM automation is available through Meta's approved production permissions. · Follow @comment2DM on Instagram and get your first three months half price.";

  return (
    <section className="relative overflow-hidden bg-[#f6f3ff]">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-[7%] top-24 h-28 w-28 animate-claude-orbit rounded-full bg-gradient-to-br from-white via-[#d9c5ff] to-[#6a2fd0] opacity-70 blur-[1px]" />
        <div className="absolute right-[8%] top-20 h-16 w-16 animate-claude-float rounded-full bg-gradient-to-br from-white via-[#e8dcff] to-[#7a3fe0] opacity-80 shadow-[0_20px_45px_rgba(75,31,160,.24)]" />
        <div className="absolute bottom-14 right-[14%] h-36 w-36 animate-claude-float-slow rounded-full bg-[#4b1fa0] opacity-20 blur-[2px]" />
        <div className="absolute inset-x-0 bottom-0 h-44 claude-grid opacity-60" />
      </div>

      <div className="relative mx-auto max-w-7xl px-4 pb-16 pt-16 sm:px-6 sm:pb-20 sm:pt-24 lg:px-8">
        <div className="mx-auto max-w-5xl text-center">
          <div className="animate-fade-in inline-flex items-center gap-2 rounded-full border border-[#d8c8ff] bg-white/80 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.16em] text-[#6a2fd0] shadow-sm backdrop-blur">
            <Sparkles className="h-3.5 w-3.5" />
            Instagram DM automation
          </div>

          <div className="mt-8 overflow-hidden border-y border-[#d8c8ff] bg-white/65 py-3 backdrop-blur">
            <div className="claude-marquee whitespace-nowrap text-sm font-semibold text-[#4b1fa0] sm:text-base">
              <span className="mx-8">{promo}</span>
              <span className="mx-8" aria-hidden="true">{promo}</span>
            </div>
          </div>

          <h1 className="animate-slide-up mt-8 text-4xl font-extrabold tracking-[-0.045em] text-[#151c30] sm:text-6xl lg:text-7xl">
            Turn Instagram Comments Into{" "}
            <span className="text-[#6a2fd0]">Conversations Automatically</span>
          </h1>

          <p
            className="animate-slide-up mx-auto mt-7 max-w-2xl text-lg leading-relaxed text-[#5b6378] sm:text-xl"
            style={{ animationDelay: "0.1s" }}
          >
            Connect Instagram, choose a keyword, write your reply, and let Comment2DM handle matching comments automatically.
          </p>

          <div
            className="animate-slide-up mt-9 flex flex-wrap items-center justify-center gap-4"
            style={{ animationDelay: "0.2s" }}
          >
            <Link href="/register">
              <Button size="lg">
                Create Account
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <Link href="#how-it-works">
              <Button variant="secondary" size="lg">
                <Play className="h-4 w-4" />
                Watch Reels
              </Button>
            </Link>
          </div>

          <div
            className="animate-slide-up mt-10 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-[#6a7186]"
            style={{ animationDelay: "0.3s" }}
          >
            {audiences.map((audience) => (
              <span key={audience} className="font-medium">{audience}</span>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
