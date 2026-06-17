import { AuthService } from './auth-service.js';
import { resolveRuntimeConfig, type EnvMap } from './auth-session.js';
import { FileCredentialStore } from './credential-store.js';
import { ParselyApiClient } from './parsely-api.js';
import { ParselyRecipeRepository, type RecipeRepository } from './recipe-repository.js';

export async function createRecipeRepositoryFromEnv(env: EnvMap = process.env): Promise<RecipeRepository | null> {
  const config = resolveRuntimeConfig(env);
  const auth = new AuthService(
    new FileCredentialStore(config.tokenStorePath),
    config,
  );
  const session = await auth.currentSession();

  if (!session) {
    return null;
  }

  return new ParselyRecipeRepository(new ParselyApiClient({
    apiBaseUrl: session.apiBaseUrl,
    getAccessToken: () => session.accessToken,
    allowUnsafeTokenTarget: config.allowUnsafeTokenTarget,
  }));
}
