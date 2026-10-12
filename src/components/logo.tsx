/** Two offset sheets — a paste — drawn with the current text color. */
export function Logo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      <rect x="4" y="3" width="12" height="15" rx="2.5" stroke="currentColor" strokeWidth="1.75" />
      <path d="M9 21h8.5A2.5 2.5 0 0 0 20 18.5V8" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
      <path d="M8 8h4M8 11.5h4" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
    </svg>
  );
}
