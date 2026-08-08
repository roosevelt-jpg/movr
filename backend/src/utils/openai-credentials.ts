import { IntegrationsService } from '../services/integrations.service';
import { DatabaseService } from '../services/database.service';

let cachedKey: { value: string | null; at: number } | null = null;
let cachedModel: { value: string; at: number } | null = null;
const TTL_MS = 60_000;

/**
 * Resolve OpenAI API key from Integrations Hub, with env fallback.
 */
export async function resolveOpenAiApiKey(db?: DatabaseService): Promise<string | null> {
  if (cachedKey && Date.now() - cachedKey.at < TTL_MS) return cachedKey.value;
  let hub: string | null = null;
  try {
    const service = new IntegrationsService(db || new DatabaseService());
    hub =
      (await service.getCredential('openai', 'api_key')) ||
      (await service.getCredential('openai', 'OPENAI_API_KEY')) ||
      null;
  } catch {
    hub = null;
  }
  const value = hub || process.env.OPENAI_API_KEY || null;
  cachedKey = { value, at: Date.now() };
  return value;
}

export async function resolveOpenAiModel(db?: DatabaseService): Promise<string> {
  if (cachedModel && Date.now() - cachedModel.at < TTL_MS) return cachedModel.value;
  let hub: string | null = null;
  try {
    const service = new IntegrationsService(db || new DatabaseService());
    hub =
      (await service.getCredential('openai', 'model')) ||
      (await service.getCredential('openai', 'OPENAI_MODEL')) ||
      null;
  } catch {
    hub = null;
  }
  const value = hub || process.env.OPENAI_MODEL || 'gpt-4o-mini';
  cachedModel = { value, at: Date.now() };
  return value;
}

export function clearOpenAiCredentialCache() {
  cachedKey = null;
  cachedModel = null;
}
