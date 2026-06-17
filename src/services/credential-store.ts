import { constants as fsConstants } from 'node:fs';
import { access, mkdir, readFile, rm, writeFile, chmod } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { homedir } from 'node:os';
import type { AuthSession } from './auth-session.js';

export interface CredentialStore {
  read(): Promise<AuthSession | null>;
  write(session: AuthSession): Promise<void>;
  clear(): Promise<void>;
}

export function defaultTokenStorePath(): string {
  return join(homedir(), '.parsely', 'session.json');
}

function isAuthSession(value: unknown): value is AuthSession {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as Partial<AuthSession>;
  return typeof candidate.apiBaseUrl === 'string' &&
    typeof candidate.accessToken === 'string' &&
    typeof candidate.createdAt === 'number' &&
    typeof candidate.updatedAt === 'number';
}

export class FileCredentialStore implements CredentialStore {
  constructor(private readonly filePath = defaultTokenStorePath()) {}

  async read(): Promise<AuthSession | null> {
    try {
      const raw = await readFile(this.filePath, 'utf8');
      const parsed: unknown = JSON.parse(raw);
      return isAuthSession(parsed) ? parsed : null;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return null;
      }
      throw error;
    }
  }

  async write(session: AuthSession): Promise<void> {
    await mkdir(dirname(this.filePath), { recursive: true, mode: 0o700 });
    await writeFile(this.filePath, `${JSON.stringify(session, null, 2)}\n`, {
      encoding: 'utf8',
      mode: 0o600,
    });
    await chmod(this.filePath, 0o600);
  }

  async clear(): Promise<void> {
    await rm(this.filePath, { force: true });
  }
}

export class MemoryCredentialStore implements CredentialStore {
  private session: AuthSession | null = null;

  async read(): Promise<AuthSession | null> {
    return this.session;
  }

  async write(session: AuthSession): Promise<void> {
    this.session = session;
  }

  async clear(): Promise<void> {
    this.session = null;
  }
}

export async function tokenStoreExists(filePath = defaultTokenStorePath()): Promise<boolean> {
  try {
    await access(filePath, fsConstants.F_OK);
    return true;
  } catch {
    return false;
  }
}
