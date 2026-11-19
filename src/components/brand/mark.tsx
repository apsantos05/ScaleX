/**
 * Marca ScaleX — conceito "Lâmina": duas lâminas cruzadas formando o X.
 * Fonte única da geometria, usada no app (Logo), no favicon e nas imagens geradas (ícone/OG).
 */
export const BRAND = {
  red: "#FF3045",
  white: "#F5F5F7",
  tile: "#0B0B0D",
  tileStroke: "#26262C",
  black: "#050506",
} as const;

/** Geometria padrão (≥ 24px). */
export const BLADE_RED = "M12 12L36 28L52 52L28 36Z";
export const BLADE_WHITE = "M52 12L36 36L12 52L28 28Z";
/** Geometria compacta: lâminas mais longas para continuar legível em 16–32px. */
export const BLADE_RED_SMALL = "M9 9L37 27L55 55L27 37Z";
export const BLADE_WHITE_SMALL = "M55 9L37 37L9 55L27 27Z";

export function BladeMark({
  size = 28,
  compact = size < 24,
  framed = true,
  title,
  className,
}: {
  size?: number;
  /** Usa a geometria compacta (padrão automático abaixo de 24px). */
  compact?: boolean;
  /** Quadro escuro ao redor das lâminas. */
  framed?: boolean;
  title?: string;
  className?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      className={className}
      role={title ? "img" : undefined}
      aria-hidden={title ? undefined : true}
      aria-label={title}
    >
      {framed && <rect x="0.5" y="0.5" width="63" height="63" rx="7" fill={BRAND.tile} stroke={BRAND.tileStroke} />}
      <path d={compact ? BLADE_RED_SMALL : BLADE_RED} fill={BRAND.red} />
      <path d={compact ? BLADE_WHITE_SMALL : BLADE_WHITE} fill={BRAND.white} />
    </svg>
  );
}
