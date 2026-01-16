/**
 * 错误提示 Toast 组件
 * 用于显示临时错误消息
 */

import React, { useEffect, useState } from 'react';
import { XCircle, X, AlertCircle, Info, CheckCircle } from 'lucide-react';

export type ToastType = 'error' | 'warning' | 'info' | 'success';

export interface ToastProps {
  message: string;
  type?: ToastType;
  duration?: number;
  onClose?: () => void;
}

const Toast: React.FC<ToastProps> = ({ 
  message, 
  type = 'error', 
  duration = 5000,
  onClose 
}) => {
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    if (duration > 0) {
      const timer = setTimeout(() => {
        setIsVisible(false);
        setTimeout(() => onClose?.(), 300); // 等待动画完成
      }, duration);

      return () => clearTimeout(timer);
    }
  }, [duration, onClose]);

  const handleClose = () => {
    setIsVisible(false);
    setTimeout(() => onClose?.(), 300);
  };

  const typeConfig = {
    error: {
      bg: 'bg-rose-50',
      border: 'border-rose-200',
      text: 'text-rose-700',
      icon: XCircle,
      iconColor: 'text-rose-500'
    },
    warning: {
      bg: 'bg-amber-50',
      border: 'border-amber-200',
      text: 'text-amber-700',
      icon: AlertCircle,
      iconColor: 'text-amber-500'
    },
    info: {
      bg: 'bg-blue-50',
      border: 'border-blue-200',
      text: 'text-blue-700',
      icon: Info,
      iconColor: 'text-blue-500'
    },
    success: {
      bg: 'bg-green-50',
      border: 'border-green-200',
      text: 'text-green-700',
      icon: CheckCircle,
      iconColor: 'text-green-500'
    }
  };

  const config = typeConfig[type];
  const Icon = config.icon;

  if (!isVisible) return null;

  return (
    <div
      className={`fixed top-4 right-4 z-50 max-w-md w-full ${config.bg} ${config.border} border rounded-2xl shadow-lg p-4 transition-all duration-300 ${
        isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-2'
      }`}
    >
      <div className="flex items-start gap-3">
        <Icon className={`${config.iconColor} flex-shrink-0 mt-0.5`} size={20} />
        <div className="flex-1">
          <p className={`${config.text} text-sm font-medium leading-relaxed`}>
            {message}
          </p>
        </div>
        <button
          onClick={handleClose}
          className={`${config.text} hover:opacity-70 transition-opacity flex-shrink-0`}
        >
          <X size={18} />
        </button>
      </div>
    </div>
  );
};

/**
 * Toast 管理器 Hook
 */
export const useToast = () => {
  const [toasts, setToasts] = useState<Array<ToastProps & { id: string }>>([]);

  const showToast = (message: string, type: ToastType = 'error', duration?: number) => {
    const id = crypto.randomUUID();
    const toast = { id, message, type, duration: duration ?? 5000 };
    
    setToasts(prev => [...prev, toast]);
    
    return id;
  };

  const removeToast = (id: string) => {
    setToasts(prev => prev.filter(toast => toast.id !== id));
  };

  const ToastContainer = () => (
    <>
      {toasts.map(toast => (
        <Toast
          key={toast.id}
          {...toast}
          onClose={() => removeToast(toast.id)}
        />
      ))}
    </>
  );

  return { showToast, ToastContainer };
};

export default Toast;

