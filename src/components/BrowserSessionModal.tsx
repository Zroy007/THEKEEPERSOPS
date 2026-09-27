import React, { useState } from 'react';
import {
  X,
  Monitor,
  RotateCcw,
  Square,
  Pause,
  Play,
  ExternalLink,
  Shield,
  Maximize2,
  Minimize2,
  Globe,
  Radio,
  AlertTriangle,
  CheckCircle2,
  Lock,
} from 'lucide-react';
import { Session } from '../types';
import { StatusBadge } from './StatusBadge';
import { Button } from './ui/Button';
import { Badge } from './ui/Badge';

interface BrowserSessionModalProps {
  session: Session;
  onClose: () => void;
  onPauseJob?: (jobId: string) => void;
  onResumeJob?: (jobId: string) => void;
  onStopSession: (sessionId: string) => void;
}

export const BrowserSessionModal: React.FC<BrowserSessionModalProps> = ({
  session,
  onClose,
  onPauseJob,
  onResumeJob,
  onStopSession,
}) => {
  const [fullscreen, setFullscreen] = useState(false);
  const [activeTab, setActiveTab] = useState<'portal' | 'devtools' | 'info'>('portal');

  const isRunning = session.status === 'RUNNING';
  const isPaused = session.status === 'PAUSED';
  const isHumanAction =
    session.currentWorkflowState === 'WAITING_FOR_EMAIL_OTP' ||
    session.currentWorkflowState === 'HUMAN_IDENTITY_VERIFICATION' ||
    session.currentWorkflowState === 'HUMAN_SELFIE_REQUIRED';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-950/75 backdrop-blur-xs">
      <div
        id="browser-session-modal"
        className={`bg-slate-950 text-white rounded-xl shadow-2xl border border-slate-800 flex flex-col overflow-hidden transition-all duration-200 ${
          fullscreen ? 'w-full h-full' : 'max-w-5xl w-full h-[88vh]'
        }`}
      >
        {/* 1. TOP STATUS & ALERT BAR (Section 16) */}
        <div
          className={`px-4 py-2.5 flex items-center justify-between border-b ${
            isHumanAction
              ? 'bg-amber-500/20 border-amber-500/40 text-amber-200'
              : 'bg-slate-900 border-slate-800 text-slate-300'
          }`}
        >
          <div className="flex items-center gap-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-sm text-white">
                  {session.shopName || 'Store Registration Portal'}
                </span>
                <span className="font-mono text-xs text-slate-400">({session.jobId})</span>
                {isHumanAction ? (
                  <Badge variant="warning" size="sm" dot>
                    HUMAN ACTION REQUIRED: {session.currentWorkflowState.replace(/_/g, ' ')}
                  </Badge>
                ) : (
                  <Badge variant={isRunning ? 'success' : 'neutral'} size="sm" dot>
                    {session.status}
                  </Badge>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setFullscreen(!fullscreen)}
              className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
              title={fullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
            >
              {fullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* 2. BROWSER ADDRESS BAR & TAB SWITCHER */}
        <div className="flex items-center justify-between px-4 py-2 bg-slate-900/90 border-b border-slate-800 text-xs shrink-0 gap-3">
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 mr-2">
              <div className="w-2.5 h-2.5 rounded-full bg-rose-500" />
              <div className="w-2.5 h-2.5 rounded-full bg-amber-500" />
              <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
            </div>
            <button
              onClick={() => setActiveTab('portal')}
              className={`px-2.5 py-1 rounded-md font-medium transition-colors ${
                activeTab === 'portal' ? 'bg-sky-600 text-white' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Browser Screen
            </button>
            <button
              onClick={() => setActiveTab('devtools')}
              className={`px-2.5 py-1 rounded-md font-medium transition-colors ${
                activeTab === 'devtools' ? 'bg-sky-600 text-white' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              DevTools Logs
            </button>
            <button
              onClick={() => setActiveTab('info')}
              className={`px-2.5 py-1 rounded-md font-medium transition-colors ${
                activeTab === 'info' ? 'bg-sky-600 text-white' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              GoLogin Profile Details
            </button>
          </div>

          {/* URL bar */}
          <div className="flex-1 max-w-lg hidden sm:flex items-center gap-2 bg-slate-950 px-3 py-1 rounded-md border border-slate-800 text-[11px] font-mono text-slate-300">
            <Lock className="w-3 h-3 text-emerald-400 shrink-0" />
            <span className="truncate">
              {session.currentUrl || 'https://sellercentral.merchant.portal/onboarding'}
            </span>
          </div>

          <div className="flex items-center gap-1.5 text-[11px] font-mono text-slate-400">
            <Radio className="w-3 h-3 text-emerald-400 animate-pulse" />
            <span>Port: {(session as any).remoteDebuggerPort || 9222}</span>
          </div>
        </div>

        {/* 3. BROWSER VIEWPORT MAIN AREA */}
        <div className="flex-1 bg-slate-900 relative overflow-hidden flex flex-col">
          {activeTab === 'portal' ? (
            <div className="flex-1 flex flex-col items-center justify-center p-6 text-center bg-slate-950/60 relative">
              {/* Virtual Mock Browser Frame */}
              <div className="max-w-2xl w-full bg-slate-900 rounded-lg border border-slate-800 p-6 text-left space-y-4 shadow-xl">
                <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                  <div className="flex items-center gap-2">
                    <Globe className="w-4 h-4 text-sky-400" />
                    <span className="font-semibold text-xs text-white">Merchant Seller Central</span>
                  </div>
                  <Badge variant={isRunning ? 'success' : 'neutral'} size="xs" dot>
                    {session.status}
                  </Badge>
                </div>

                <div className="space-y-3 py-4 text-xs">
                  <div className="flex items-center justify-between p-3 rounded-md bg-slate-950/80 border border-slate-800/80">
                    <span className="text-slate-400">Active Workflow Step:</span>
                    <span className="font-mono text-sky-400 font-semibold">
                      {session.currentWorkflowState}
                    </span>
                  </div>

                  <div className="flex items-center justify-between p-3 rounded-md bg-slate-950/80 border border-slate-800/80">
                    <span className="text-slate-400">Current Portal Page:</span>
                    <span className="font-mono text-slate-300 truncate max-w-sm">
                      {session.currentUrl || 'https://sellercentral.merchant.portal/registration/step2'}
                    </span>
                  </div>

                  {isHumanAction && (
                    <div className="p-3 rounded-md bg-amber-500/10 border border-amber-500/30 text-amber-300 flex items-start gap-2.5">
                      <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                      <div>
                        <div className="font-semibold text-xs text-amber-200">
                          Human Verification in Progress
                        </div>
                        <p className="text-[11px] text-amber-300/80 mt-0.5">
                          Automated script is paused awaiting manual operator OTP entry or document verification.
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                <div className="text-[11px] text-slate-400 pt-2 border-t border-slate-800/80 flex items-center justify-between">
                  <span>GoLogin Antidetect Profile: <strong className="text-slate-200 font-mono">{session.gologinProfileId}</strong></span>
                  <a
                    href={session.currentUrl || '#'}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sky-400 hover:text-sky-300 flex items-center gap-1"
                  >
                    Open Live in Browser <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              </div>
            </div>
          ) : activeTab === 'devtools' ? (
            <div className="flex-1 p-4 font-mono text-xs overflow-y-auto bg-slate-950 text-slate-300 space-y-1">
              <div className="text-slate-500">// Chromium DevTools Protocol (CDP) Stream Connected</div>
              <div className="text-slate-500">// Debugger URL: ws://127.0.0.1:{(session as any).remoteDebuggerPort || 9222}/devtools/browser</div>
              <div className="text-emerald-400">[info] Page.navigate({session.currentUrl || 'https://sellercentral.merchant.portal'})</div>
              <div className="text-slate-400">[DOM] Form input focused: #merchant_email_address</div>
              <div className="text-slate-400">[Network] POST /api/v1/auth/signup HTTP/2 200 OK</div>
              <div className="text-amber-400">[Checkpoint] 2FA required: Challenge WAITING_FOR_EMAIL_OTP emitted</div>
              <div className="text-slate-500">[Heartbeat] Ping acknowledged. CPU: 2.1%, Mem: 184MB</div>
            </div>
          ) : (
            <div className="flex-1 p-6 overflow-y-auto bg-slate-950 text-xs space-y-4">
              <div className="max-w-xl mx-auto space-y-3 bg-slate-900 p-5 rounded-lg border border-slate-800">
                <h4 className="font-bold text-white text-xs uppercase tracking-wider">
                  GoLogin Profile Parameters
                </h4>
                <div className="space-y-2 font-mono text-slate-300">
                  <div className="flex justify-between py-1 border-b border-slate-800">
                    <span className="text-slate-500">Profile ID:</span>
                    <span>{session.gologinProfileId}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-800">
                    <span className="text-slate-500">Session ID:</span>
                    <span>{session.sessionId}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-800">
                    <span className="text-slate-500">Associated Job:</span>
                    <span>{session.jobId}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-800">
                    <span className="text-slate-500">Assigned Operator:</span>
                    <span>{session.operatorId || 'Automated'}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-800">
                    <span className="text-slate-500">Last Heartbeat:</span>
                    <span>{new Date(session.lastHeartbeat).toLocaleString()}</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* 4. BOTTOM SESSION CONTROLS BAR (Section 16) */}
        <div className="px-5 py-3 bg-slate-900 border-t border-slate-800 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <span>Session ID: <strong className="font-mono text-slate-200">{session.sessionId}</strong></span>
          </div>

          <div className="flex items-center gap-2">
            {isRunning && onPauseJob && (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => onPauseJob(session.jobId)}
                leftIcon={<Pause className="w-3.5 h-3.5 text-amber-500" />}
              >
                Pause Automation
              </Button>
            )}

            {isPaused && onResumeJob && (
              <Button
                variant="success"
                size="sm"
                onClick={() => onResumeJob(session.jobId)}
                leftIcon={<Play className="w-3.5 h-3.5" />}
              >
                Resume Automation
              </Button>
            )}

            <Button
              variant="danger"
              size="sm"
              onClick={() => {
                if (confirm(`Stop GoLogin browser session ${session.sessionId}?`)) {
                  onStopSession(session.sessionId);
                  onClose();
                }
              }}
              leftIcon={<Square className="w-3.5 h-3.5" />}
            >
              Stop Session
            </Button>

            <Button variant="secondary" size="sm" onClick={onClose}>
              Close
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
