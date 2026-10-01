import { VIDEO_GUIDES } from "@/lib/video-guides";

const reels = [
  VIDEO_GUIDES.accountSetup,
  VIDEO_GUIDES.keywordTriggers,
  VIDEO_GUIDES.postReelTargeting,
  VIDEO_GUIDES.automaticDms,
  VIDEO_GUIDES.publicReplies,
  VIDEO_GUIDES.followToUnlock,
  VIDEO_GUIDES.analytics,
  VIDEO_GUIDES.activity,
  VIDEO_GUIDES.billing,
  VIDEO_GUIDES.keywordOnePostOrReel,
  VIDEO_GUIDES.keywordOneReelVoice,
  VIDEO_GUIDES.readKeywordRule,
];

export function HowItWorksSection() {
  return (
    <section id="how-it-works" className="relative overflow-hidden bg-[#f6f3ff] py-20 sm:py-28">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-20 top-24 h-44 w-44 rounded-full bg-[#8545ef]/15 blur-2xl" />
        <div className="absolute -right-20 bottom-20 h-52 w-52 rounded-full bg-[#6a2fd0]/20 blur-2xl" />
        <div className="absolute inset-x-0 bottom-0 h-52 claude-grid opacity-50" />
      </div>

      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="text-center">
          <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-[#8545ef]">
            How it works
          </p>
          <h2 className="mt-3 text-3xl font-extrabold tracking-[-0.035em] text-[#151c30] sm:text-5xl">
            Watch Comment2DM in action
          </h2>
        </div>

        <div className="mt-12 grid gap-7 sm:grid-cols-2 lg:grid-cols-3">
          {reels.map((reel, index) => (
            <div
              key={reel.src}
              className="claude-reel-card group relative overflow-hidden rounded-[26px] border-2 border-[#8545ef] bg-[#eee6ff] p-2 shadow-[0_8px_0_#4b1fa0,0_24px_50px_-22px_rgba(75,31,160,.55)]"
              style={{ animationDelay: `${index * 90}ms` }}
            >
              <video
                className="aspect-[9/16] w-full rounded-[20px] bg-[#f6f3ff] object-cover"
                autoPlay
                muted
                loop
                controls
                preload="metadata"
                playsInline
                aria-label={reel.title}
              >
                <source src={reel.src} type="video/mp4" />
                Your browser does not support video playback.
              </video>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
