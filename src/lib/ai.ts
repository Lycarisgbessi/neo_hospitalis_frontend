import { GoogleGenerativeAI } from '@google/generative-ai';

// ── Fournisseurs IA partagés (assistant vocal + dictée médicale) ───────────────
// Fournisseur principal : GLM (Zhipu AI) via OpenRouter.
// Fournisseur de secours : Google Gemini (si sa clé est présente).
// NOTE sécurité : la clé est exposée côté client (application sans backend).
// N'utilisez qu'une clé dédiée à la démo, avec quota restreint.
const openRouterKey = (import.meta.env.VITE_OPENROUTER_API_KEY ?? '') as string;
const geminiKey = (import.meta.env.VITE_GEMINI_API_KEY ?? '') as string;
const groqKey = (import.meta.env.VITE_GROQ_API_KEY ?? '') as string;

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

/**
 * Transcrit un audio enregistré (Blob) en texte.
 * PRIORITÉ 1 : Groq + Whisper large-v3-turbo (GRATUIT, ultra rapide)
 * PRIORITÉ 2 : OpenRouter avec modèles audio (si crédits disponibles)
 */
export async function transcribeAudio(audioBlob: Blob): Promise<string> {
  // ── PRIORITÉ 1 : GROQ (gratuit, Whisper large-v3-turbo) ──
  if (groqKey.length > 10) {
    try {
      console.log('[IA Audio] 🚀 Groq Whisper large-v3-turbo (gratuit)...');
      const formData = new FormData();
      formData.append('file', audioBlob, 'dictation.webm');
      formData.append('model', 'whisper-large-v3-turbo');
      formData.append('language', 'fr');
      formData.append('response_format', 'text');

      const res = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
        method: 'POST',
        headers: { Authorization: `Bearer ${groqKey}` },
        body: formData,
      });

      if (res.ok) {
        const text = await res.text();
        if (text.trim()) {
          console.log('[IA Audio] ✓ Groq transcription réussie:', text.slice(0, 100));
          return text.trim();
        }
      }
      console.warn('[IA Audio] Groq HTTP', res.status, (await res.text()).slice(0, 150));
    } catch (groqErr) {
      console.warn('[IA Audio] Groq erreur:', groqErr instanceof Error ? groqErr.message : groqErr);
    }
  }

  // ── PRIORITÉ 2 : OPENROUTER (si crédits) ──
  if (getActiveProvider()) {
    const base64Audio = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve((reader.result as string).split(',')[1]);
      reader.onerror = reject;
      reader.readAsDataURL(audioBlob);
    });

    const AUDIO_MODELS = [
      'openai/gpt-audio-mini',
      'google/gemini-3.5-flash-lite',
    ];

    for (const model of AUDIO_MODELS) {
      try {
        console.log('[IA Audio] Tentative OpenRouter:', model);
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
            messages: [{
              role: 'user',
              content: [
                { type: 'text', text: 'Transcris cet audio médical en français. Réponds UNIQUEMENT avec le texte transcrit.' },
                { type: 'input_audio', input_audio: { data: base64Audio, format: 'webm' } },
              ],
            }],
          }),
        });
        if (res.ok) {
          const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
          const content = data.choices?.[0]?.message?.content;
          if (content?.trim()) return content.trim();
        }
      } catch { continue; }
    }
  }

  throw new Error(
    'Transcription audio impossible. ' +
    (groqKey.length > 10
      ? 'Groq a échoué (vérifiez votre clé ou réessayez). '
      : 'Ajoutez une clé Groq gratuite sur https://console.groq.com (Whisper, 100% gratuit). ') +
    'Vous pouvez écouter l\'audio et taper le texte manuellement ci-dessous.'
  );
}
