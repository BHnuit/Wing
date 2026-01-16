
import React, { useState, useEffect, useRef } from 'react';
import { Send, CheckCircle2, Image as ImageIcon, Stars, Loader2 } from 'lucide-react';
import { MockDataService } from '../services/mockDataService';
import { GeminiService, GeminiAPIError } from '../services/geminiService';
import { DailySession, RawFragment, SessionStatus, WingEntry, FragmentType } from '../types';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from '../i18n';
import { useToast } from './ErrorToast';

const ChatView: React.FC = () => {
  const [session, setSession] = useState<DailySession>(MockDataService.getCurrentSession());
  const [settings, setSettings] = useState(MockDataService.getSettings());
  const t = useTranslation(settings.language);
  const [input, setInput] = useState('');
  const [showSuccess, setShowSuccess] = useState(false);
  const [isSynthesizing, setIsSynthesizing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const { showToast, ToastContainer } = useToast();

  useEffect(() => {
    const handleSettingsUpdate = () => setSettings(MockDataService.getSettings());
    window.addEventListener('wing_settings_updated', handleSettingsUpdate);
    return () => window.removeEventListener('wing_settings_updated', handleSettingsUpdate);
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [session.fragments]);

  /**
   * 将图片文件转换为base64
   */
  const convertImageToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        resolve(result);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  /**
   * 处理图片选择
   */
  const handleImageSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // 检查文件类型
    if (!file.type.startsWith('image/')) {
      showToast(t('invalid_image'), 'error');
      return;
    }

    // 检查文件大小（限制为5MB）
    if (file.size > 5 * 1024 * 1024) {
      showToast(t('image_too_large'), 'error');
      return;
    }

    try {
      const base64 = await convertImageToBase64(file);
      
      // 自动添加图片片段
      const fragment = MockDataService.addFragment(
        session.id, 
        file.name || t('image_placeholder'),
        FragmentType.IMAGE,
        base64
      );
      
      if (fragment) {
        setSession({ ...MockDataService.getCurrentSession() });
        setShowSuccess(true);
        if ('vibrate' in navigator) navigator.vibrate(50);
        setTimeout(() => setShowSuccess(false), 1500);
      }
    } catch (error) {
      console.error('Failed to process image:', error);
      showToast(t('image_process_failed'), 'error');
    }

    // 重置文件输入
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSend = () => {
    if (!input.trim()) return;

    MockDataService.addFragment(session.id, input);
    setSession({ ...MockDataService.getCurrentSession() });
    
    setInput('');
    setShowSuccess(true);
    
    if ('vibrate' in navigator) navigator.vibrate(50);
    setTimeout(() => setShowSuccess(false), 1500);
  };

  const handleSynthesize = async () => {
    if (session.fragments.length === 0) {
      showToast(t('no_fragments'), 'warning');
      return;
    }
    
    setIsSynthesizing(true);
    try {
      const synthesizedData = await GeminiService.synthesizeJournal(session.fragments, settings.language);
      
      // 构建图片映射：从fragments中提取所有图片
      const images: { [key: string]: string } = {};
      session.fragments.forEach(fragment => {
        if (fragment.type === FragmentType.IMAGE && fragment.imageData) {
          images[fragment.id] = fragment.imageData;
        }
      });

      const newEntry: WingEntry = {
        id: crypto.randomUUID(),
        title: synthesizedData.title || t('untitled'),
        summary: synthesizedData.summary || '',
        mood: synthesizedData.mood || '🌿',
        markdownContent: synthesizedData.markdownContent || '',
        aiInsights: synthesizedData.aiInsights || '',
        todos: synthesizedData.todos || [],
        createdAt: Date.now(),
        images: Object.keys(images).length > 0 ? images : undefined
      };

      MockDataService.saveEntry(newEntry);
      
      const updatedSession = { ...session, status: SessionStatus.COMPLETED, finalEntryId: newEntry.id };
      MockDataService.saveSession(updatedSession);
      
      showToast(t('synth_success'), 'success', 2000);
      setTimeout(() => {
        navigate(`/journal/${newEntry.id}`);
      }, 500);
    } catch (error) {
      console.error("Synthesis failed:", error);
      
      let errorMessage = t('synth_failed');
      
      if (error instanceof GeminiAPIError) {
        switch (error.code) {
          case 'MISSING_API_KEY':
            errorMessage = t('api_key_missing');
            break;
          case 'NETWORK_ERROR':
            errorMessage = t('network_error');
            break;
          case 'EMPTY_FRAGMENTS':
            errorMessage = t('no_fragments');
            break;
          case 'PARSE_ERROR':
            errorMessage = t('parse_error');
            break;
          default:
            errorMessage = error.message || t('synth_failed');
        }
      }
      
      showToast(errorMessage, 'error');
    } finally {
      setIsSynthesizing(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-50/50">
      <div className="flex-1 p-6 space-y-6">
        {session.fragments.length === 0 ? (
          <div className="h-[60vh] flex flex-col items-center justify-center text-slate-400 space-y-4">
            <FeatherIcon className="opacity-20" size={64} />
            <p className="serif italic text-lg text-center px-12">
              {t('empty_chat')}
            </p>
          </div>
        ) : (
          session.fragments.map((fragment) => (
            <div key={fragment.id} className="flex flex-col items-end">
              <div className="max-w-[85%] bg-white border border-slate-100 rounded-2xl rounded-tr-none shadow-sm overflow-hidden">
                {fragment.type === FragmentType.IMAGE && fragment.imageData ? (
                  <div className="relative">
                    <img 
                      src={fragment.imageData} 
                      alt={fragment.content}
                      className="max-w-full h-auto object-cover"
                      style={{ maxHeight: '400px' }}
                    />
                    {fragment.content && fragment.content !== t('image_placeholder') && (
                      <div className="px-4 py-2 bg-slate-50 border-t border-slate-100">
                        <p className="text-xs text-slate-500">{fragment.content}</p>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="px-4 py-3">
                    <p className="text-slate-800 leading-relaxed">{fragment.content}</p>
                  </div>
                )}
              </div>
              <span className="text-[10px] text-slate-400 mt-1 mr-1">
                {new Date(fragment.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
          ))
        )}
        <div ref={scrollRef} />
      </div>

      {session.fragments.length > 0 && session.status !== SessionStatus.COMPLETED && (
        <div className="px-6 py-4 flex justify-center">
          <button 
            onClick={handleSynthesize}
            disabled={isSynthesizing}
            className="flex items-center gap-2 bg-slate-900 text-white px-6 py-3 rounded-full font-medium shadow-lg hover:bg-slate-800 transition-all disabled:opacity-50"
          >
            {isSynthesizing ? (
              <Loader2 className="animate-spin" size={20} />
            ) : (
              <Stars size={20} />
            )}
            <span>{isSynthesizing ? t('weaving') : t('synthesize_btn')}</span>
          </button>
        </div>
      )}

      <div className="sticky bottom-0 bg-white/80 backdrop-blur-xl border-t border-slate-200 px-6 py-4">
        <div className="flex items-end gap-3">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleImageSelect}
            accept="image/*"
            className="hidden"
          />
          <button 
            onClick={() => fileInputRef.current?.click()}
            className="p-3 text-slate-400 hover:text-blue-500 transition-colors"
            title={t('add_image')}
          >
            <ImageIcon size={22} />
          </button>
          
          <div className="flex-1 relative flex items-center">
            <textarea
              rows={1}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              placeholder={t('mind_placeholder')}
              className="w-full bg-slate-100 rounded-[24px] px-5 py-3 pr-12 focus:outline-none focus:ring-2 focus:ring-blue-100 resize-none max-h-32"
            />
            <div className={`absolute right-4 transition-all duration-300 ${showSuccess ? 'scale-110 opacity-100' : 'scale-50 opacity-0'}`}>
              <CheckCircle2 className="text-green-500" size={22} />
            </div>
          </div>

          <button 
            onClick={handleSend}
            disabled={!input.trim()}
            className="p-3 bg-blue-500 text-white rounded-full hover:bg-blue-600 disabled:bg-slate-200 transition-all shadow-md active:scale-95"
          >
            <Send size={20} />
          </button>
        </div>
      </div>

      {/* Toast 容器 */}
      <ToastContainer />
    </div>
  );
};

const FeatherIcon: React.FC<{ className?: string, size?: number }> = ({ className, size }) => (
  <svg 
    xmlns="http://www.w3.org/2000/svg" 
    width={size} 
    height={size} 
    viewBox="0 0 24 24" 
    fill="none" 
    stroke="currentColor" 
    strokeWidth="1.5" 
    strokeLinecap="round" 
    strokeLinejoin="round" 
    className={className}
  >
    <path d="M20.24 12.24a6 6 0 0 0-8.49-8.49L5 10.5V19h8.5z" />
    <line x1="16" y1="8" x2="2" y2="22" />
    <line x1="17.5" y1="15" x2="9" y2="15" />
  </svg>
);

export default ChatView;
