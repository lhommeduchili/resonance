"use client";

export function SimulationFallback({
  title,
  message,
  actionLabel,
  onRetry,
}: {
  title: string;
  message: string;
  actionLabel: string;
  onRetry: () => void;
}) {
  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/70">
      <div className="max-w-md border border-accent bg-black/80 p-6 text-center font-mono text-xs uppercase tracking-widest text-foreground">
        <p className="mb-2 text-accent">{title}</p>
        <p className="mb-4 text-[10px] opacity-70">{message}</p>
        <button
          onClick={onRetry}
          className="border border-foreground px-4 py-2 transition-colors hover:bg-foreground hover:text-black"
        >
          {actionLabel}
        </button>
      </div>
    </div>
  );
}
