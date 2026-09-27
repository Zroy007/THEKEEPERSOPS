import React, { useState } from 'react';
import {
  Bell,
  Send,
  CheckCircle2,
  AlertTriangle,
  ShieldCheck,
  Info,
  XCircle,
  ExternalLink,
  Check,
  Filter,
  Radio,
  Lock,
} from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { MetricTile } from '../components/ui/MetricTile';
import { EmptyState } from '../components/ui/EmptyState';

interface NotificationsPageProps {
  notifications: any[];
  onTestNotification: (message: string) => Promise<void>;
  onSelectJob?: (jobId: string) => void;
}

export const NotificationsPage: React.FC<NotificationsPageProps> = ({
  notifications,
  onTestNotification,
  onSelectJob,
}) => {
  const [testMessage, setTestMessage] = useState('🚨 Test alert from Browser Workflow Operations Platform');
  const [sending, setSending] = useState(false);
  const [sentSuccess, setSentSuccess] = useState(false);
  const [filterType, setFilterType] = useState<string>('ALL');
  const [readIds, setReadIds] = useState<Set<string>>(new Set());

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!testMessage) return;

    setSending(true);
    try {
      await onTestNotification(testMessage);
      setSentSuccess(true);
      setTimeout(() => setSentSuccess(false), 3500);
    } finally {
      setSending(false);
    }
  };

  const markAllRead = () => {
    const all = new Set(notifications.map((n) => n.id || String(n.timestamp)));
    setReadIds(all);
  };

  const toggleRead = (id: string) => {
    const next = new Set(readIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setReadIds(next);
  };

  const filteredNotifications = notifications.filter((n) => {
    if (filterType === 'ALL') return true;
    if (filterType === 'ACTION_REQUIRED') {
      return n.message?.toLowerCase().includes('otp') || n.message?.toLowerCase().includes('action') || n.message?.toLowerCase().includes('checkpoint');
    }
    if (filterType === 'ERRORS') {
      return n.message?.toLowerCase().includes('error') || n.message?.toLowerCase().includes('failed');
    }
    if (filterType === 'SUCCESS') {
      return n.message?.toLowerCase().includes('approved') || n.message?.toLowerCase().includes('success') || n.message?.toLowerCase().includes('submitted');
    }
    return true;
  });

  return (
    <div className="space-y-4">
      {/* 1. TELEGRAM NOTIFICATION MANAGEMENT STATUS (Section 18) */}
      <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-2xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
          <div>
            <div className="flex items-center gap-2">
              <Bell className="w-4 h-4 text-sky-600" />
              <h2 className="text-sm font-bold text-slate-900 tracking-tight">
                Telegram Notification Management
              </h2>
              <Badge variant="success" size="xs" dot>
                Connected
              </Badge>
            </div>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Secure dispatch engine for real-time 2FA OTP challenges, verification escalation, and operator paging
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[11px] font-mono text-slate-500 bg-slate-50 border border-slate-200 px-2 py-1 rounded-md">
              Bot Token: <strong className="text-emerald-700">Configured</strong>
            </span>
            <span className="text-[11px] font-mono text-slate-500 bg-slate-50 border border-slate-200 px-2 py-1 rounded-md">
              Default Chat: <strong className="text-slate-800">Configured</strong>
            </span>
          </div>
        </div>

        {/* Test Alert Dispatcher */}
        <div className="pt-3">
          <form onSubmit={handleSend} className="flex gap-2">
            <input
              type="text"
              value={testMessage}
              onChange={(e) => setTestMessage(e.target.value)}
              placeholder="Enter test alert payload..."
              className="flex-1 px-3 py-1.5 text-xs border border-slate-200 rounded-lg bg-slate-50/50 focus:outline-none focus:bg-white focus:border-slate-300"
            />
            <Button
              type="submit"
              variant="primary"
              size="sm"
              loading={sending}
              leftIcon={<Send className="w-3.5 h-3.5" />}
            >
              Test Notification
            </Button>
          </form>

          {sentSuccess && (
            <div className="text-xs text-emerald-700 font-medium mt-2 flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              Test alert successfully delivered via Telegram Bot service.
            </div>
          )}
        </div>
      </div>

      {/* 2. NOTIFICATION FEED & CONTROLS (Section 17) */}
      <div className="bg-white rounded-xl border border-slate-200/80 shadow-2xs overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/50">
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setFilterType('ALL')}
                className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                  filterType === 'ALL' ? 'bg-slate-900 text-white font-semibold' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                All ({notifications.length})
              </button>
              <button
                onClick={() => setFilterType('ACTION_REQUIRED')}
                className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                  filterType === 'ACTION_REQUIRED' ? 'bg-amber-600 text-white font-semibold' : 'text-amber-800 hover:text-amber-950'
                }`}
              >
                Action Required
              </button>
              <button
                onClick={() => setFilterType('ERRORS')}
                className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                  filterType === 'ERRORS' ? 'bg-rose-600 text-white font-semibold' : 'text-rose-700 hover:text-rose-900'
                }`}
              >
                Errors
              </button>
              <button
                onClick={() => setFilterType('SUCCESS')}
                className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                  filterType === 'SUCCESS' ? 'bg-emerald-600 text-white font-semibold' : 'text-emerald-700 hover:text-emerald-900'
                }`}
              >
                Success
              </button>
            </div>
          </div>

          <Button
            variant="ghost"
            size="xs"
            onClick={markAllRead}
            leftIcon={<Check className="w-3.5 h-3.5 text-slate-500" />}
          >
            Mark All as Read
          </Button>
        </div>

        {/* Notifications stream */}
        {filteredNotifications.length === 0 ? (
          <EmptyState
            icon={Bell}
            title="No Notifications in Feed"
            description="All notifications have been reviewed or none match the active category filter."
          />
        ) : (
          <div className="divide-y divide-slate-100">
            {filteredNotifications.map((n) => {
              const id = n.id || String(n.timestamp);
              const isRead = readIds.has(id);
              const isUrgent = n.message?.toLowerCase().includes('otp') || n.message?.toLowerCase().includes('action');

              return (
                <div
                  key={id}
                  className={`p-3.5 flex items-start justify-between gap-3 text-xs transition-colors ${
                    isRead ? 'bg-white opacity-70' : isUrgent ? 'bg-amber-50/20' : 'bg-slate-50/40'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 shrink-0">
                      {isUrgent ? (
                        <div className="p-1 rounded-md bg-amber-100 text-amber-700">
                          <AlertTriangle className="w-4 h-4" />
                        </div>
                      ) : (
                        <div className="p-1 rounded-md bg-blue-100 text-blue-700">
                          <Info className="w-4 h-4" />
                        </div>
                      )}
                    </div>

                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-slate-400 text-[11px]">
                          {new Date(n.timestamp).toLocaleTimeString()}
                        </span>
                        <span className="font-mono text-[11px] font-bold text-slate-700">
                          Chat ID: {n.chatId}
                        </span>
                        <span className="px-1.5 py-0.2 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold text-[10px]">
                          DELIVERED
                        </span>
                      </div>
                      <p className="text-xs text-slate-800 font-mono whitespace-pre-wrap">
                        {n.message}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <Button
                      variant="ghost"
                      size="xs"
                      onClick={() => toggleRead(id)}
                      title={isRead ? 'Mark as unread' : 'Mark as read'}
                    >
                      {isRead ? 'Unread' : 'Mark Read'}
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
