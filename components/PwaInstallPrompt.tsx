/**
 * PWA 安装提示组件
 * 监听 beforeinstallprompt 事件并显示安装提示
 */

import React, { useState, useEffect } from 'react';
import { X, Download } from 'lucide-react';
import { useTranslation } from '../i18n';
import { MockDataService } from '../services/mockDataService';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const PwaInstallPrompt: React.FC = () => {
  const settings = MockDataService.getSettings();
  const t = useTranslation(settings.language);
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    // 检查是否已安装
    const checkInstalled = () => {
      // 检查是否在独立窗口中运行（PWA 模式）
      const isStandalone = window.matchMedia('(display-mode: standalone)').matches ||
        (window.navigator as any).standalone === true ||
        document.referrer.includes('android-app://');
      
      if (isStandalone) {
        setIsInstalled(true);
        return;
      }

      // 检查是否已隐藏过提示（用户已拒绝）
      const dismissed = localStorage.getItem('pwa_install_dismissed');
      if (dismissed) {
        const dismissedTime = parseInt(dismissed, 10);
        const daysSinceDismissed = (Date.now() - dismissedTime) / (1000 * 60 * 60 * 24);
        // 如果 7 天内已拒绝，不再显示
        if (daysSinceDismissed < 7) {
          return;
        }
      }
    };

    checkInstalled();

    // 监听 beforeinstallprompt 事件
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      const promptEvent = e as BeforeInstallPromptEvent;
      setDeferredPrompt(promptEvent);
      
      // 延迟显示提示，给用户一些时间熟悉应用
      setTimeout(() => {
        if (!isInstalled) {
          setShowPrompt(true);
        }
      }, 3000); // 3 秒后显示
    };

    // 监听应用安装完成
    const handleAppInstalled = () => {
      setIsInstalled(true);
      setShowPrompt(false);
      setDeferredPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, [isInstalled]);

  const handleInstall = async () => {
    if (!deferredPrompt) return;

    // 显示安装提示
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;

    if (outcome === 'accepted') {
      setIsInstalled(true);
    } else {
      // 用户拒绝，记录时间
      localStorage.setItem('pwa_install_dismissed', Date.now().toString());
    }

    setDeferredPrompt(null);
    setShowPrompt(false);
  };

  const handleDismiss = () => {
    setShowPrompt(false);
    // 记录用户拒绝时间
    localStorage.setItem('pwa_install_dismissed', Date.now().toString());
  };

  // 如果已安装或不显示提示，不渲染
  if (isInstalled || !showPrompt || !deferredPrompt) {
    return null;
  }

  return (
    <div className="fixed bottom-4 left-4 right-4 z-50 md:left-auto md:right-4 md:max-w-sm">
      <div className="bg-twilight-cream dark:bg-nocturnal-surface rounded-2xl p-4 border border-twilight-divider dark:border-nocturnal-secondary/25 shadow-lg">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-xl bg-twilight-amber/10 dark:bg-nocturnal-accent/20 flex-shrink-0">
            <Download className="text-twilight-amber dark:text-nocturnal-accent" size={20} />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-medium text-twilight-charcoal dark:text-nocturnal-primary mb-1">
              {t('pwa_install_title')}
            </h3>
            <p className="text-sm text-twilight-duskLight dark:text-nocturnal-secondary mb-3">
              {t('pwa_install_desc')}
            </p>
            <div className="flex gap-2">
              <button
                onClick={handleInstall}
                className="flex-1 px-4 py-2 bg-twilight-amber dark:bg-nocturnal-accent text-white rounded-lg hover:opacity-90 transition-opacity text-sm font-medium"
              >
                {t('pwa_install_button')}
              </button>
              <button
                onClick={handleDismiss}
                className="px-4 py-2 text-twilight-duskLight dark:text-nocturnal-secondary hover:text-twilight-charcoal dark:hover:text-nocturnal-primary transition-colors text-sm"
              >
                {t('pwa_install_dismiss')}
              </button>
            </div>
          </div>
          <button
            onClick={handleDismiss}
            className="p-1 rounded-lg hover:bg-twilight-divider/30 dark:hover:bg-nocturnal-secondary/20 transition-colors flex-shrink-0"
            aria-label={t('cancel')}
          >
            <X size={16} className="text-twilight-duskLight dark:text-nocturnal-secondary" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default PwaInstallPrompt;
