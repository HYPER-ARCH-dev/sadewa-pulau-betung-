import React, { Component, ErrorInfo, ReactNode } from 'react';
import { RefreshCw, Trash2, ShieldAlert } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null
    };
  }

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  public override componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught Error Boundary caught an error:', error, errorInfo);
    this.setState({ error, errorInfo });
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    window.location.reload();
  };

  private handleClearStorageAndReset = () => {
    try {
      localStorage.clear();
      sessionStorage.clear();
    } catch (e) {
      console.error('Failed to clear storage:', e);
    }
    window.location.href = window.location.origin;
  };

  public override render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-900 text-white flex items-center justify-center p-4 font-sans">
          <div className="max-w-lg w-full bg-slate-800 rounded-3xl p-6 sm:p-8 border border-slate-700 shadow-2xl space-y-6 text-center">
            <div className="w-16 h-16 rounded-2xl bg-rose-500/20 text-rose-400 border border-rose-500/30 flex items-center justify-center mx-auto shadow-lg">
              <ShieldAlert className="w-8 h-8" />
            </div>

            <div className="space-y-2">
              <h2 className="text-xl sm:text-2xl font-black text-white">
                Sistem Terdeteksi Mengalami Gangguan
              </h2>
              <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                Aplikasi SADEWA berhasil mencegah pemuatan layar putih (blank screen). Anda dapat mencoba memuat ulang halaman atau membersihkan cache sesi lokal.
              </p>
            </div>

            {this.state.error && (
              <div className="bg-slate-950/80 p-3.5 rounded-2xl border border-slate-800 text-left text-[11px] font-mono text-rose-300 max-h-32 overflow-y-auto">
                <span className="font-bold text-slate-400 block mb-1">Pesan Kesalahan:</span>
                {this.state.error.toString()}
              </div>
            )}

            <div className="pt-2 flex flex-col sm:flex-row items-center gap-3">
              <button
                onClick={this.handleReset}
                className="w-full sm:flex-1 py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition-colors flex items-center justify-center gap-2 shadow-md"
              >
                <RefreshCw className="w-4 h-4" />
                <span>Muat Ulang Sesi</span>
              </button>

              <button
                onClick={this.handleClearStorageAndReset}
                className="w-full sm:flex-1 py-3 px-4 rounded-xl bg-slate-700 hover:bg-rose-950 hover:text-rose-200 text-slate-200 font-bold text-xs border border-slate-600 transition-colors flex items-center justify-center gap-2"
              >
                <Trash2 className="w-4 h-4 text-rose-400" />
                <span>Reset LocalStorage</span>
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
