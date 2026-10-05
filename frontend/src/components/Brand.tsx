/**
 * Agilzi brand lockup: geometric Λ mark (currentColor legs, amber
 * momentum bar) + Fraunces wordmark. Single owner for every brand
 * surface (sidebar, auth panels, mobile headers) so the identity
 * cannot drift screen by screen.
 */
export default function Brand({
  markSize = 28,
  wordmark = true,
  onDark = false,
  wordmarkSize = 16,
}: {
  markSize?: number;
  wordmark?: boolean;
  onDark?: boolean;
  wordmarkSize?: number;
}) {
  return (
    <span className="inline-flex items-center gap-2.5">
      <img
        src="/logo.svg"
        alt=""
        aria-hidden="true"
        width={markSize}
        height={markSize}
        draggable={false}
        className={`shrink-0 ${onDark ? 'text-white' : 'text-slate-800 dark:text-slate-100'}`}
      />
      {wordmark && (
        <span
          className={`font-display font-semibold tracking-tight leading-none ${onDark ? 'text-white' : 'text-gray-800 dark:text-slate-100'}`}
          style={{ fontSize: wordmarkSize }}
        >
          Agilzi
        </span>
      )}
    </span>
  );
}
