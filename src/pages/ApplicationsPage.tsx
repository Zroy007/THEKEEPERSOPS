import React, { useState } from 'react';
import { Award, RotateCcw, AlertTriangle, CheckCircle, ExternalLink, Calendar, User } from 'lucide-react';
import { ApplicationAttempt, Operator } from '../types';

interface ApplicationsPageProps {
  attempts: ApplicationAttempt[];
  operators: Operator[];
  onSelectJob: (jobId: string) => void;
  onReapplyJob: (jobId: string) => Promise<void>;
}

export const ApplicationsPage: React.FC<ApplicationsPageProps> = ({
  attempts,
  operators,
  onSelectJob,
  onReapplyJob,
}) => {
  const [reapplyingJobId, setReapplyingJobId] = useState<string | null>(null);

  const handleReapply = async (jobId: string) => {
    setReapplyingJobId(jobId);
    try {
      await onReapplyJob(jobId);
    } finally {
      setReapplyingJobId(null);
    }
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <Award className="w-5 h-5 text-blue-600" />
              Application Attempts & Reapplication History
            </h2>
            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700">
              {attempts.length} Total Attempts
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Immutable application submission records. Previous attempts are preserved when reapplying.
          </p>
        </div>
      </div>

      {/* Attempt Cards list */}
      <div className="space-y-3">
        {attempts.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200/80 p-12 text-center text-slate-400">
            No application submissions recorded yet.
          </div>
        ) : (
          attempts.map((attempt) => {
            const operator = operators.find((o) => o.operatorId === attempt.operatorId);
            const isApproved = attempt.finalStatus === 'APPROVED';
            const isRejected = attempt.finalStatus === 'REJECTED';
            const isPending = attempt.finalStatus === 'PENDING';

            return (
              <div
                key={attempt.attemptId}
                className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4"
              >
                <div className="space-y-1.5 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200">
                      Attempt #{attempt.attemptNo}
                    </span>
                    <span className="text-xs font-mono text-slate-400">ID: {attempt.attemptId}</span>
                    <span
                      className={`text-xs font-bold px-2.5 py-0.5 rounded ${
                        isApproved
                          ? 'bg-green-100 text-green-800'
                          : isRejected
                          ? 'bg-rose-100 text-rose-800'
                          : 'bg-indigo-100 text-indigo-800'
                      }`}
                    >
                      {attempt.finalStatus}
                    </span>
                  </div>

                  <div className="flex items-baseline gap-2">
                    <h3 className="text-base font-bold text-slate-900">{attempt.shopName}</h3>
                    <span className="text-xs font-mono text-slate-500">{attempt.email}</span>
                  </div>

                  <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500 pt-1">
                    <span className="flex items-center gap-1 font-mono">
                      Job:
                      <button
                        onClick={() => onSelectJob(attempt.jobId)}
                        className="text-blue-600 hover:underline font-bold"
                      >
                        {attempt.jobId}
                      </button>
                    </span>
                    <span>Submitted: {attempt.submittedAt ? new Date(attempt.submittedAt).toLocaleString() : 'N/A'}</span>
                    <span>Operator: {operator ? operator.name : 'System'}</span>
                  </div>

                  {attempt.rejectionReason && (
                    <div className="mt-2 p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-900">
                      <strong className="font-semibold">Rejection Feedback: </strong>
                      {attempt.rejectionReason}
                    </div>
                  )}

                  {attempt.notes && (
                    <p className="text-xs text-slate-600 italic bg-slate-50 p-2 rounded-lg">{attempt.notes}</p>
                  )}
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {isRejected && attempt.nextAttemptAllowed && (
                    <button
                      onClick={() => handleReapply(attempt.jobId)}
                      disabled={reapplyingJobId === attempt.jobId}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold shadow-xs transition-colors"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      {reapplyingJobId === attempt.jobId ? 'Creating Attempt...' : `Reapply (Attempt #${attempt.attemptNo + 1})`}
                    </button>
                  )}

                  <button
                    onClick={() => onSelectJob(attempt.jobId)}
                    className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-medium transition-colors"
                  >
                    View Job
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
