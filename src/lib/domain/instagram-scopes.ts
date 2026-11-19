/**
 * Permissões do Instagram nos dois modos de login da Meta.
 * - Instagram Login (legado): instagram_business_content_publish / instagram_business_manage_insights
 * - Login unificado (apps novos): instagram_content_publish / instagram_manage_insights
 */
const PUBLISH = ["instagram_business_content_publish", "instagram_content_publish"];
const INSIGHTS = ["instagram_business_manage_insights", "instagram_manage_insights"];

export function canPublish(scopes: readonly string[]): boolean {
  return scopes.some((s) => PUBLISH.includes(s));
}

export function canReadInsights(scopes: readonly string[]): boolean {
  return scopes.some((s) => INSIGHTS.includes(s));
}
