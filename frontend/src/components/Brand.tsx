/**
 * Lockup oficial do Agilizi: PNG por tema (logo-tema-claro / logo-tema-escuro),
 * alternado via classes dark:. Largura e altura sempre explícitas na proporção
 * 3.74:1 da arte — a imagem nunca estica, independente do container flex.
 */
const RATIO = 2021 / 540;

export default function Brand({ height = 28 }: { height?: number }) {
  const width = Math.round(height * RATIO);
  return (
    <span
      role="img"
      aria-label="Agilizi"
      className="inline-flex shrink-0 items-center"
      style={{ width, height }}
    >
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
    </span>
  );
}
