import React, { useState } from 'react';
import {
  CheckSquare,
  AlertTriangle,
  Mail,
  ShieldCheck,
  Camera,
  Fingerprint,
  Phone,
  Clock,
  Bell,
  User,
  ExternalLink,
  CheckCircle2,
  RefreshCw,
  Search,
  UserCheck,
} from 'lucide-react';
import { HumanTask, Operator } from '../types';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { MetricTile } from '../components/ui/MetricTile';
import { EmptyState } from '../components/ui/EmptyState';

interface HumanTasksPageProps {
  humanTasks: HumanTask[];
  operators: Operator[];
  onRefresh: () => void;
  onOpenTask: (task: HumanTask) => void;
  onRemindTask: (taskId: string) => Promise<void>;
  onAssignTask: (taskId: string, operatorId: string) => Promise<void>;
  onSelectJob: (jobId: string) => void;
}

export const HumanTasksPage: React.FC<HumanTasksPageProps> = ({
  humanTasks,
  operators,
  onRefresh,
  onOpenTask,
  onRemindTask,
  onAssignTask,
  onSelectJob,
}) => {
  const [statusFilter, setStatusFilter] = useState<'OPEN_ONLY' | 'ALL'>('OPEN_ONLY');
  const [searchTerm, setSearchTerm] = useState('');
  const [remindingId, setRemindingId] = useState<string | null>(null);

  const openTasks = humanTasks.filter(
    (t) => t.status === 'OPEN' || t.status === 'ASSIGNED' || t.status === 'IN_PROGRESS'
  );
  const criticalCount = openTasks.filter((t) => t.priority === 'CRITICAL').length;
  const completedCount = humanTasks.filter((t) => t.status === 'COMPLETED').length;

  const filteredTasks = humanTasks.filter((t) => {
    if (statusFilter === 'OPEN_ONLY') {
      if (t.status !== 'OPEN' && t.status !== 'ASSIGNED' && t.status !== 'IN_PROGRESS') return false;
    }
    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      const shop = (t as any).shopName || '';
      const typeStr = t.taskType || (t as any).type || '';
      const match =
        t.humanTaskId.toLowerCase().includes(q) ||
        shop.toLowerCase().includes(q) ||
        t.jobId.toLowerCase().includes(q) ||
        typeStr.toLowerCase().includes(q) ||
        t.title.toLowerCase().includes(q);
      if (!match) return false;
    }
    return true;
  });

  const handleRemind = async (taskId: string) => {
    setRemindingId(taskId);
    try {
      await onRemindTask(taskId);
    } finally {
      setRemindingId(null);
    }
  };

  const getTaskIcon = (type: string) => {
    switch (type) {
      case 'EMAIL_OTP':
        return <Mail className="w-4 h-4 text-blue-600" />;
      case 'IDENTITY_VERIFICATION':
        return <ShieldCheck className="w-4 h-4 text-indigo-600" />;
      case 'SELFIE':
        return <Camera className="w-4 h-4 text-purple-600" />;
      case 'BIOMETRIC':
        return <Fingerprint className="w-4 h-4 text-emerald-600" />;
      case 'PHONE_VERIFICATION':
        return <Phone className="w-4 h-4 text-amber-600" />;
      default:
        return <AlertTriangle className="w-4 h-4 text-orange-600" />;
    }
  };

  return (
    <div className="space-y-4">
      {/* Metric summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <MetricTile
          label="Pending Interventions"
          value={openTasks.length}
          sublabel="Immediate action required"
          indicatorVariant={openTasks.length > 0 ? 'warning' : 'neutral'}
          contextIndicator={openTasks.length > 0 ? 'Action Queue' : undefined}
          icon={<AlertTriangle className="w-4 h-4 text-amber-500" />}
        />

        <MetricTile
          label="Critical Priority"
          value={criticalCount}
          sublabel="SLA < 10m remaining"
          indicatorVariant={criticalCount > 0 ? 'danger' : 'neutral'}
          icon={<Clock className="w-4 h-4 text-rose-500" />}
        />

        <MetricTile
          label="Completed Today"
          value={completedCount}
          sublabel="Successfully verified"
          indicatorVariant="success"
          icon={<CheckCircle2 className="w-4 h-4 text-emerald-500" />}
        />

        <MetricTile
          label="Total Historical"
          value={humanTasks.length}
          sublabel="All checkpoints recorded"
          icon={<CheckSquare className="w-4 h-4 text-slate-400" />}
        />
      </div>

      {/* Header & Controls */}
      <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-2xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-amber-500 text-white">
            <CheckSquare className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold text-slate-900 tracking-tight">
                Human Checkpoint & Intervention Queue
              </h2>
              <span className="px-2 py-0.5 rounded-sm bg-amber-100 text-amber-900 font-mono text-[11px] font-bold border border-amber-300">
                {openTasks.length} Pending
              </span>
            </div>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Operator interventions for 2FA OTP codes, ID documents, selfie face match, and phone verification
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search shop, ID..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-8 pr-2.5 py-1 text-xs border border-slate-200 rounded-lg bg-slate-50/50 focus:outline-none focus:bg-white text-xs"
            />
          </div>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="px-2.5 py-1.5 border border-slate-200 rounded-lg bg-white text-xs text-slate-700 focus:outline-none"
          >
            <option value="OPEN_ONLY">Pending Action Required ({openTasks.length})</option>
            <option value="ALL">All Tasks History ({humanTasks.length})</option>
          </select>

          <Button
            variant="secondary"
            size="sm"
            onClick={onRefresh}
            leftIcon={<RefreshCw className="w-3.5 h-3.5 text-slate-500" />}
          >
            Refresh
          </Button>
        </div>
      </div>

      {/* Main Checkpoint List / Table */}
      <div className="bg-white rounded-xl border border-slate-200/80 shadow-2xs overflow-hidden">
        {filteredTasks.length === 0 ? (
          <EmptyState
            icon={CheckSquare}
            title="No Human Checkpoints Found"
            description={
              statusFilter === 'OPEN_ONLY'
                ? 'All automated jobs are currently proceeding normally without requiring manual operator intervention.'
                : 'No historical human checkpoints exist in the system.'
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-[11px] font-semibold text-slate-600 border-b border-slate-200">
                <tr>
                  <th className="py-2.5 px-3">Priority</th>
                  <th className="py-2.5 px-3">Shop Name</th>
                  <th className="py-2.5 px-3">Checkpoint Type</th>
                  <th className="py-2.5 px-3">Job ID</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3">Assigned Operator</th>
                  <th className="py-2.5 px-3">Elapsed Time</th>
                  <th className="py-2.5 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-sans text-xs">
                {filteredTasks.map((task) => {
                  const assignedOp = operators.find((o) => o.operatorId === task.assignedOperatorId);
                  const isCompleted = task.status === 'COMPLETED';

                  return (
                    <tr
                      key={task.humanTaskId}
                      className={`hover:bg-slate-50/70 transition-colors ${
                        !isCompleted ? 'bg-amber-50/15' : ''
                      }`}
                    >
                      <td className="py-2.5 px-3">
                        <Badge
                          variant={task.priority === 'CRITICAL' ? 'danger' : 'warning'}
                          size="xs"
                          dot
                        >
                          {task.priority}
                        </Badge>
                      </td>

                      <td className="py-2.5 px-3 font-semibold text-slate-900">
                        {(task as any).shopName || task.title || task.jobId}
                      </td>

                      <td className="py-2.5 px-3">
                        <div className="flex items-center gap-1.5 font-medium text-slate-700">
                          {getTaskIcon(task.taskType || (task as any).type)}
                          <span>{(task.taskType || (task as any).type || 'MANUAL_REVIEW').replace(/_/g, ' ')}</span>
                        </div>
                      </td>

                      <td className="py-2.5 px-3 font-mono text-[11px] text-slate-600">
                        <button
                          onClick={() => onSelectJob(task.jobId)}
                          className="hover:underline hover:text-blue-600 font-medium"
                        >
                          {task.jobId}
                        </button>
                      </td>

                      <td className="py-2.5 px-3">
                        <Badge
                          variant={isCompleted ? 'success' : task.status === 'IN_PROGRESS' ? 'info' : 'warning'}
                          size="xs"
                        >
                          {task.status}
                        </Badge>
                      </td>

                      <td className="py-2.5 px-3">
                        <select
                          value={task.assignedOperatorId || ''}
                          onChange={(e) => onAssignTask(task.humanTaskId, e.target.value)}
                          className="px-2 py-1 text-[11px] border border-slate-200 rounded-md bg-white focus:outline-none max-w-[140px]"
                        >
                          <option value="">Unassigned</option>
                          {operators.map((op) => (
                            <option key={op.operatorId} value={op.operatorId}>
                              {op.name}
                            </option>
                          ))}
                        </select>
                      </td>

                      <td className="py-2.5 px-3 font-mono text-[11px] text-slate-500 whitespace-nowrap">
                        {new Date(task.createdAt).toLocaleTimeString()}
                      </td>

                      <td className="py-2.5 px-3 text-right whitespace-nowrap space-x-1.5">
                        {!isCompleted ? (
                          <>
                            <Button
                              variant="primary"
                              size="xs"
                              onClick={() => onOpenTask(task)}
                            >
                              Take Task
                            </Button>
                            <Button
                              variant="secondary"
                              size="xs"
                              loading={remindingId === task.humanTaskId}
                              onClick={() => handleRemind(task.humanTaskId)}
                              title="Send reminder to Telegram"
                            >
                              Remind
                            </Button>
                          </>
                        ) : (
                          <Button
                            variant="ghost"
                            size="xs"
                            onClick={() => onOpenTask(task)}
                          >
                            View
                          </Button>
                        )}

                        <Button
                          variant="ghost"
                          size="xs"
                          onClick={() => onSelectJob(task.jobId)}
                          rightIcon={<ExternalLink className="w-3 h-3" />}
                        >
                          Job
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
