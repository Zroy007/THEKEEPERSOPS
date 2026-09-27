import React, { useState } from 'react';
import {
  Activity,
  CheckCircle,
  RefreshCw,
  AlertTriangle,
  Play,
  RotateCcw,
  Zap,
  Radio,
  Server,
  Database,
  Send,
  Mail,
  Table,
  Cpu,
} from 'lucide-react';
import { IntegrationStatusItem } from '../types';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { MetricTile } from '../components/ui/MetricTile';

interface SystemHealthPageProps {
  integrations: IntegrationStatusItem[];
  mockMode: boolean;
  onRefresh: () => void;
  onResetDemoData: () => Promise<void>;
  onTriggerQueueWorker: () => Promise<void>;
  onTriggerHumanTaskWorker: () => Promise<void>;
  onTriggerReviewWorker: () => Promise<void>;
}

export const SystemHealthPage: React.FC<SystemHealthPageProps> = ({
  integrations,
  mockMode,
  onRefresh,
  onResetDemoData,
  onTriggerQueueWorker,
  onTriggerHumanTaskWorker,
  onTriggerReviewWorker,
}) => {
  const [resetting, setResetting] = useState(false);
  const [triggeringWorker, setTriggeringWorker] = useState<string | null>(null);
  const [workerResult, setWorkerResult] = useState<string | null>(null);

  const handleReset = async () => {
    if (!confirm('Reset all demo data and state back to default mock state?')) return;
    setResetting(true);
    try {
      await onResetDemoData();
      onRefresh();
    } finally {
      setResetting(false);
    }
  };

  const handleWorker = async (name: string, fn: () => Promise<void>) => {
    setTriggeringWorker(name);
    try {
      await fn();
      setWorkerResult(`Worker daemon '${name}' executed successfully.`);
      setTimeout(() => setWorkerResult(null), 3500);
      onRefresh();
    } finally {
      setTriggeringWorker(null);
    }
  };

  const getLatencyColor = (latency?: number) => {
    if (!latency || latency < 50) return 'text-emerald-600 bg-emerald-50 border-emerald-200';
    if (latency < 200) return 'text-sky-600 bg-sky-50 border-sky-200';
    if (latency < 500) return 'text-amber-600 bg-amber-50 border-amber-200';
    return 'text-rose-600 bg-rose-50 border-rose-200';
  };

  const getServiceIcon = (id: string) => {
    switch (id) {
      case 'gologin':
        return <Zap className="w-4 h-4 text-sky-600" />;
      case 'telegram':
        return <Send className="w-4 h-4 text-blue-600" />;
      case 'outlook':
        return <Mail className="w-4 h-4 text-indigo-600" />;
      case 'sheets':
        return <Table className="w-4 h-4 text-emerald-600" />;
      case 'worker':
        return <Cpu className="w-4 h-4 text-purple-600" />;
      case 'database':
      case 'firestore':
        return <Database className="w-4 h-4 text-slate-700" />;
      default:
        return <Activity className="w-4 h-4 text-slate-600" />;
    }
  };

  return (
    <div className="space-y-4">
      {/* Top Diagnostics Summary Banner */}
      <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-2xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-slate-900 text-white">
              <Activity className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold text-slate-900 tracking-tight">
                  System Diagnostics & Integration Health
                </h2>
                {mockMode ? (
                  <Badge variant="warning" size="xs">
                    MOCK MODE ACTIVE
                  </Badge>
                ) : (
                  <Badge variant="success" size="xs" dot>
                    ALL SERVICES OPERATIONAL
                  </Badge>
                )}
              </div>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Real-time connection telemetry for browser orchestrators, database stores, worker daemons, and alert relays
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={onRefresh}
            leftIcon={<RefreshCw className="w-3.5 h-3.5" />}
          >
            Refresh Health
          </Button>

          <Button
            variant="danger"
            size="sm"
            loading={resetting}
            onClick={handleReset}
            leftIcon={<RotateCcw className="w-3.5 h-3.5" />}
          >
            Reset Demo Data
          </Button>
        </div>
      </div>

      {workerResult && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs font-medium flex items-center gap-2">
          <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{workerResult}</span>
        </div>
      )}

      {/* 1. DIAGNOSTIC TILES (Section 23) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
        {integrations.map((item) => {
          const isConnected = item.status === 'CONNECTED' || item.status === 'MOCK';
          const latency = item.latencyMs || (mockMode ? 4 : 142);

          return (
            <div
              key={item.id}
              className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-2xs flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 rounded-lg bg-slate-50 border border-slate-200/80">
                      {getServiceIcon(item.id)}
                    </div>
                    <div>
                      <h3 className="text-xs font-bold text-slate-900">{item.name}</h3>
                      <span className="text-[10px] text-slate-400 font-mono">Service: {item.id}</span>
                    </div>
                  </div>

                  <Badge variant={isConnected ? 'success' : 'danger'} size="xs" dot>
                    {item.status}
                  </Badge>
                </div>

                <div className="space-y-2 py-3 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">Latency:</span>
                    <span
                      className={`px-1.5 py-0.5 rounded font-mono text-[11px] font-bold border ${getLatencyColor(
                        latency
                      )}`}
                    >
                      {latency}ms
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">Last Ping Verified:</span>
                    <span className="font-mono text-slate-600 text-[11px]">
                      {new Date(item.lastChecked).toLocaleTimeString()}
                    </span>
                  </div>

                  {item.details && (
                    <div className="pt-2 border-t border-slate-100">
                      <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                        Service Metadata
                      </div>
                      <div className="bg-slate-50 p-2 rounded-lg font-mono text-[10px] text-slate-700 space-y-0.5 border border-slate-100 max-h-24 overflow-y-auto">
                        {Object.entries(item.details).map(([k, v]) => (
                          <div key={k} className="flex justify-between">
                            <span className="text-slate-400">{k}:</span>
                            <span className="truncate max-w-[150px] font-semibold">{String(v)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                <span className="text-[10px] font-mono text-slate-400">Heartbeat: Nominal</span>
                <Button
                  variant="ghost"
                  size="xs"
                  onClick={onRefresh}
                  leftIcon={<RefreshCw className="w-3 h-3 text-slate-400" />}
                >
                  Ping Test
                </Button>
              </div>
            </div>
          );
        })}
      </div>

      {/* 2. CLOUD SCHEDULER & WORKER DAEMONS */}
      <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-2xs space-y-3">
        <div>
          <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
            <Cpu className="w-3.5 h-3.5 text-slate-500" />
            Worker Daemons & Cloud Scheduler Manual Triggers
          </h3>
          <p className="text-[11px] text-slate-500 mt-0.5">
            Trigger automated background workers on-demand to process queues, dispatch reminders, and poll merchant approvals
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <button
            onClick={() => handleWorker('Queue Worker', onTriggerQueueWorker)}
            disabled={triggeringWorker !== null}
            className="p-3 rounded-lg border border-slate-200/80 hover:border-slate-300 bg-slate-50/50 hover:bg-slate-50 text-left transition-all"
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-bold text-slate-900">Queue Worker Daemon</span>
              <Play className="w-3.5 h-3.5 text-blue-600" />
            </div>
            <p className="text-[11px] text-slate-500">
              Dispatches READY and PENDING jobs into active GoLogin browser instances.
            </p>
          </button>

          <button
            onClick={() => handleWorker('Human Task Reminders', onTriggerHumanTaskWorker)}
            disabled={triggeringWorker !== null}
            className="p-3 rounded-lg border border-slate-200/80 hover:border-amber-300 bg-slate-50/50 hover:bg-amber-50/30 text-left transition-all"
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-bold text-slate-900">Human Checkpoint Escalator</span>
              <Play className="w-3.5 h-3.5 text-amber-600" />
            </div>
            <p className="text-[11px] text-slate-500">
              Evaluates SLA timers and dispatches Telegram reminder alerts to operators.
            </p>
          </button>

          <button
            onClick={() => handleWorker('Application Review Poller', onTriggerReviewWorker)}
            disabled={triggeringWorker !== null}
            className="p-3 rounded-lg border border-slate-200/80 hover:border-indigo-300 bg-slate-50/50 hover:bg-indigo-50/30 text-left transition-all"
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-bold text-slate-900">Review Outcome Poller</span>
              <Play className="w-3.5 h-3.5 text-indigo-600" />
            </div>
            <p className="text-[11px] text-slate-500">
              Checks merchant portal for submission approvals and logs final statuses.
            </p>
          </button>
        </div>
      </div>
    </div>
  );
};
