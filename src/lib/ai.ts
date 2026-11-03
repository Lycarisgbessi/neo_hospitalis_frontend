import { GoogleGenerativeAI } from '@google/generative-ai';

// ── Fournisseurs IA partagés (assistant vocal + dictée médicale) ───────────────
// Fournisseur principal : GLM (Zhipu AI) via OpenRouter.
// Fournisseur de secours : Google Gemini (si sa clé est présente).
// NOTE sécurité : la clé est exposée côté client (application sans backend).
// N'utilisez qu'une clé dédiée à la démo, avec quota restreint.
const openRouterKey = (import.meta.env.VITE_OPENROUTER_API_KEY ?? '') as string;
const geminiKey = (import.meta.env.VITE_GEMINI_API_KEY ?? '') as string;

/** Modèle OpenRouter utilisé (GLM par défaut, surchargeable via .env). */
export const AI_MODEL = ((import.meta.env.VITE_AI_MODEL ?? '') as string) || 'z-ai/glm-4.6';

/**
 * Modèle de repli si le modèle principal échoue (crédits épuisés 402, limite
 * de débit 429, modèle indisponible...). Gratuit et performant pour la
 * structuration médicale — le démonstrateur reste fonctionnel sans crédits.
 */
export const AI_FALLBACK_MODEL =
  ((import.meta.env.VITE_AI_FALLBACK_MODEL ?? '') as string) || 'nvidia/nemotron-3-ultra-550b-a55b:free';

export type AiProvider = 'openrouter' | 'gemini' | null;

/** OpenRouter prioritaire ; Gemini en secours ; null si rien n'est configuré. */
export function getActiveProvider(): AiProvider {
  if (openRouterKey.length > 10 && !openRouterKey.includes('VOTRE')) return 'openrouter';
  if (
    geminiKey.length > 10 &&
    !geminiKey.includes('VOTRE') &&
    !geminiKey.includes('REMPLACEZ')
  ) {
    return 'gemini';
  }
  return null;
}

export const isAiConfigured = getActiveProvider() !== null;

export function getProviderLabel(): string {
  const provider = getActiveProvider();
  if (provider === 'openrouter') return `GLM (${AI_MODEL}) via OpenRouter`;
  if (provider === 'gemini') return 'Google Gemini';
  return 'Aucun fournisseur IA configuré';
}


/** Appel chat/completions OpenRouter pour un modèle donné. Lance en cas d'échec. */
async function openRouterChat(model: string, prompt: string): Promise<string> {
  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${openRouterKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': window.location.origin,
      'X-Title': 'Hospitalis',
    },
    body: JSON.stringify({
      model,
      temperature: 0.1,
      messages: [{ role: 'user', content: prompt }],
    }),
  });
  if (!res.ok) {
    const detail = (await res.text()).slice(0, 200);
    throw new Error(`OpenRouter (${model}) HTTP ${res.status} : ${detail}`);
  }
  const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error(`Réponse OpenRouter (${model}) vide (pas de contenu).`);
  return content;
}

/**
 * Génère une réponse texte pour un prompt donné, via le fournisseur actif.
 * OpenRouter : modèle principal (GLM) puis repli gratuit automatique en cas
 * d'échec (crédits, rate-limit, indisponibilité).
 */
export async function generateText(prompt: string): Promise<string> {
  const provider = getActiveProvider();

  if (provider === 'openrouter') {
    try {
      return await openRouterChat(AI_MODEL, prompt);
    } catch (primaryError) {
      if (AI_FALLBACK_MODEL && AI_FALLBACK_MODEL !== AI_MODEL) {
        console.warn('[IA] Modèle principal en échec, repli automatique :', AI_FALLBACK_MODEL, primaryError instanceof Error ? primaryError.message : primaryError);
        return await openRouterChat(AI_FALLBACK_MODEL, prompt);
      }
      throw primaryError;
    }
  }

  if (provider === 'gemini') {
    const genAI = new GoogleGenerativeAI(geminiKey);
    const result = await genAI.getGenerativeModel({ model: 'gemini-2.0-flash' }).generateContent(prompt);
    return result.response.text();
  }

  throw new Error('Aucun fournisseur IA configuré. Renseignez VITE_OPENROUTER_API_KEY (recommandé) ou VITE_GEMINI_API_KEY dans le fichier .env.');
}

/** Extrait le premier objet JSON d'une réponse IA, même entourée de markdown. */
export function extractJsonObject(raw: string): Record<string, unknown> | null {
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    return JSON.parse(match[0]) as Record<string, unknown>;
  } catch {
    return null;
  }
}
