import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert';
import { authService } from '../server/services/auth.service.js';
import { SecretProvider } from '../server/services/secretProvider.service.js';
import { repository } from '../server/db/repository.js';
import { UserAccount } from '../server/types.js';

describe('SUPERADMIN, RBAC & Secret Management Layer', () => {
  beforeEach(async () => {
    // Ensure clean state
    await repository.resetDemoData();
  });

  test('Bootstrap SuperAdmin account exists and requires password change on first login', async () => {
    const admin = await repository.getUserAccountByEmail('zakwanrhmn@gmail.com', true);
    assert.ok(admin, 'Bootstrap super admin account should exist');
    assert.strictEqual(admin.role, 'SUPERADMIN');
    assert.strictEqual(admin.mustChangePassword, true, 'Bootstrap account must require password change');
    assert.ok(admin.passwordHash, 'Password must be hashed with scrypt');
    assert.ok(admin.passwordSalt, 'Password salt must exist');
    assert.notStrictEqual(admin.passwordHash, 'zakwanrhmn@gmail.com', 'Password hash must never equal raw email');
  });

  test('Password verification correctly succeeds with valid password and fails with invalid password', () => {
    const { hash, salt } = authService.hashPassword('MySecurePass123!');
    const isValid = authService.verifyPassword('MySecurePass123!', hash, salt);
    assert.strictEqual(isValid, true, 'Valid password must verify');

    const isInvalid = authService.verifyPassword('WrongPass999!', hash, salt);
    assert.strictEqual(isInvalid, false, 'Invalid password must be rejected');
  });

  test('Password complexity validator enforces minimum 8 chars, numbers, and symbols', () => {
    assert.strictEqual(authService.validatePasswordStrength('short').valid, false);
    assert.strictEqual(authService.validatePasswordStrength('alllowercaseonly').valid, false);
    assert.strictEqual(authService.validatePasswordStrength('NoSpecialOrNumber').valid, false);
    assert.strictEqual(authService.validatePasswordStrength('StrongP@ssw0rd!').valid, true);
  });

  test('Safe account queries sanitize and never leak passwordHash or passwordSalt', async () => {
    const users = await repository.getUserAccounts();
    for (const u of users) {
      assert.strictEqual((u as any).passwordHash, undefined, 'passwordHash must not leak');
      assert.strictEqual((u as any).passwordSalt, undefined, 'passwordSalt must not leak');
    }
  });

  test('Prevent demoting or disabling the last active SUPERADMIN', async () => {
    const admin = await repository.getUserAccountByEmail('zakwanrhmn@gmail.com', true);
    assert.ok(admin);

    // Attempt to change role to OPERATOR
    const demoted: UserAccount = { ...admin, role: 'OPERATOR' };
    await assert.rejects(
      async () => await repository.saveUserAccount(demoted, 'TEST_ACTOR'),
      /Cannot demote, disable, or lock the last remaining active Super Admin/
    );

    // Attempt to disable account
    const disabled: UserAccount = { ...admin, status: 'DISABLED' };
    await assert.rejects(
      async () => await repository.saveUserAccount(disabled, 'TEST_ACTOR'),
      /Cannot demote, disable, or lock the last remaining active Super Admin/
    );
  });

  test('Prevent deleting the last active SUPERADMIN', async () => {
    const admin = await repository.getUserAccountByEmail('zakwanrhmn@gmail.com');
    assert.ok(admin);

    await assert.rejects(
      async () => await repository.deleteUserAccount(admin.uid, 'TEST_ACTOR'),
      /Cannot delete the last remaining active Super Admin/
    );
  });

  test('Prevent deleting system roles or roles with active assigned users', async () => {
    // 1. Attempt deleting system role
    await assert.rejects(
      async () => await repository.deleteRole('ROLE-SUPERADMIN', 'TEST_ACTOR'),
      /protected and cannot be deleted/
    );

    // 2. Create custom non-system role and assign active user
    await repository.saveRole({
      roleId: 'ROLE-CUSTOM-TEST',
      name: 'Custom Auditor',
      role: 'AUDITOR' as any,
      description: 'Test role',
      isSystem: false,
      permissions: ['jobs.view'],
      status: 'ACTIVE',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    await repository.saveUserAccount({
      uid: 'USR-TEST-AUDITOR',
      email: 'auditor@test.com',
      name: 'Test Auditor',
      role: 'AUDITOR' as any,
      status: 'ACTIVE',
      mustChangePassword: false,
      failedLoginAttempts: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    // Attempt deleting non-system role when active user is assigned
    await assert.rejects(
      async () => await repository.deleteRole('ROLE-CUSTOM-TEST', 'TEST_ACTOR'),
      /because \d+ active user\(s\) are assigned/
    );
  });

  test('Centralized SecretProvider returns masked metadata without leaking secret plaintext', () => {
    SecretProvider.set('TEST_SECRET_KEY', 'SensitiveValue12345!', 'SUPERADMIN');
    const metadata = SecretProvider.getMetadata();
    const item = metadata.find((m) => m.key === 'TEST_SECRET_KEY');

    assert.ok(item, 'Secret metadata must exist');
    assert.strictEqual(item.configured, true);
    assert.ok(item.maskedValue.includes('•••'), 'Masked value must hide secret text');
    assert.strictEqual((item as any).value, undefined, 'Value property must not be present in metadata');
  });

  test('Settings updates track version history and support rollback', async () => {
    const initial = (await repository.getSettings()).concurrencyLimit;
    // Update setting
    await repository.updateSettings({ concurrencyLimit: 25 }, 'SUPERADMIN');

    const updated = await repository.getSettings();
    assert.strictEqual(updated.concurrencyLimit, 25);

    const history = await repository.getSettingsVersions();
    const versionEntry = history.find((h) => h.settingKey === 'concurrencyLimit' && h.newValue === 25);
    assert.ok(versionEntry, 'Version history entry must be recorded');

    // Rollback setting
    const rollbackRes = await repository.rollbackSetting(versionEntry.versionId, 'SUPERADMIN');
    assert.strictEqual(rollbackRes.concurrencyLimit, initial);

    const rolledBack = await repository.getSettings();
    assert.strictEqual(rolledBack.concurrencyLimit, initial, 'Setting must be restored to initial value');
  });
});
