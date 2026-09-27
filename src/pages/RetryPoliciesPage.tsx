import React, { useState } from 'react';
import { RotateCcw, ShieldCheck, AlertCircle, Save } from 'lucide-react';
import { RetryPolicy } from '../types';

interface RetryPoliciesPageProps {
  policies: RetryPolicy[];
  onSavePolicy: (policyId: string, updates: Partial<RetryPolicy>) => Promise<void>;
}

export const RetryPoliciesPage: React.FC<RetryPoliciesPageProps> = ({
  policies,
  onSavePolicy,
}) => {
  const [editingPolicyId, setEditingPolicyId] = useState<string | null>(null);
  const [currentEdit, setCurrentEdit] = useState<Partial<RetryPolicy>>({});
  const [saving, setSaving] = useState(false);

  const startEdit = (policy: RetryPolicy) => {
    setEditingPolicyId(policy.policyId);
    setCurrentEdit({ ...policy });
  };

  const saveEdit = async (policyId: string) => {
    setSaving(true);
    try {
      await onSavePolicy(policyId, currentEdit);
      setEditingPolicyId(null);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <RotateCcw className="w-5 h-5 text-blue-600" />
            Technical Error Retry Policies & Exponential Backoff
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Strict separation between technical errors (auto-retried with exponential backoff & jitter) and functional rejections.
          </p>
        </div>
      </div>

      {/* Distinction Policy Banner */}
      <div className="p-4 bg-slate-900 text-white rounded-2xl flex items-start gap-3">
        <div className="p-2 bg-slate-800 rounded-xl text-blue-400 mt-0.5">
          <ShieldCheck className="w-5 h-5" />
        </div>
        <div className="text-xs space-y-1">
          <h4 className="font-semibold text-white">Technical vs Functional Error Separation</h4>
          <p className="text-slate-300 leading-relaxed">
            Technical errors (e.g. Proxy disconnects, Browser crash, Network timeouts) apply exponential backoff delays (e.g. 30s, 120s, 300s) up to the policy limit. Functional rejections (portal denied merchant) NEVER retry automatically; they are recorded as official rejections and trigger the reapplication workflow.
          </p>
        </div>
      </div>

      {/* Policies Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-50 text-slate-600 border-b border-slate-200">
            <tr>
              <th className="p-3.5 font-semibold">Error Code</th>
              <th className="p-3.5 font-semibold">Description</th>
              <th className="p-3.5 font-semibold">Max Retries</th>
              <th className="p-3.5 font-semibold">Initial Delay</th>
              <th className="p-3.5 font-semibold">Backoff Multiplier</th>
              <th className="p-3.5 font-semibold">Type</th>
              <th className="p-3.5 font-semibold text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {policies.map((policy) => {
              const isEditing = editingPolicyId === policy.policyId;

              return (
                <tr key={policy.policyId} className="hover:bg-slate-50/70 transition-colors">
                  <td className="p-3.5 font-mono font-bold text-slate-900">{policy.errorCode}</td>
                  <td className="p-3.5 text-slate-600 max-w-xs">{policy.description}</td>

                  <td className="p-3.5">
                    {isEditing ? (
                      <input
                        type="number"
                        min="1"
                        max="10"
                        value={currentEdit.maxRetries ?? policy.maxRetries}
                        onChange={(e) =>
                          setCurrentEdit({ ...currentEdit, maxRetries: parseInt(e.target.value) || 1 })
                        }
                        className="w-16 px-2 py-1 border border-slate-300 rounded text-xs"
                      />
                    ) : (
                      <span className="font-mono font-semibold text-slate-700">{policy.maxRetries} attempts</span>
                    )}
                  </td>

                  <td className="p-3.5">
                    {isEditing ? (
                      <input
                        type="number"
                        value={currentEdit.initialDelaySeconds ?? policy.initialDelaySeconds}
                        onChange={(e) =>
                          setCurrentEdit({
                            ...currentEdit,
                            initialDelaySeconds: parseInt(e.target.value) || 10,
                          })
                        }
                        className="w-16 px-2 py-1 border border-slate-300 rounded text-xs"
                      />
                    ) : (
                      <span className="font-mono text-slate-700">{policy.initialDelaySeconds}s</span>
                    )}
                  </td>

                  <td className="p-3.5">
                    {isEditing ? (
                      <input
                        type="number"
                        step="0.5"
                        value={currentEdit.backoffMultiplier ?? policy.backoffMultiplier}
                        onChange={(e) =>
                          setCurrentEdit({
                            ...currentEdit,
                            backoffMultiplier: parseFloat(e.target.value) || 2,
                          })
                        }
                        className="w-16 px-2 py-1 border border-slate-300 rounded text-xs"
                      />
                    ) : (
                      <span className="font-mono text-slate-700">{policy.backoffMultiplier}x + jitter</span>
                    )}
                  </td>

                  <td className="p-3.5">
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                      Technical
                    </span>
                  </td>

                  <td className="p-3.5 text-right">
                    {isEditing ? (
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => saveEdit(policy.policyId)}
                          disabled={saving}
                          className="px-2.5 py-1 bg-blue-600 text-white rounded-lg text-xs font-semibold"
                        >
                          Save
                        </button>
                        <button
                          onClick={() => setEditingPolicyId(null)}
                          className="px-2.5 py-1 bg-slate-100 text-slate-700 rounded-lg text-xs"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => startEdit(policy)}
                        className="px-2.5 py-1 text-slate-700 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors text-xs font-medium"
                      >
                        Edit
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
