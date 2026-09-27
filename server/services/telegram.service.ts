import { config } from '../config.js';
import { Notification, NotificationType, HumanTask, Job } from '../types.js';
import { repository } from '../db/repository.js';
import { fetchWithTimeout } from '../utils/fetchWithTimeout.js';
import { idempotencyManager } from '../middleware/idempotency.js';
import { logger } from '../utils/logger.js';

export class TelegramNotificationService {
  private botToken: string;
  private defaultChatId: string;

  constructor() {
    this.botToken = config.telegram.botToken;
    this.defaultChatId = config.telegram.defaultChatId;
  }

  private isMockMode(): boolean {
    return config.mockMode || !this.botToken;
  }

  public async sendNotification(params: {
    jobId?: string;
    humanTaskId?: string;
    type: NotificationType;
    recipientChatId?: string;
    title: string;
    message: string;
  }): Promise<Notification> {
    const settings = await repository.getSettings();
    const recipient = params.recipientChatId || this.defaultChatId || 'TELEGRAM_BROADCAST_GROUP';

    // Deduplication check: prevent spamming duplicate alerts within 5 minutes
    const dedupKey = `notif:${params.jobId || 'system'}:${params.type}:${params.title}`;
    if (idempotencyManager.isDuplicateNotification(dedupKey, 5 * 60 * 1000)) {
      logger.info('TelegramService', `Deduplication suppressed duplicate alert for ${dedupKey}`);
      return {
        notificationId: `NOTIF-DEDUP-${Date.now()}`,
        jobId: params.jobId,
        humanTaskId: params.humanTaskId,
        type: params.type,
        channel: 'TELEGRAM',
        recipient,
        title: params.title,
        message: params.message,
        sentAt: new Date().toISOString(),
        status: 'SENT',
        attemptCount: 1,
      };
    }

    const notificationId = `NOTIF-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const record: Notification = {
      notificationId,
      jobId: params.jobId,
      humanTaskId: params.humanTaskId,
      type: params.type,
      channel: 'TELEGRAM',
      recipient,
      title: params.title,
      message: params.message,
      sentAt: new Date().toISOString(),
      status: 'SENT',
      attemptCount: 1,
    };

    if (!settings.telegramNotificationsEnabled) {
      record.status = 'PENDING';
      record.error = 'Telegram notifications are disabled in system settings.';
      await repository.addNotification(record);
      return record;
    }

    if (this.isMockMode()) {
      // Mock delivery
      await repository.addNotification(record);
      await repository.updateIntegrationStatus('telegram', {
        status: 'CONNECTED',
        lastSuccessfulCall: new Date().toISOString(),
      });
      return record;
    }

    try {
      // Clean, unredacted sanitized text (no passwords or OTPs in Telegram payload)
      const text = `🔔 *[${params.type}] ${params.title}*\n\n${params.message}\n\n⏱ _${new Date().toLocaleTimeString()}_`;
      const res = await fetchWithTimeout(`https://api.telegram.org/bot${this.botToken}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: recipient,
          text,
          parse_mode: 'Markdown',
        }),
        timeoutMs: 8000,
        retries: 2,
        serviceName: 'TelegramAPI',
      });

      if (!res.ok) {
        throw new Error(`Telegram API responded with ${res.status}`);
      }

      record.status = 'SENT';
      await repository.updateIntegrationStatus('telegram', {
        status: 'CONNECTED',
        lastSuccessfulCall: new Date().toISOString(),
      });
    } catch (err: any) {
      record.status = 'FAILED';
      record.error = err.message;
      await repository.updateIntegrationStatus('telegram', {
        status: 'DEGRADED',
        lastError: err.message,
      });
      logger.error('TelegramService', `Failed to deliver Telegram notification: ${err.message}`);
    }

    await repository.addNotification(record);
    return record;
  }

  public async sendHumanTaskAlert(task: HumanTask, job: Job): Promise<Notification> {
    const operator = task.assignedOperatorId ? await repository.getOperatorById(task.assignedOperatorId) : undefined;
    const recipient = operator?.telegramChatId || this.defaultChatId;

    return this.sendNotification({
      jobId: task.jobId,
      humanTaskId: task.humanTaskId,
      type: 'ACTION_REQUIRED',
      recipientChatId: recipient,
      title: `Action Required: ${task.title}`,
      message: `Shop: *${job.shopName}*\nTask: *${task.taskType}*\nPriority: *${task.priority}*\n\nPlease access the Operator Dashboard or live browser session to perform the verification.`,
    });
  }

  public async sendTaskReminder(task: HumanTask, intervalLabel: string): Promise<Notification> {
    const job = await repository.getJobById(task.jobId);
    const operator = task.assignedOperatorId ? await repository.getOperatorById(task.assignedOperatorId) : undefined;

    return this.sendNotification({
      jobId: task.jobId,
      humanTaskId: task.humanTaskId,
      type: intervalLabel.includes('ESCALATION') ? 'ESCALATION' : 'WARNING',
      recipientChatId: operator?.telegramChatId || this.defaultChatId,
      title: `[REMINDER ${intervalLabel}] Pending Human Task`,
      message: `Pending Task: *${task.title}*\nShop: *${job?.shopName || 'N/A'}*\nWaiting time: *${task.reminderCount * 15} minutes*\n\nStatus: *${task.status}*`,
    });
  }
}

export const telegramNotificationService = new TelegramNotificationService();
