/**
 * Dados do responsável pela ScaleX usados nas páginas legais (Privacidade, Termos, Exclusão de dados).
 * Fonte única: altere aqui e todas as páginas são atualizadas.
 * Hoje o controlador é uma pessoa física; quando houver CNPJ, preencha `company` com a razão social e `cnpj`.
 */
export const LEGAL = {
  /** Responsável legal (pessoa física) enquanto não houver CNPJ. */
  company: "Arthur Pereira Antunes dos Santos",
  /**
   * Razão social prevista para quando o CNPJ for aberto. Só passa a aparecer como empresa
   * nos documentos depois que `cnpj` for preenchido (antes disso não existe pessoa jurídica).
   */
  plannedCompany: "ScaleX",
  /** CNPJ no formato 00.000.000/0000-00. Vazio enquanto a empresa não for aberta. */
  cnpj: "",
  /** Cidade/UF do domicílio ou da sede, usada também no foro. */
  city: "São José do Rio Preto/SP",
  /** E-mail para pedidos de privacidade e exclusão de dados (LGPD). */
  privacyEmail: "darkcoode.io@gmail.com",
  /** Encarregado pelo tratamento de dados (DPO). */
  dpo: "Arthur Pereira Antunes dos Santos",
  /** Data da versão vigente dos documentos. */
  updatedAt: "19 de novembro de 2026",
  site: "https://scale-x-kkn5.vercel.app",
  brand: "ScaleX",
} as const;

/** Como o responsável é identificado nos documentos: pessoa jurídica (com CNPJ) ou pessoa física. */
export const LEGAL_IDENTITY = LEGAL.cnpj
  ? `${LEGAL.plannedCompany}, CNPJ ${LEGAL.cnpj}, com sede em ${LEGAL.city}`
  : `${LEGAL.company}, pessoa física, com domicílio em ${LEGAL.city}, responsável pela marca ${LEGAL.brand}`;

export const LEGAL_IS_DRAFT = Object.values(LEGAL).some((v) => v.startsWith("[preencher"));

export const LEGAL_PAGES = [
  { href: "/privacidade", label: "Política de Privacidade" },
  { href: "/termos", label: "Termos de Uso" },
  { href: "/exclusao-de-dados", label: "Exclusão de dados" },
] as const;
