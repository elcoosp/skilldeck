// src/components/ui/streaming-pulse.tsx
export function StreamingPulse({ className }: { className?: string }) {
  return (
    <span className={`relative flex h-3 w-3 ${className ?? ''}`}>
      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary/30 opacity-75" />
      <span className="relative inline-flex h-3 w-3 rounded-full bg-primary/70" />
    </span>
  );
}
