import { initializeApp, getApps, getApp, cert, applicationDefault } from 'firebase-admin/app';
import { getFirestore, Firestore, FieldValue, Timestamp } from 'firebase-admin/firestore';
import { config } from '../config.js';
import { logger } from '../utils/logger.js';
import { FirestoreUnavailableError } from './errors.js';

let firestoreInstance: Firestore | null = null;
let isInitialized = false;
let initError: Error | null = null;

/**
 * Initialize Firestore Admin connection
 */
export function initFirestore(): Firestore | null {
  if (isInitialized && firestoreInstance) {
    return firestoreInstance;
  }

  // If already attempted and failed in production
  if (initError && process.env.NODE_ENV === 'production') {
    throw new FirestoreUnavailableError(`Firestore failed initialization: ${initError.message}`);
  }

  try {
    const projectId = config.firebase.projectId || process.env.FIREBASE_PROJECT_ID || process.env.GCLOUD_PROJECT;
    const clientEmail = config.firebase.clientEmail || process.env.FIREBASE_CLIENT_EMAIL;
    const privateKeyRaw = config.firebase.privateKey || process.env.FIREBASE_PRIVATE_KEY;
    const databaseId = config.firebase.databaseId || process.env.FIRESTORE_DATABASE_ID || '(default)';
    const emulatorHost = process.env.FIRESTORE_EMULATOR_HOST;

    let app;
    const existingApps = getApps();

    if (existingApps.length === 0) {
      if (emulatorHost) {
        logger.info('FirestoreInit', `Connecting to Firestore Emulator at ${emulatorHost} (Project: ${projectId || 'demo-project'})`);
        app = initializeApp({
          projectId: projectId || 'demo-project',
        });
      } else if (projectId && clientEmail && privateKeyRaw) {
        logger.info('FirestoreInit', `Initializing Firebase Admin with Service Account for project '${projectId}'`);
        const privateKey = privateKeyRaw.replace(/\\n/g, '\n');
        app = initializeApp({
          credential: cert({
            projectId,
            clientEmail,
            privateKey,
          }),
          projectId,
        });
      } else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
        logger.info('FirestoreInit', `Initializing Firebase Admin using GOOGLE_APPLICATION_CREDENTIALS (Project: ${projectId || 'default'})`);
        app = initializeApp({
          credential: applicationDefault(),
          projectId: projectId || undefined,
        });
      } else if (process.env.NODE_ENV === 'production') {
        logger.info('FirestoreInit', `Initializing Firebase Admin using Application Default Credentials (Project: ${projectId || 'default'})`);
        app = initializeApp({
          credential: applicationDefault(),
          projectId: projectId || undefined,
        });
      } else {
        const msg = 'Missing explicit Firestore credentials (FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY) and no FIRESTORE_EMULATOR_HOST configured.';
        throw new FirestoreUnavailableError(msg);
      }
    } else {
      app = existingApps[0];
    }

    firestoreInstance = databaseId && databaseId !== '(default)'
      ? getFirestore(app, databaseId)
      : getFirestore(app);

    // Apply standard Firestore settings
    firestoreInstance.settings({
      ignoreUndefinedProperties: true,
    });

    isInitialized = true;
    logger.info('FirestoreInit', `Firestore successfully connected (Database: ${databaseId})`);
    return firestoreInstance;
  } catch (err: any) {
    initError = err;
    logger.error('FirestoreInit', `Failed to initialize Firestore: ${err?.message || err}`);
    throw new FirestoreUnavailableError(`Firestore connection error: ${err.message}`);
  }
}

/**
 * Get the active Firestore instance. Throws FirestoreUnavailableError in production if not connected.
 */
export function getFirestoreDb(): Firestore {
  if (!firestoreInstance) {
    const db = initFirestore();
    if (!db) {
      throw new FirestoreUnavailableError('Firestore instance is not available. Ensure Firestore credentials or emulator are configured.');
    }
    return db;
  }
  return firestoreInstance;
}

/**
 * Health check probe for Firestore
 */
export async function checkFirestoreHealth(): Promise<{
  status: 'HEALTHY' | 'UNAVAILABLE';
  latencyMs?: number;
  databaseId?: string;
  error?: string;
}> {
  const start = Date.now();
  try {
    const db = getFirestoreDb();
    // Perform a lightweight probe to the system_settings collection
    await db.collection('system_settings').doc('current').get();
    return {
      status: 'HEALTHY',
      latencyMs: Date.now() - start,
      databaseId: config.firebase.databaseId || '(default)',
    };
  } catch (err: any) {
    return {
      status: 'UNAVAILABLE',
      latencyMs: Date.now() - start,
      error: err.message,
    };
  }
}

export { FieldValue, Timestamp };
