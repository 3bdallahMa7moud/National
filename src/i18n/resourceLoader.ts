import type { Language, Namespace } from './constants';

export async function importNamespaceResources(
  language: Language,
  namespace: Namespace,
): Promise<Record<string, unknown>> {
  const module = await import(`./locales/${language}/${namespace}.json`);
  return module.default as Record<string, unknown>;
}
