/**
 * Lockup oficial do Agilizi: PNG por tema (logo-tema-claro / logo-tema-escuro),
 * alternado via classes dark:. Largura e altura sempre explícitas na proporção
 * 3.74:1 da arte — a imagem nunca estica, independente do container flex.
 *
 * tone="onDark" força a arte clara (para fundos escuros fixos, como a lateral
 * de auth) independente do tema global.
 */
const RATIO = 2021 / 540;

export default function Brand({ height = 28, tone = 'auto' }: { height?: number; tone?: 'auto' | 'onDark' }) {
  const width = Math.round(height * RATIO);
  return (
    <span
      role="img"
      aria-label="Agilizi"
      className="inline-flex shrink-0 items-center"
      style={{ width, height }}
    >
      {tone === 'onDark' ? (
        <img
          src="/logo-tema-escuro.png"
          alt=""
          width={width}
          height={height}
          draggable={false}
          style={{ width, height }}
          className="block"
        />
      ) : (
        <>
          <img
            src="/logo-tema-claro.png"
            alt=""
            width={width}
            height={height}
            draggable={false}
            style={{ width, height }}
            className="block dark:hidden"
          />
          <img
            src="/logo-tema-escuro.png"
            alt=""
            width={width}
            height={height}
            draggable={false}
            style={{ width, height }}
            className="hidden dark:block"
          />
        </>
      )}
    </span>
  );
}
