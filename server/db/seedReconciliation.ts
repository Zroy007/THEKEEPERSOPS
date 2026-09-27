import { getFirestoreDb } from './firestore.js';
import {
  initialJobs,
  initialSessions,
  initialHumanTasks,
  initialOperators,
  initialSettings,
  initialRetryPolicies,
  initialApplicationAttempts,
  initialAuditLogs,
  initialIntegrations,
  initialUserAccounts,
} from './seed.js';
import { INITIAL_ROLE_DEFINITIONS, authService } from '../services/auth.service.js';
import crypto from 'crypto';
import { logger } from '../utils/logger.js';
import { SystemSettings, SettingVersion } from '../types.js';

export async function reconcileFirestoreSeed(): Promise<void> {
  const db = getFirestoreDb();
  logger.info('Persistence', 'Running idempotent Firestore seed reconciliation...');

  // 1. Reconcile System Settings
  const settingsDocRef = db.collection('system_settings').doc('current');
  const settingsDoc = await settingsDocRef.get();
  if (!settingsDoc.exists) {
    logger.info('Persistence', 'Initializing default system settings in Firestore...');
    const settingsData: SystemSettings = {
      ...initialSettings,
      updatedAt: new Date().toISOString(),
      updatedBy: 'SYSTEM_BOOTSTRAP',
    };
    await settingsDocRef.set(settingsData);

    const versionId = 'VER-BOOTSTRAP-001';
    const initVersion: SettingVersion = {
      versionId,
      version: 1,
      settingKey: 'concurrencyLimit',
      oldValue: null,
      newValue: initialSettings.concurrencyLimit,
      changedBy: 'SYSTEM_BOOTSTRAP',
      changedAt: new Date().toISOString(),
      changeType: 'UPDATE',
    };
    await db.collection('settings_history').doc(versionId).set(initVersion);
  }

  // 2. Reconcile Roles
  for (const role of INITIAL_ROLE_DEFINITIONS) {
    const roleRef = db.collection('roles').doc(role.roleId);
    const existing = await roleRef.get();
    if (!existing.exists) {
      await roleRef.set({
        ...role,
        updatedAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
      });
    }
  }

  // 3. Reconcile Bootstrap Superadmin Account
  const bootstrapPassword =
    process.env.BOOTSTRAP_SUPERADMIN_PASSWORD ||
    process.env.SUPERADMIN_INITIAL_PASSWORD ||
    (crypto.randomBytes(16).toString('hex') + '!Aa1');
  const { hash: bootstrapHash, salt: bootstrapSalt } = authService.hashPassword(bootstrapPassword);

  for (const acc of initialUserAccounts) {
    const userRef = db.collection('user_accounts').doc(acc.uid);
    const existing = await userRef.get();
    if (!existing.exists) {
      if (acc.role === 'SUPERADMIN') {
        await userRef.set({
          ...acc,
          passwordHash: bootstrapHash,
          passwordSalt: bootstrapSalt,
          mustChangePassword: true,
          failedLoginAttempts: 0,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
      } else {
        const opPassword = process.env.INITIAL_OPERATOR_PASSWORD || (crypto.randomBytes(16).toString('hex') + '!Aa1');
        const { hash, salt } = authService.hashPassword(opPassword);
        await userRef.set({
          ...acc,
          passwordHash: hash,
          passwordSalt: salt,
          mustChangePassword: false,
          failedLoginAttempts: 0,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
      }
    }
    // Note: If user exists, we NEVER overwrite passwordHash or salt!
  }

  // 4. Reconcile Retry Policies
  for (const policy of initialRetryPolicies) {
    const policyRef = db.collection('retry_policies').doc(policy.policyId);
    const existing = await policyRef.get();
    if (!existing.exists) {
      await policyRef.set(policy);
    }
  }

  // 5. Reconcile Operators
  for (const op of initialOperators) {
    const opRef = db.collection('operators').doc(op.operatorId);
    const existing = await opRef.get();
    if (!existing.exists) {
      await opRef.set(op);
    }
  }

  // 6. Reconcile Integrations Status
  for (const intg of initialIntegrations) {
    const intgRef = db.collection('integration_status').doc(intg.id);
    const existing = await intgRef.get();
    if (!existing.exists) {
      await intgRef.set({
        ...intg,
        lastChecked: new Date().toISOString(),
      });
    }
  }

  // 7. Seed sample jobs and attempts if collection is empty
  const jobsSnapshot = await db.collection('jobs').limit(1).get();
  if (jobsSnapshot.empty) {
    logger.info('Persistence', 'Seeding baseline jobs and application attempts into Firestore...');
    const batch = db.batch();

    for (const job of initialJobs) {
      const jRef = db.collection('jobs').doc(job.jobId);
      batch.set(jRef, job);
    }

    for (const attempt of initialApplicationAttempts) {
      const aRef = db.collection('application_attempts').doc(attempt.attemptId);
      batch.set(aRef, attempt);
    }

    for (const session of initialSessions) {
      const sRef = db.collection('sessions').doc(session.sessionId);
      batch.set(sRef, session);
    }

    for (const task of initialHumanTasks) {
      const tRef = db.collection('human_tasks').doc(task.humanTaskId);
      batch.set(tRef, task);
    }

    await batch.commit();
  }

  logger.info('Persistence', 'Firestore seed reconciliation completed successfully.');
}
