// Zapit's brand mark — a bold ring with a pinched inner waist. Used
// everywhere the wordmark lockup appears (NavBar, privacy/terms headers)
// and is the same shape rasterized for the app/PWA icons — see
// frontend/scripts/generate-icons.mjs. Uses currentColor so the existing
// `className="text-primary"` usage pattern keeps working exactly like the
// lucide-react <Infinity> icon it replaces.
export function ZapitMark({ className, strokeWidth = 9 }: { className?: string; strokeWidth?: number }) {
  return (
    <svg
      viewBox="0 0 100 100"
      width={24}
      height={24}
      className={className}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M 32 50
           C 32 39, 41 30, 52 30
           C 63 30, 72 39, 72 50
           C 72 61, 63 70, 52 70
           C 44 70, 37 65, 34 58
           M 68 50
           C 68 39, 59 30, 48 30
           C 37 30, 28 39, 28 50
           C 28 61, 37 70, 48 70
           C 56 70, 63 65, 66 58"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
