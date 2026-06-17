import {
  createEnvSession,
  refreshStoredSession,
  resolveRuntimeConfig,
  sessionIsExpired,
  type AuthSession,
  type EnvMap,
  type ParselyRuntimeConfig,
} from './auth-session.js';
import { FileCredentialStore, type CredentialStore } from './credential-store.js';

export class AuthService {
  constructor(
    private readonly store: CredentialStore,
    private readonly config: ParselyRuntimeConfig,
  ) {}

  static fromEnv(env: EnvMap = process.env): AuthService {
    const config = resolveRuntimeConfig(env);
    return new AuthService(
      new FileCredentialStore(config.tokenStorePath),
      config,
    );
  }

  async currentSession(): Promise<AuthSession | null> {
    const envSession = createEnvSession(this.config);
    if (envSession) {
      return envSession;
    }

    const stored = await this.store.read();
    if (!stored) {
      return null;
    }

    try {
      const refreshed = refreshStoredSession(stored, this.config);
      if (sessionIsExpired(refreshed)) {
        await this.store.clear();
        return null;
      }

      if (refreshed.expiresAt !== stored.expiresAt || refreshed.issuer !== stored.issuer) {
        await this.store.write(refreshed);
      }

      return refreshed;
    } catch {
      await this.store.clear();
      return null;
    }
  }

  async loginWithEnvironmentToken(now = Date.now()): Promise<AuthSession> {
    const session = createEnvSession(this.config, now);
    if (!session) {
      throw new Error('Set PARSELY_AUTH_TOKEN before running `parsely login`.');
    }

    await this.store.write(session);
    return session;
  }

  async logout(): Promise<void> {
    await this.store.clear();
  }
}
