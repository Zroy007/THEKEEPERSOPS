import dotenv from 'dotenv';
import { SecretMetadata } from '../types.js';
import { logger } from '../utils/logger.js';

dotenv.config();

interface SecretEntry {
  key: string;
  description: string;
  category: string;
  value: string;
  lastUpdated?: string;
  updatedBy?: string;
}

class SecretProviderService {
  private secrets: Map<string, SecretEntry> = new Map();
  private isGoogleSecretManagerAvailable: boolean = false;

  constructor() {
    this.initializeSecrets();
  }

  private initializeSecrets() {
    const definitions: Array<{ key: string; description: string; category: string; envFallback: string }> = [
      { key: 'MOCK_MODE', description: 'Enable simulated execution without live external API calls', category: 'SYSTEM', envFallback: process.env.MOCK_MODE || 'true' },
      { key: 'JWT_SECRET', description: 'HMAC-SHA256 signature secret for authentication tokens', category: 'SECURITY', envFallback: process.env.JWT_SECRET || 'dev-super-secret-jwt-key-2026' },
      { key: 'FIREBASE_PROJECT_ID', description: 'GCP / Firebase Project Identifier', category: 'FIREBASE', envFallback: process.env.FIREBASE_PROJECT_ID || process.env.GCP_PROJECT_ID || '' },
      { key: 'FIREBASE_CLIENT_EMAIL', description: 'Service Account email for Firebase / Firestore SDK', category: 'FIREBASE', envFallback: process.env.FIREBASE_CLIENT_EMAIL || '' },
      { key: 'FIREBASE_PRIVATE_KEY', description: 'RSA Private Key for Firebase Service Account', category: 'FIREBASE', envFallback: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n') || '' },
      { key: 'FIRESTORE_DATABASE_ID', description: 'Target Firestore Database ID', category: 'FIREBASE', envFallback: process.env.FIRESTORE_DATABASE_ID || '(default)' },
      { key: 'GOLOGIN_API_TOKEN', description: 'Authentication bearer token for GoLogin cloud browser API', category: 'GOLOGIN', envFallback: process.env.GOLOGIN_API_TOKEN || '' },
      { key: 'GOLOGIN_API_URL', description: 'GoLogin REST API base endpoint', category: 'GOLOGIN', envFallback: process.env.GOLOGIN_API_URL || 'https://api.gologin.com' },
      { key: 'GOLOGIN_CLOUD_URL', description: 'GoLogin Cloud Web Browser container endpoint', category: 'GOLOGIN', envFallback: process.env.GOLOGIN_CLOUD_URL || 'https://cloudbrowser.gologin.com' },
      { key: 'TELEGRAM_BOT_TOKEN', description: 'Telegram Bot token from @BotFather for alerts & OTP reminders', category: 'TELEGRAM', envFallback: process.env.TELEGRAM_BOT_TOKEN || '' },
      { key: 'TELEGRAM_DEFAULT_CHAT_ID', description: 'Default Telegram group or channel chat ID for operations', category: 'TELEGRAM', envFallback: process.env.TELEGRAM_DEFAULT_CHAT_ID || '' },
      { key: 'AZURE_TENANT_ID', description: 'Microsoft Entra / Azure Active Directory Directory (tenant) ID', category: 'MICROSOFT', envFallback: process.env.AZURE_TENANT_ID || '' },
      { key: 'AZURE_CLIENT_ID', description: 'Microsoft Entra Application (client) ID', category: 'MICROSOFT', envFallback: process.env.AZURE_CLIENT_ID || '' },
      { key: 'AZURE_CLIENT_SECRET', description: 'Microsoft Entra Application client secret key', category: 'MICROSOFT', envFallback: process.env.AZURE_CLIENT_SECRET || '' },
      { key: 'AUTHORIZED_OUTLOOK_MAILBOX', description: 'Dedicated operator mailbox for manual email OTP verification', category: 'MICROSOFT', envFallback: process.env.AUTHORIZED_OUTLOOK_MAILBOX || 'operator-checkpoint@domain.com' },
      { key: 'GOOGLE_SHEETS_SPREADSHEET_ID', description: 'Target Google Spreadsheet ID for master queue sync', category: 'GOOGLE_SHEETS', envFallback: process.env.GOOGLE_SHEETS_SPREADSHEET_ID || '' },
      { key: 'GOOGLE_SERVICE_ACCOUNT', description: 'Google Cloud Service Account Email with Sheets API permissions', category: 'GOOGLE_SHEETS', envFallback: process.env.GOOGLE_SERVICE_ACCOUNT || process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || '' },
      { key: 'GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY', description: 'Google Service Account Private Key for Sheets API', category: 'GOOGLE_SHEETS', envFallback: process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY || process.env.GOOGLE_SERVICE_ACCOUNT_KEY?.replace(/\\n/g, '\n') || '' },
    ];

    for (const def of definitions) {
      const hasValue = Boolean(def.envFallback && def.envFallback.trim().length > 0);
      this.secrets.set(def.key, {
        key: def.key,
        description: def.description,
        category: def.category,
        value: def.envFallback || '',
        lastUpdated: hasValue ? new Date().toISOString() : undefined,
        updatedBy: hasValue ? 'SYSTEM_ENV' : undefined,
      });
    }

    logger.info('SecretProvider', 'SecretProvider initialized with centralized credentials management');
  }

  /**
   * Retrieves secret value securely server-side.
   * NEVER expose this return value to client APIs or logs.
   */
  public get(key: string, defaultValue: string = ''): string {
    const entry = this.secrets.get(key);
    if (!entry || !entry.value) {
      // Fallback to process.env if available
      return process.env[key] || defaultValue;
    }
    return entry.value;
  }

  /**
   * Checks if a secret is configured with a non-empty value.
   */
  public isConfigured(key: string): boolean {
    const val = this.get(key);
    return Boolean(val && val.trim().length > 0);
  }

  /**
   * Sets or updates a secret securely.
   */
  public async set(key: string, value: string, actor: string = 'SUPERADMIN'): Promise<void> {
    const existing = this.secrets.get(key);
    const description = existing?.description || `Secret ${key}`;
    const category = existing?.category || 'CUSTOM';

    this.secrets.set(key, {
      key,
      description,
      category,
      value,
      lastUpdated: new Date().toISOString(),
      updatedBy: actor,
    });

    // Also update runtime process.env for third-party libraries if needed
    process.env[key] = value;
    logger.info('SecretProvider', `Secret updated successfully: ${key} by ${actor}`);
  }

  /**
   * Clears a secret value.
   */
  public async clear(key: string, actor: string = 'SUPERADMIN'): Promise<void> {
    const existing = this.secrets.get(key);
    if (existing) {
      existing.value = '';
      existing.lastUpdated = new Date().toISOString();
      existing.updatedBy = actor;
    }
    delete process.env[key];
    logger.info('SecretProvider', `Secret cleared: ${key} by ${actor}`);
  }

  /**
   * Returns safe metadata for all secrets.
   * Explicitly masks values (e.g. "********") and NEVER leaks the plaintext.
   */
  public getMetadata(): SecretMetadata[] {
    const results: SecretMetadata[] = [];
    for (const [key, entry] of this.secrets.entries()) {
      const isConfigured = Boolean(entry.value && entry.value.trim().length > 0);
      results.push({
        key,
        description: entry.description,
        category: entry.category,
        configured: isConfigured,
        isConfigured: isConfigured,
        lastUpdated: entry.lastUpdated,
        updatedBy: entry.updatedBy,
        maskedValue: isConfigured ? '••••••••••••••••' : 'NOT_CONFIGURED',
        status: isConfigured ? 'CONFIGURED' : 'NOT_CONFIGURED',
      } as any);
    }
    return results;
  }
}

export const SecretProvider = new SecretProviderService();
