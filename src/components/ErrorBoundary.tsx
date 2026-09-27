import React, { ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught React UI error:', error, errorInfo);
    this.setState({ error, errorInfo });
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-6">
          <div className="max-w-xl w-full bg-slate-900 border border-red-500/30 rounded-xl p-8 shadow-2xl space-y-6">
            <div className="flex items-center space-x-3 text-red-400">
              <div className="p-3 bg-red-500/10 rounded-lg">
                <AlertTriangle className="w-8 h-8" />
              </div>
              <div>
                <h1 className="text-xl font-bold tracking-tight">Application Interface Error</h1>
                <p className="text-sm text-slate-400">An unexpected exception occurred in the dashboard view.</p>
              </div>
            </div>

            <div className="bg-slate-950/80 border border-slate-800 rounded-lg p-4 font-mono text-xs text-red-300 overflow-x-auto max-h-48">
              {this.state.error?.toString() || 'Unknown Error'}
            </div>

            <div className="flex items-center justify-end space-x-3">
              <button
                onClick={this.handleReset}
                className="flex items-center space-x-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-medium transition-colors cursor-pointer"
              >
                <RefreshCw className="w-4 h-4" />
                <span>Reload Application</span>
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
