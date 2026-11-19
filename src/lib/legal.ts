/**
 * Dados da empresa usados nas páginas legais (Privacidade, Termos, Exclusão de dados).
 * Fonte única: preencha aqui e todas as páginas são atualizadas.
 * Enquanto houver campo com "[preencher", as páginas mostram um aviso de rascunho.
 */
export const LEGAL = {
  /** Razão social da empresa responsável pela ScaleX. */
  company: "[preencher: razão social]",
  /** CNPJ no formato 00.000.000/0000-00. */
  cnpj: "[preencher: CNPJ]",
  /** Cidade/UF da sede, usada também no foro. */
  city: "[preencher: cidade/UF]",
  /** E-mail para pedidos de privacidade e exclusão de dados (LGPD). */
  privacyEmail: "[preencher: e-mail de privacidade]",
  /** Nome do encarregado de dados (DPO). Pode ser um dos sócios. */
  dpo: "[preencher: nome do encarregado]",
  /** Data da versão vigente dos documentos. */
  updatedAt: "19 de novembro de 2026",
  site: "https://scale-x-kkn5.vercel.app",
  brand: "ScaleX",
} as const;

export const LEGAL_IS_DRAFT = Object.values(LEGAL).some((v) => v.startsWith("[preencher"));

export const LEGAL_PAGES = [
  { href: "/privacidade", label: "Política de Privacidade" },
  { href: "/termos", label: "Termos de Uso" },
  { href: "/exclusao-de-dados", label: "Exclusão de dados" },
] as const;
