import { Component, ErrorInfo, ReactNode } from 'react';
import { RefreshCw, Home, ShieldAlert } from 'lucide-react';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallbackTitle?: string;
  onReset?: () => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

/**
 * Enterprise-grade React Error Boundary.
 * Catches rendering exceptions in child component trees, logs diagnostic traces,
 * and renders a polished cyber-themed recovery canvas rather than crashing the screen.
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[ANVESHA ErrorBoundary] Uncaught component exception:', error, errorInfo);
    this.setState({ errorInfo });
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    if (this.props.onReset) {
      this.props.onReset();
    }
  };

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex-1 w-full min-h-[360px] h-full flex flex-col items-center justify-center p-6 bg-[#03060E] text-slate-100 select-none animate-fade-in font-sans">
          <div className="max-w-lg w-full p-6 sm:p-8 rounded-2xl bg-[#080C16] border border-cyan-500/30 shadow-[0_0_40px_rgba(0,180,255,0.15)] flex flex-col items-center text-center space-y-4">
            {/* Pulsing Alert Icon */}
            <div className="w-14 h-14 rounded-2xl bg-cyan-950/40 border border-cyan-500/40 flex items-center justify-center text-cyan-400 shadow-inner">
              <ShieldAlert className="w-7 h-7 text-cyan-300 animate-pulse" />
            </div>

            <div className="space-y-1.5">
              <h2 className="text-lg font-bold text-white tracking-wide">
                {this.props.fallbackTitle || 'Workspace View Recovered'}
              </h2>
              <p className="text-xs text-slate-400 leading-relaxed max-w-sm">
                ANVESHA's Error Shield caught a render exception. Your session data and backend state are safe.
              </p>
            </div>

            {/* Error Message Snippet */}
            {this.state.error && (
              <div className="w-full text-left p-3 rounded-xl bg-black/60 border border-white/10 text-rose-300 text-[11px] font-mono break-all max-h-28 overflow-y-auto">
                <span className="text-slate-500 block mb-0.5">// Exception detail:</span>
                {this.state.error.message || String(this.state.error)}
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex flex-wrap items-center justify-center gap-3 pt-2 w-full">
              <button
                type="button"
                onClick={this.handleReset}
                className="flex-1 min-w-[130px] px-4 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-black font-semibold text-xs font-mono flex items-center justify-center gap-2 transition-all shadow-md cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Restore View</span>
              </button>

              <button
                type="button"
                onClick={this.handleReload}
                className="px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 hover:text-white text-xs font-mono flex items-center justify-center gap-2 transition-all cursor-pointer"
              >
                <Home className="w-3.5 h-3.5" />
                <span>Reload Page</span>
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
