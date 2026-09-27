import dotenv from 'dotenv';
import { SecretProvider } from './services/secretProvider.service.js';

dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || '3000', 10),
  get nodeEnv() {
    return process.env.NODE_ENV || 'development';
  },
  get mockMode() {
    return SecretProvider.get('MOCK_MODE', 'true') !== 'false';
  },

  firebase: {
    get projectId() { return SecretProvider.get('FIREBASE_PROJECT_ID'); },
    get clientEmail() { return SecretProvider.get('FIREBASE_CLIENT_EMAIL'); },
    get privateKey() { return SecretProvider.get('FIREBASE_PRIVATE_KEY'); },
    get databaseId() { return SecretProvider.get('FIRESTORE_DATABASE_ID', '(default)'); },
  },

  gologin: {
    get apiToken() { return SecretProvider.get('GOLOGIN_API_TOKEN'); },
    get apiUrl() { return SecretProvider.get('GOLOGIN_API_URL', 'https://api.gologin.com'); },
    get cloudBrowserUrl() { return SecretProvider.get('GOLOGIN_CLOUD_URL', 'https://cloudbrowser.gologin.com'); },
  },

  telegram: {
    get botToken() { return SecretProvider.get('TELEGRAM_BOT_TOKEN'); },
    get defaultChatId() { return SecretProvider.get('TELEGRAM_DEFAULT_CHAT_ID'); },
  },

  microsoftGraph: {
    get tenantId() { return SecretProvider.get('AZURE_TENANT_ID'); },
    get clientId() { return SecretProvider.get('AZURE_CLIENT_ID'); },
    get clientSecret() { return SecretProvider.get('AZURE_CLIENT_SECRET'); },
    get authorizedMailbox() { return SecretProvider.get('AUTHORIZED_OUTLOOK_MAILBOX', 'operator-checkpoint@domain.com'); },
  },

  googleSheets: {
    get spreadsheetId() { return SecretProvider.get('GOOGLE_SHEETS_SPREADSHEET_ID'); },
    get clientEmail() { return SecretProvider.get('GOOGLE_SERVICE_ACCOUNT'); },
    get privateKey() { return SecretProvider.get('GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY'); },
  },

  persistence: {
    get mode(): 'firestore' | 'firestore-emulator' | 'in-memory' {
      const explicit = (process.env.PERSISTENCE_MODE || '').trim().toLowerCase();
      if (explicit === 'memory' || explicit === 'in-memory' || explicit === 'in_memory') {
        return 'in-memory';
      }
      if (explicit === 'firestore-emulator' || explicit === 'emulator') {
        return 'firestore-emulator';
      }
      if (explicit === 'firestore') {
        return 'firestore';
      }
      // If no explicit PERSISTENCE_MODE set:
      if (process.env.NODE_ENV === 'test') {
        return 'in-memory';
      }
      if (process.env.FIRESTORE_EMULATOR_HOST) {
        return 'firestore-emulator';
      }
      // In production, default to canonical firestore
      if (process.env.NODE_ENV === 'production') {
        return 'firestore';
      }
      // In development / preview, if Firestore credentials exist, use firestore; otherwise default to in-memory
      if (
        (process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY) ||
        process.env.GOOGLE_APPLICATION_CREDENTIALS
      ) {
        return 'firestore';
      }
      return 'in-memory';
    },
    get isExplicit(): boolean {
      return Boolean(process.env.PERSISTENCE_MODE);
    },
    get emulatorHost(): string | undefined {
      return process.env.FIRESTORE_EMULATOR_HOST;
    },
  },

  get jwtSecret() {
    return SecretProvider.get('JWT_SECRET', 'dev-super-secret-jwt-key-change-in-production');
  },
};

