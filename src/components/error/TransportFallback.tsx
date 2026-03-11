"use client";

export function TransportFallback({
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
    <div className="flex min-h-screen w-full items-center justify-center bg-black p-6">
      <div className="max-w-lg border border-accent bg-black/60 p-8 text-center font-mono text-xs uppercase tracking-widest text-foreground">
        <p className="mb-2 text-accent">{title}</p>
        <p className="mb-6 text-[10px] opacity-70">{message}</p>
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
