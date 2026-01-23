/**
 * 记忆管理界面
 * 支持查看、编辑、删除记忆，以及手动提取记忆
 */

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Trash2, Edit2, Save, X, Brain, RefreshCw, Plus, ChevronLeft, ChevronRight, AlertTriangle } from 'lucide-react';
import { Memory, MemoryType, SemanticMemory, EpisodicMemory, ProceduralMemory, WingEntry, AppSettings } from '../types';
import { getAllMemories, deleteMemory, updateMemory, extractMemoriesFromEntry, mergeSimilarMemories } from '../services/memoryService';
import { MockDataService } from '../services/mockDataService';
import { WELCOME_ENTRY_ID } from '../services/welcomeEntry';
import { useTranslation } from '../i18n';
import { useToast } from './ErrorToast';
import { AiAPIError } from '../services/aiService';
import { IndexedDBStorage } from '../services/indexedDBStorage';

const MemoryManagementView: React.FC = () => {
  const [settings, setSettings] = useState<AppSettings>(MockDataService.getSettings());
  const t = useTranslation(settings.language);
  const navigate = useNavigate();
  const { showToast, ToastContainer } = useToast();
  
  const [memories, setMemories] = useState<Memory[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<Partial<Memory>>({});
  const [filterType, setFilterType] = useState<MemoryType>('semantic');
  const [isExtracting, setIsExtracting] = useState(false);
  const [selectedEntryId, setSelectedEntryId] = useState<string>('');
  const [currentPage, setCurrentPage] = useState(1);
  const [showDeleteAllModal, setShowDeleteAllModal] = useState(false);
  const [showDeleteAllConfirm, setShowDeleteAllConfirm] = useState(false);
  const MEMORIES_PER_PAGE = 20;

  useEffect(() => {
    const handleUpdate = () => {
      setSettings(MockDataService.getSettings());
      setMemories(getAllMemories());
    };
    handleUpdate();
    window.addEventListener('wing_data_updated', handleUpdate);
    return () => window.removeEventListener('wing_data_updated', handleUpdate);
  }, []);

  const filteredMemories = memories.filter(m => m.type === filterType);
  const totalPages = Math.ceil(filteredMemories.length / MEMORIES_PER_PAGE);
  const startIndex = (currentPage - 1) * MEMORIES_PER_PAGE;
  const endIndex = startIndex + MEMORIES_PER_PAGE;
  const paginatedMemories = filteredMemories.slice(startIndex, endIndex);

  // 切换筛选类型时重置到第一页
  useEffect(() => {
    setCurrentPage(1);
  }, [filterType]);

  const handleDelete = (id: string) => {
    if (confirm(t('memory_delete_confirm'))) {
      deleteMemory(id);
      setMemories(getAllMemories());
      showToast(t('memory_deleted'), 'success');
    }
  };

  const startEdit = (memory: Memory) => {
    setEditingId(memory.id);
    setEditDraft({ ...memory });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditDraft({});
  };

  const saveEdit = () => {
    if (!editingId || !editDraft) return;
    const memory = memories.find(m => m.id === editingId);
    if (!memory) return;

    if (memory.type === 'semantic') {
      const mem = { ...memory as SemanticMemory, ...editDraft } as SemanticMemory;
      if (mem.key && mem.value) {
        updateMemory(mem);
        setMemories(getAllMemories());
        setEditingId(null);
        setEditDraft({});
        showToast(t('memory_updated'), 'success');
      }
    } else if (memory.type === 'episodic') {
      const mem = { ...memory as EpisodicMemory, ...editDraft } as EpisodicMemory;
      if (mem.event) {
        updateMemory(mem);
        setMemories(getAllMemories());
        setEditingId(null);
        setEditDraft({});
        showToast(t('memory_updated'), 'success');
      }
    } else if (memory.type === 'procedural') {
      const mem = { ...memory as ProceduralMemory, ...editDraft } as ProceduralMemory;
      if (mem.pattern || mem.preference) {
        updateMemory(mem);
        setMemories(getAllMemories());
        setEditingId(null);
        setEditDraft({});
        showToast(t('memory_updated'), 'success');
      }
    }
  };

  const handleExtractFromEntry = async () => {
    if (!selectedEntryId) {
      showToast(t('memory_select_entry'), 'warning');
      return;
    }
    const entry = MockDataService.getEntryById(selectedEntryId);
    if (!entry) {
      showToast(t('entry_not_found'), 'error');
      return;
    }

    setIsExtracting(true);
    try {
      const extracted = await extractMemoriesFromEntry(entry, settings);
      setMemories(getAllMemories());
      showToast(t('memory_extracted').replace('{count}', String(extracted.length)), 'success');
      setSelectedEntryId('');
    } catch (error) {
      console.error('提取记忆失败:', error);
      if (error instanceof AiAPIError) {
        showToast(error.message, 'error');
      } else {
        showToast(t('memory_extract_failed'), 'error');
      }
    } finally {
      setIsExtracting(false);
    }
  };

  const handleMergeSimilar = () => {
    mergeSimilarMemories();
    setMemories(getAllMemories());
    showToast(t('memory_merged'), 'success');
  };

  const handleDeleteAllClick = () => {
    setShowDeleteAllModal(true);
  };

  const handleDeleteAllConfirm = () => {
    setShowDeleteAllModal(false);
    setShowDeleteAllConfirm(true);
  };

  const handleDeleteAllFinal = () => {
    const allMemories = getAllMemories();
    for (const memory of allMemories) {
      deleteMemory(memory.id);
    }
    setMemories([]);
    setShowDeleteAllConfirm(false);
    showToast(t('memory_all_deleted'), 'success');
  };

  const entries = MockDataService.getEntries()
    .filter(entry => entry.id !== WELCOME_ENTRY_ID)
    .sort((a, b) => b.createdAt - a.createdAt);

  return (
    <div className="min-h-screen bg-twilight-bg dark:bg-nocturnal-bg">
      <div className="sticky top-0 z-10 bg-twilight-cream dark:bg-nocturnal-surface/80 border-b border-twilight-divider dark:border-nocturnal-secondary/25 backdrop-blur-sm">
        <div className="flex items-center gap-3 p-4">
          <button
            onClick={() => navigate('/settings')}
            className="p-2 hover:bg-twilight-cream/50 dark:hover:bg-nocturnal-bg/50 rounded-lg transition-colors"
            aria-label={t('settings_back')}
          >
            <ArrowLeft size={20} className="text-twilight-charcoal dark:text-nocturnal-primary" />
          </button>
          <div className="flex items-center gap-2">
            <Brain size={20} className="text-twilight-amber dark:text-nocturnal-accent" />
            <h1 className="text-lg font-semibold text-twilight-charcoal dark:text-nocturnal-primary">
              {t('memory_management')}
            </h1>
          </div>
        </div>
      </div>

      <div className="p-6 space-y-6 pb-24">
        {/* 自动提取 */}
        <section>
          <h3 className="text-xs font-bold uppercase tracking-wider text-twilight-duskLight dark:text-nocturnal-secondary mb-3">
            {t('memory_auto_extract')}
          </h3>
          <div className="bg-twilight-cream dark:bg-nocturnal-surface rounded-3xl p-4 border border-twilight-divider dark:border-nocturnal-secondary/25 shadow-sm [&>div:last-child]:border-b-0">
            {/* 自动提取记忆 */}
            <div className="flex items-center justify-between gap-4 py-3 border-b border-twilight-divider dark:border-nocturnal-secondary/25">
              <div>
                <p className="text-sm font-medium text-twilight-charcoal dark:text-nocturnal-primary">{t('memory_extraction_auto')}</p>
                <p className="text-[11px] text-twilight-duskLight dark:text-nocturnal-secondary mt-0.5">{t('memory_extraction_auto_hint')}</p>
              </div>
              <button
                onClick={() => {
                  const newValue = !(settings.memoryExtractionAuto !== false);
                  MockDataService.updateSettings({ memoryExtractionAuto: newValue });
                  setSettings({ ...settings, memoryExtractionAuto: newValue });
                }}
                className={`flex-shrink-0 w-12 h-7 rounded-full transition-colors ${
                  settings.memoryExtractionAuto !== false
                    ? 'bg-twilight-amber dark:bg-nocturnal-accent'
                    : 'bg-twilight-dusk/20 dark:bg-nocturnal-secondary/30'
                }`}
                role="switch"
                aria-checked={settings.memoryExtractionAuto !== false}
              >
                <span
                  className={`block w-5 h-5 mt-1 rounded-full bg-white dark:bg-nocturnal-primary shadow transition-transform ${
                    settings.memoryExtractionAuto !== false ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
            {/* 生成时检索记忆 */}
            <div className="flex items-center justify-between gap-4 py-3 border-b border-twilight-divider dark:border-nocturnal-secondary/25">
              <div>
                <p className="text-sm font-medium text-twilight-charcoal dark:text-nocturnal-primary">{t('memory_retrieval_enabled')}</p>
                <p className="text-[11px] text-twilight-duskLight dark:text-nocturnal-secondary mt-0.5">{t('memory_retrieval_enabled_hint')}</p>
              </div>
              <button
                onClick={() => {
                  const allMemories = IndexedDBStorage.getMemories();
                  if (allMemories.length < 100) {
                    showToast(t('memory_retrieval_require_min_count').replace('{count}', '100'), 'warning');
                    return;
                  }
                  const newValue = !(settings.memoryRetrievalEnabled === true);
                  MockDataService.updateSettings({ memoryRetrievalEnabled: newValue });
                  setSettings({ ...settings, memoryRetrievalEnabled: newValue });
                }}
                className={`flex-shrink-0 w-12 h-7 rounded-full transition-colors ${
                  settings.memoryRetrievalEnabled === true
                    ? 'bg-twilight-amber dark:bg-nocturnal-accent'
                    : 'bg-twilight-dusk/20 dark:bg-nocturnal-secondary/30'
                }`}
                role="switch"
                aria-checked={settings.memoryRetrievalEnabled === true}
              >
                <span
                  className={`block w-5 h-5 mt-1 rounded-full bg-white dark:bg-nocturnal-primary shadow transition-transform ${
                    settings.memoryRetrievalEnabled === true ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
          </div>
        </section>

        {/* 手动编辑 */}
        <section>
          <h3 className="text-xs font-bold uppercase tracking-wider text-twilight-duskLight dark:text-nocturnal-secondary mb-3">
            {t('memory_manual_edit')}
          </h3>
          <div className="space-y-4">
            {/* 手动提取记忆 */}
            <div className="bg-twilight-cream dark:bg-nocturnal-surface rounded-2xl p-4 border border-twilight-divider dark:border-nocturnal-secondary/25">
              <p className="text-sm font-medium text-twilight-charcoal dark:text-nocturnal-primary mb-3">
                {t('memory_extract_manual')}
              </p>
            <div className="flex gap-2">
              <select
                value={selectedEntryId}
                onChange={(e) => setSelectedEntryId(e.target.value)}
                className="flex-1 px-3 py-2 bg-white dark:bg-nocturnal-bg border border-twilight-divider dark:border-nocturnal-secondary/25 rounded-lg text-sm text-twilight-charcoal dark:text-nocturnal-primary"
              >
                <option value="">{t('memory_select_entry_placeholder')}</option>
                {entries.map(entry => (
                  <option key={entry.id} value={entry.id}>
                    {entry.title} ({new Date(entry.createdAt).toLocaleDateString()})
                  </option>
                ))}
              </select>
              <button
                onClick={handleExtractFromEntry}
                disabled={!selectedEntryId || isExtracting}
                className="px-4 py-2 bg-twilight-amber dark:bg-nocturnal-accent text-white rounded-lg text-sm font-medium hover:bg-twilight-amberMuted dark:hover:bg-nocturnal-accent/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
              >
                {isExtracting ? (
                  <>
                    <RefreshCw size={16} className="animate-spin" />
                    {t('memory_extracting')}
                  </>
                ) : (
                  <>
                    <Plus size={16} />
                    {t('memory_extract')}
                  </>
                )}
              </button>
            </div>
          </div>

            {/* 合并相似记忆和删除全部 */}
            <div className="flex gap-2">
              <button
                onClick={handleMergeSimilar}
                className="flex-1 px-4 py-2 bg-twilight-cream dark:bg-nocturnal-surface border border-twilight-divider dark:border-nocturnal-secondary/25 rounded-lg text-sm text-twilight-charcoal dark:text-nocturnal-primary hover:bg-twilight-cream/50 dark:hover:bg-nocturnal-bg/40 transition-colors flex items-center justify-center gap-2"
              >
                <RefreshCw size={16} />
                {t('memory_merge_similar')}
              </button>
              <button
                onClick={handleDeleteAllClick}
                disabled={memories.length === 0}
                className="px-4 py-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/30 text-red-600 dark:text-red-400 rounded-lg text-sm hover:bg-red-100 dark:hover:bg-red-900/30 disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
              >
                <AlertTriangle size={16} />
                {t('memory_delete_all')}
              </button>
            </div>
          </div>
        </section>

        {/* 记忆列表 */}
        <section>
          <h3 className="text-xs font-bold uppercase tracking-wider text-twilight-duskLight dark:text-nocturnal-secondary mb-3">
            {t('memory_list')}
          </h3>
          <div className="space-y-3">
          <div className="space-y-2">
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setFilterType('semantic')}
                className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                  filterType === 'semantic'
                    ? 'bg-twilight-amber dark:bg-nocturnal-accent text-white'
                    : 'bg-twilight-cream dark:bg-nocturnal-surface text-twilight-charcoal dark:text-nocturnal-primary border border-twilight-divider dark:border-nocturnal-secondary/25'
                }`}
              >
                {t('memory_type_semantic')}
              </button>
              <button
                onClick={() => setFilterType('episodic')}
                className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                  filterType === 'episodic'
                    ? 'bg-twilight-amber dark:bg-nocturnal-accent text-white'
                    : 'bg-twilight-cream dark:bg-nocturnal-surface text-twilight-charcoal dark:text-nocturnal-primary border border-twilight-divider dark:border-nocturnal-secondary/25'
                }`}
              >
                {t('memory_type_episodic')}
              </button>
              <button
                onClick={() => setFilterType('procedural')}
                className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                  filterType === 'procedural'
                    ? 'bg-twilight-amber dark:bg-nocturnal-accent text-white'
                    : 'bg-twilight-cream dark:bg-nocturnal-surface text-twilight-charcoal dark:text-nocturnal-primary border border-twilight-divider dark:border-nocturnal-secondary/25'
                }`}
              >
                {t('memory_type_procedural')}
              </button>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-twilight-duskLight dark:text-nocturnal-secondary">
                {filterType === 'semantic' && t('memory_type_semantic_desc')}
                {filterType === 'episodic' && t('memory_type_episodic_desc')}
                {filterType === 'procedural' && t('memory_type_procedural_desc')}
              </p>
              <p className="text-xs text-twilight-duskLight dark:text-nocturnal-secondary">
                {filterType === 'semantic' && t('memory_stored_count_semantic').replace('{count}', String(filteredMemories.length))}
                {filterType === 'episodic' && t('memory_stored_count_episodic').replace('{count}', String(filteredMemories.length))}
                {filterType === 'procedural' && t('memory_stored_count_procedural').replace('{count}', String(filteredMemories.length))}
              </p>
            </div>
          </div>
          {filteredMemories.length === 0 ? (
            <div className="text-center py-12 text-twilight-duskLight dark:text-nocturnal-secondary">
              <Brain size={48} className="mx-auto mb-4 opacity-30" />
              <p>{t('memory_empty')}</p>
            </div>
          ) : (
            <>
              <div className="bg-twilight-cream dark:bg-nocturnal-surface rounded-2xl border border-twilight-divider dark:border-nocturnal-secondary/25 overflow-hidden">
                {paginatedMemories.map((memory, index) => {
                const isEditing = editingId === memory.id;
                const getMemoryName = () => {
                  if (memory.type === 'semantic') {
                    return (memory as SemanticMemory).key;
                  } else if (memory.type === 'episodic') {
                    return (memory as EpisodicMemory).date;
                  } else {
                    return (memory as ProceduralMemory).pattern || (memory as ProceduralMemory).preference || '';
                  }
                };
                const getMemoryContent = () => {
                  if (memory.type === 'semantic') {
                    return (memory as SemanticMemory).value;
                  } else if (memory.type === 'episodic') {
                    const mem = memory as EpisodicMemory;
                    return `${mem.event}${mem.emotion ? ` (${mem.emotion})` : ''}`;
                  } else {
                    return (memory as ProceduralMemory).preference || (memory as ProceduralMemory).pattern || '';
                  }
                };
                return (
                  <div
                    key={memory.id}
                    className={`group flex items-start gap-3 px-4 py-3 hover:bg-twilight-cream/50 dark:hover:bg-nocturnal-bg/40 transition-colors ${
                      index < paginatedMemories.length - 1 ? 'border-b border-twilight-divider dark:border-nocturnal-secondary/25' : ''
                    }`}
                  >
                    {/* 左侧：记忆名称 */}
                    <div className={`flex-shrink-0 ${isEditing ? 'w-full' : 'w-32'}`}>
                      {isEditing ? (
                        <div className="space-y-3 w-full py-2">
                          {memory.type === 'semantic' && (
                            <>
                              <input
                                type="text"
                                value={(editDraft as SemanticMemory).key || ''}
                                onChange={(e) => setEditDraft({ ...editDraft, key: e.target.value })}
                                placeholder={t('memory_key_placeholder')}
                                className="w-full px-3 py-2 bg-white dark:bg-nocturnal-bg border border-twilight-divider dark:border-nocturnal-secondary/25 rounded-lg text-sm"
                              />
                              <textarea
                                value={(editDraft as SemanticMemory).value || ''}
                                onChange={(e) => setEditDraft({ ...editDraft, value: e.target.value })}
                                placeholder={t('memory_value_placeholder')}
                                rows={4}
                                className="w-full px-3 py-2 bg-white dark:bg-nocturnal-bg border border-twilight-divider dark:border-nocturnal-secondary/25 rounded-lg text-sm resize-y min-h-[100px]"
                              />
                            </>
                          )}
                          {memory.type === 'episodic' && (
                            <>
                              <textarea
                                value={(editDraft as EpisodicMemory).event || ''}
                                onChange={(e) => setEditDraft({ ...editDraft, event: e.target.value })}
                                placeholder={t('memory_event_placeholder')}
                                rows={4}
                                className="w-full px-3 py-2 bg-white dark:bg-nocturnal-bg border border-twilight-divider dark:border-nocturnal-secondary/25 rounded-lg text-sm resize-y min-h-[100px]"
                              />
                              <input
                                type="text"
                                value={(editDraft as EpisodicMemory).emotion || ''}
                                onChange={(e) => setEditDraft({ ...editDraft, emotion: e.target.value })}
                                placeholder={t('memory_emotion_placeholder')}
                                className="w-full px-3 py-2 bg-white dark:bg-nocturnal-bg border border-twilight-divider dark:border-nocturnal-secondary/25 rounded-lg text-sm"
                              />
                            </>
                          )}
                          {memory.type === 'procedural' && (
                            <>
                              <textarea
                                value={(editDraft as ProceduralMemory).pattern || ''}
                                onChange={(e) => setEditDraft({ ...editDraft, pattern: e.target.value })}
                                placeholder={t('memory_pattern_placeholder')}
                                rows={3}
                                className="w-full px-3 py-2 bg-white dark:bg-nocturnal-bg border border-twilight-divider dark:border-nocturnal-secondary/25 rounded-lg text-sm resize-y min-h-[80px]"
                              />
                              <textarea
                                value={(editDraft as ProceduralMemory).preference || ''}
                                onChange={(e) => setEditDraft({ ...editDraft, preference: e.target.value })}
                                placeholder={t('memory_preference_placeholder')}
                                rows={3}
                                className="w-full px-3 py-2 bg-white dark:bg-nocturnal-bg border border-twilight-divider dark:border-nocturnal-secondary/25 rounded-lg text-sm resize-y min-h-[80px]"
                              />
                            </>
                          )}
                          <div className="flex gap-2">
                            <button
                              onClick={saveEdit}
                              className="px-4 py-2 bg-twilight-amber dark:bg-nocturnal-accent text-white rounded-lg text-sm font-medium hover:bg-twilight-amberMuted dark:hover:bg-nocturnal-accent/90 transition-colors"
                            >
                              {t('save')}
                            </button>
                            <button
                              onClick={cancelEdit}
                              className="px-4 py-2 bg-twilight-cream dark:bg-nocturnal-surface border border-twilight-divider dark:border-nocturnal-secondary/25 rounded-lg text-sm hover:bg-twilight-cream/50 dark:hover:bg-nocturnal-bg/40 transition-colors"
                            >
                              {t('cancel')}
                            </button>
                            <button
                              onClick={() => {
                                if (confirm(t('memory_delete_confirm'))) {
                                  handleDelete(memory.id);
                                  cancelEdit();
                                }
                              }}
                              className="px-4 py-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/30 text-red-600 dark:text-red-400 rounded-lg text-sm hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors"
                            >
                              {t('memory_delete')}
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div>
                          <p className="text-xs font-medium text-twilight-charcoal dark:text-nocturnal-primary truncate">
                            {getMemoryName()}
                          </p>
                          <p className="text-[10px] text-twilight-duskLight dark:text-nocturnal-secondary mt-0.5">
                            {memory.type === 'semantic' && t('memory_type_semantic')}
                            {memory.type === 'episodic' && t('memory_type_episodic')}
                            {memory.type === 'procedural' && t('memory_type_procedural')}
                          </p>
                        </div>
                      )}
                    </div>

                    {/* 右侧：记忆内容或编辑输入 */}
                    {isEditing ? (
                      <div className="flex-1 min-w-0">
                        {/* 编辑模式已在左侧显示输入框 */}
                      </div>
                    ) : (
                      <>
                        <div 
                          className="flex-1 min-w-0 cursor-pointer"
                          onDoubleClick={() => startEdit(memory)}
                          title={t('double_click_to_edit')}
                        >
                          <p 
                            className="text-sm text-twilight-charcoal dark:text-nocturnal-primary"
                            style={{
                              display: '-webkit-box',
                              WebkitLineClamp: 2,
                              WebkitBoxOrient: 'vertical',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              wordBreak: 'break-word'
                            }}
                          >
                            {getMemoryContent()}
                          </p>
                          {memory.type === 'semantic' && (
                            <p className="text-[10px] text-twilight-duskLight dark:text-nocturnal-secondary mt-1">
                              {t('memory_confidence')}: {Math.round((memory as SemanticMemory).confidence * 100)}%
                            </p>
                          )}
                          {memory.type === 'procedural' && (
                            <p className="text-[10px] text-twilight-duskLight dark:text-nocturnal-secondary mt-1">
                              {t('memory_frequency')}: {(memory as ProceduralMemory).frequency}
                            </p>
                          )}
                        </div>

                      </>
                    )}
                  </div>
                );
                })}
              </div>

              {/* 翻页控件 */}
              {totalPages > 1 && (
                <div className="flex items-center justify-center gap-2 pt-4">
                  <button
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="p-2 rounded-lg bg-twilight-cream dark:bg-nocturnal-surface border border-twilight-divider dark:border-nocturnal-secondary/25 text-twilight-charcoal dark:text-nocturnal-primary hover:bg-twilight-cream/50 dark:hover:bg-nocturnal-bg/40 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                    aria-label={t('previous_page')}
                  >
                    <ChevronLeft size={18} />
                  </button>
                  
                  <div className="flex items-center gap-1">
                    {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                      let pageNum: number;
                      if (totalPages <= 5) {
                        pageNum = i + 1;
                      } else if (currentPage <= 3) {
                        pageNum = i + 1;
                      } else if (currentPage >= totalPages - 2) {
                        pageNum = totalPages - 4 + i;
                      } else {
                        pageNum = currentPage - 2 + i;
                      }
                      
                      return (
                        <button
                          key={pageNum}
                          onClick={() => setCurrentPage(pageNum)}
                          className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                            currentPage === pageNum
                              ? 'bg-twilight-amber dark:bg-nocturnal-accent text-white'
                              : 'bg-twilight-cream dark:bg-nocturnal-surface text-twilight-charcoal dark:text-nocturnal-primary border border-twilight-divider dark:border-nocturnal-secondary/25 hover:bg-twilight-cream/50 dark:hover:bg-nocturnal-bg/40'
                          }`}
                        >
                          {pageNum}
                        </button>
                      );
                    })}
                  </div>

                  <button
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    className="p-2 rounded-lg bg-twilight-cream dark:bg-nocturnal-surface border border-twilight-divider dark:border-nocturnal-secondary/25 text-twilight-charcoal dark:text-nocturnal-primary hover:bg-twilight-cream/50 dark:hover:bg-nocturnal-bg/40 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                    aria-label={t('next_page')}
                  >
                    <ChevronRight size={18} />
                  </button>
                </div>
              )}
            </>
          )}
          </div>
        </section>
      </div>

      {/* 删除全部记忆 - 第一次确认 */}
      {showDeleteAllModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/20" onClick={() => setShowDeleteAllModal(false)}>
          <div
            className="bg-twilight-cream dark:bg-nocturnal-surface rounded-2xl p-6 max-w-sm w-full mx-4 shadow-xl border border-twilight-divider dark:border-nocturnal-secondary/20"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 mb-3">
              <div className="flex-shrink-0 w-10 h-10 rounded-full bg-red-50 dark:bg-red-900/40 flex items-center justify-center">
                <AlertTriangle size={20} className="text-red-600 dark:text-red-400" />
              </div>
              <h3 className="serif text-xl font-semibold text-twilight-charcoal dark:text-nocturnal-primary">
                {t('memory_delete_all')}
              </h3>
            </div>
            <p className="text-twilight-warm dark:text-nocturnal-secondary text-sm mb-4">
              {t('memory_delete_all_confirm')}
            </p>
            <div className="flex flex-col gap-2">
              <button
                onClick={handleDeleteAllConfirm}
                className="w-full py-3 px-4 bg-red-600 text-white rounded-xl font-medium hover:bg-red-700 transition-colors"
              >
                {t('memory_delete_all')}
              </button>
              <button
                onClick={() => setShowDeleteAllModal(false)}
                className="w-full py-2 text-twilight-duskLight dark:text-nocturnal-secondary text-sm hover:text-twilight-warm dark:hover:text-nocturnal-primary"
              >
                {t('cancel')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 删除全部记忆 - 第二次确认 */}
      {showDeleteAllConfirm && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/20" onClick={() => setShowDeleteAllConfirm(false)}>
          <div
            className="bg-twilight-cream dark:bg-nocturnal-surface rounded-2xl p-6 max-w-sm w-full mx-4 shadow-xl border border-red-200 dark:border-red-800/30"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 mb-3">
              <div className="flex-shrink-0 w-10 h-10 rounded-full bg-red-50 dark:bg-red-900/40 flex items-center justify-center">
                <AlertTriangle size={20} className="text-red-600 dark:text-red-400" />
              </div>
              <h3 className="serif text-xl font-semibold text-red-600 dark:text-red-400">
                {t('memory_delete_all_final_title')}
              </h3>
            </div>
            <p className="text-red-700 dark:text-red-300 text-sm mb-4 font-medium">
              {t('memory_delete_all_confirm_final')}
            </p>
            <div className="flex flex-col gap-2">
              <button
                onClick={handleDeleteAllFinal}
                className="w-full py-3 px-4 bg-red-600 text-white rounded-xl font-medium hover:bg-red-700 transition-colors"
              >
                {t('memory_delete_all_confirm_btn')}
              </button>
              <button
                onClick={() => setShowDeleteAllConfirm(false)}
                className="w-full py-2 text-twilight-duskLight dark:text-nocturnal-secondary text-sm hover:text-twilight-warm dark:hover:text-nocturnal-primary"
              >
                {t('cancel')}
              </button>
            </div>
          </div>
        </div>
      )}

      <ToastContainer />
    </div>
  );
};

export default MemoryManagementView;
