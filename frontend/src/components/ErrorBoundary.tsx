import { Component, type ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // In production you could forward this to a log endpoint
    console.error('ErrorBoundary caught:', error, info);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  handleHome = () => {
    this.setState({ hasError: false, error: null });
    window.location.href = '/dashboard';
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#f8f9fb] flex items-center justify-center p-6 dark:bg-slate-950">
          <div className="card max-w-md w-full p-8 text-center">
            <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center mx-auto mb-4 dark:bg-red-950/50">
              <AlertTriangle size={22} className="text-red-500 dark:text-red-400" />
            </div>
            <h1 className="text-[17px] font-semibold text-gray-800 mb-2 dark:text-slate-100">
              Algo deu errado
            </h1>
            <p className="text-[13px] text-gray-400 mb-6 dark:text-slate-500">
              Ocorreu um erro inesperado. Seu dados não foram perdidos — tente recarregar a página.
            </p>
            {this.state.error && (
              <pre className="text-[11px] text-left text-gray-500 bg-gray-50 rounded-md p-3 mb-6 overflow-x-auto max-h-32 border border-gray-100 dark:text-slate-400 dark:bg-slate-800 dark:border-slate-700">
                {this.state.error.message}
              </pre>
            )}
            <div className="flex gap-3 justify-center">
              <button onClick={this.handleReset} className="btn-secondary">
                <RefreshCw size={14} /> Tentar novamente
              </button>
              <button onClick={this.handleHome} className="btn-primary">
                <Home size={14} /> Ir ao painel
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
