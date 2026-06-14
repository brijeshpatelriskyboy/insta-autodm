interface LogoProps {
  size?: "sm" | "md" | "lg";
  showText?: boolean;
  variant?: "light" | "dark";
}

const sizes = {
  sm: "h-8 w-8",
  md: "h-9 w-9",
  lg: "h-11 w-11",
};

const textSizes = {
  sm: "text-base",
  md: "text-lg",
  lg: "text-xl",
};

export function Logo({ size = "md", showText = true, variant = "dark" }: LogoProps) {
  return (
    <div className="flex items-center gap-3">
      <div
        className={`flex ${sizes[size]} items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 via-accent-500 to-brand-600 shadow-sm`}
      >
        <svg viewBox="0 0 24 24" className="h-1/2 w-1/2 text-white" fill="currentColor">
          <path d="M12 2C8.5 2 6 4.2 6 7.2c0 2.2 1.2 3.8 3 5.1V17a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2v-4.7c1.8-1.3 3-2.9 3-5.1C18 4.2 15.5 2 12 2zm0 2c2.2 0 3.5 1.4 3.5 3.2 0 1.4-.8 2.5-2.2 3.5l-.8.6V17h-1v-5.7l-.8-.6C8.3 9.7 7.5 8.6 7.5 7.2 7.5 5.4 8.8 4 12 4z" />
        </svg>
      </div>
      {showText && (
        <div>
          <p
            className={`font-semibold tracking-tight ${textSizes[size]} ${
              variant === "light" ? "text-white" : "text-slate-900"
            }`}
          >
            Insta AutoDM
          </p>
          {size !== "sm" && (
            <p
              className={`text-xs ${
                variant === "light" ? "text-slate-400" : "text-slate-500"
              }`}
            >
              DM Automation
            </p>
          )}
        </div>
      )}
    </div>
  );
}
