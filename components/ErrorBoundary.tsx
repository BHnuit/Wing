/**
 * React 错误边界组件
 * 捕获子组件树中的 JavaScript 错误，记录错误并显示降级 UI
 */

import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';
import { useTranslation } from '../i18n';
import { MockDataService } from '../services/mockDataService';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

class ErrorBoundaryClass extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null
    };
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error,
      errorInfo: null
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    this.setState({
      error,
      errorInfo
    });

    // 可以在这里发送错误报告到日志服务
    // logErrorToService(error, errorInfo);
  }

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null
    });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return <ErrorFallback error={this.state.error} onReset={this.handleReset} />;
    }

    return this.props.children;
  }
}

/**
 * 错误降级 UI 组件
 */
const ErrorFallback: React.FC<{ error: Error | null; onReset: () => void }> = ({ error, onReset }) => {
  const settings = MockDataService.getSettings();
  const t = useTranslation(settings.language);

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
      <div className="max-w-md w-full bg-white rounded-3xl p-8 shadow-lg border border-slate-200">
        <div className="flex flex-col items-center text-center space-y-4">
          <div className="bg-rose-100 rounded-full p-4">
            <AlertTriangle className="text-rose-500" size={48} />
          </div>
          
          <h2 className="serif text-2xl font-bold text-slate-900">
            {t('error_occurred')}
          </h2>
          
          <p className="text-slate-600 text-sm leading-relaxed">
            {t('error_message')}
          </p>

          {error && (
            <details className="w-full mt-4 text-left">
              <summary className="text-xs text-slate-400 cursor-pointer hover:text-slate-600 mb-2">
                {t('error_details')}
              </summary>
              <div className="bg-slate-50 rounded-xl p-4 text-xs font-mono text-slate-700 overflow-auto max-h-32">
                {error.message}
              </div>
            </details>
          )}

          <div className="flex gap-3 w-full mt-6">
            <button
              onClick={onReset}
              className="flex-1 flex items-center justify-center gap-2 bg-blue-500 text-white px-4 py-3 rounded-xl font-medium hover:bg-blue-600 transition-colors"
            >
              <RefreshCw size={18} />
              <span>{t('retry')}</span>
            </button>
            <button
              onClick={() => window.location.href = '/'}
              className="flex-1 flex items-center justify-center gap-2 bg-slate-100 text-slate-700 px-4 py-3 rounded-xl font-medium hover:bg-slate-200 transition-colors"
            >
              <Home size={18} />
              <span>{t('go_home')}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

/**
 * 错误边界组件（函数式包装器）
 */
export const ErrorBoundary: React.FC<Props> = (props) => {
  return <ErrorBoundaryClass {...props} />;
};

export default ErrorBoundary;

