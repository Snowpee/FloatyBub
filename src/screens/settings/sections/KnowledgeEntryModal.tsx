import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X, Save, Plus, Check } from 'lucide-react';
import { InputProvider } from '../../../components/InputProvider';
import { useKnowledgeStore } from '../../../store/knowledgeStore';
import type { KnowledgeBase, KnowledgeEntry, CreateKnowledgeEntryRequest, UpdateKnowledgeEntryRequest } from '../../../types/knowledge';
import BottomSheetModal from '../../../components/BottomSheetModal';

interface KnowledgeEntryModalProps {
  knowledgeBase: KnowledgeBase;
  entry?: KnowledgeEntry | null;
  isOpen: boolean;
  onCancel: () => void;
}

const KnowledgeEntryModal: React.FC<KnowledgeEntryModalProps> = ({
  knowledgeBase,
  entry,
  isOpen,
  onCancel
}) => {
  // 简单的桌面端检测逻辑
  const [isDesktop, setIsDesktop] = useState(false);

  useEffect(() => {
    // 初始化检测
    setIsDesktop(window.innerWidth >= 1024);

    const checkDesktop = () => {
      setIsDesktop(window.innerWidth >= 1024);
    };
    
    window.addEventListener('resize', checkDesktop);
    return () => window.removeEventListener('resize', checkDesktop);
  }, []);

  const {
    loading,
    createKnowledgeEntry,
    updateKnowledgeEntry,
    performAction
  } = useKnowledgeStore();

  const [formData, setFormData] = useState({
    name: '',
    keywords: [''],
    explanation: ''
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isAddingKeyword, setIsAddingKeyword] = useState(false);
  const [newKeywordValue, setNewKeywordValue] = useState('');

  const isEditing = !!entry;

  useEffect(() => {
    if (isOpen) {
      if (isEditing && entry) {
        setFormData({
          name: entry.name,
          keywords: entry.keywords.length > 0 ? entry.keywords : [''],
          explanation: entry.explanation
        });
      } else {
        setFormData({ name: '', keywords: [''], explanation: '' });
      }
      setErrors({});
      setIsAddingKeyword(false);
      setNewKeywordValue('');
    }
  }, [isOpen, isEditing, entry]);

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.name.trim()) {
      newErrors.name = '条目名称不能为空';
    } else if (formData.name.trim().length < 2) {
      newErrors.name = '条目名称至少需要2个字符';
    } else if (formData.name.trim().length > 100) {
      newErrors.name = '条目名称不能超过100个字符';
    }

    const validKeywords = formData.keywords.filter(k => k.trim());
    if (validKeywords.length === 0) {
      newErrors.keywords = '至少需要一个关键词';
    } else if (validKeywords.some(k => k.trim().length > 50)) {
      newErrors.keywords = '关键词长度不能超过50个字符';
    }

    if (!formData.explanation.trim()) {
      newErrors.explanation = '解释内容不能为空';
    } else if (formData.explanation.trim().length < 5) {
      newErrors.explanation = '解释内容至少需要5个字符';
    } else if (formData.explanation.trim().length > 2000) {
      newErrors.explanation = '解释内容不能超过2000个字符';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validateForm()) {
      return;
    }

    const validKeywords = formData.keywords.filter(k => k.trim()).map(k => k.trim());

    try {
      if (isEditing && entry) {
        const updateRequest: UpdateKnowledgeEntryRequest = {
          name: formData.name.trim(),
          keywords: validKeywords,
          explanation: formData.explanation.trim()
        };
        await updateKnowledgeEntry(entry.id, updateRequest);
      } else {
        const createRequest: CreateKnowledgeEntryRequest = {
          name: formData.name.trim(),
          keywords: validKeywords,
          explanation: formData.explanation.trim(),
          knowledge_base_id: knowledgeBase.id
        };
        await createKnowledgeEntry(createRequest);
      }
      
      onCancel();
    } catch (error) {
      console.error('保存知识条目失败:', error);
    }
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // 清除对应字段的错误
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  const startAddingKeyword = () => {
    setIsAddingKeyword(true);
    setNewKeywordValue('');
  };

  const confirmAddKeyword = () => {
    if (newKeywordValue.trim()) {
      setFormData(prev => ({
        ...prev,
        keywords: [...prev.keywords.filter(k => k.trim()), newKeywordValue.trim()]
      }));
    }
    setIsAddingKeyword(false);
    setNewKeywordValue('');
    
    // 清除关键词错误
    if (errors.keywords) {
      setErrors(prev => ({ ...prev, keywords: '' }));
    }
  };

  const cancelAddKeyword = () => {
    setIsAddingKeyword(false);
    setNewKeywordValue('');
  };

  const removeKeyword = (index: number) => {
    const newKeywords = formData.keywords.filter((_, i) => i !== index);
    setFormData(prev => ({ ...prev, keywords: newKeywords }));
  };

  const handleNewKeywordKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      confirmAddKeyword();
    } else if (e.key === 'Escape') {
      cancelAddKeyword();
    }
  };

  const FormContent = (
    <InputProvider>
      <div className="flex flex-col gap-4">
        <fieldset className='bub-fieldset py-4'>
        {/* 条目名称 */}
        <div>
          <label className='bub-input'>
            <span className="label">条目名称 *</span>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => handleInputChange('name', e.target.value)}
              placeholder="请输入条目名称"
              maxLength={100}
              className={errors.name ? 'input-error' : ''}
            />
          </label>
          {errors.name && (
            <label className="label py-1">
              <span className="label-text-alt text-error">{errors.name}</span>
            </label>
          )}
          <label className="label py-1">
            <span className="label-text-alt opacity-50">
              {formData.name.length}/100 字符
            </span>
          </label>
        </div>

        {/* 关键词 */}
        <div>
          <label className="label">
            <span className="label-text font-medium">关键词 *</span>
          </label>
          <div className="flex flex-wrap gap-2 mb-2 p-2 border border-base-300 rounded-lg min-h-[3rem]">
            {formData.keywords.filter(k => k.trim()).map((keyword, index) => (
              <div key={index} className="badge badge-primary gap-2 h-auto py-1">
                <span>{keyword}</span>
                <button
                  type="button"
                  onClick={() => removeKeyword(index)}
                  className="btn btn-ghost btn-xs btn-circle text-primary-content hover:bg-primary-focus"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}

            {isAddingKeyword ? (
              <div className="flex items-center gap-1">
                <input
                  type="text"
                  value={newKeywordValue}
                  onChange={(e) => setNewKeywordValue(e.target.value)}
                  onKeyDown={handleNewKeywordKeyPress}
                  onBlur={confirmAddKeyword}
                  className="input input-bordered input-xs w-24"
                  placeholder="输入关键词"
                  maxLength={50}
                  autoFocus
                />
              </div>
            ) : (
              <button
                type="button"
                onClick={startAddingKeyword}
                className="btn btn-ghost btn-xs gap-1 border border-base-300 border-dashed"
              >
                <Plus className="w-3 h-3" />
                <span className="text-xs">添加</span>
              </button>
            )}
          </div>
          {errors.keywords && (
            <label className="label py-1">
              <span className="label-text-alt text-error">{errors.keywords}</span>
            </label>
          )}
        </div>

        {/* 解释内容 */}
        <div>
          <div className='bub-textarea'>
            <span className="label">解释内容 *</span>
            <textarea
              value={formData.explanation}
              onChange={(e) => handleInputChange('explanation', e.target.value)}
              rows={8}
              className={`w-full pt-8 ${errors.explanation ? 'textarea-error' : ''}`}
              placeholder="请输入详细的解释内容，这将作为系统提示词插入到聊天中"
              maxLength={2000}
            />
          </div>
          {errors.explanation && (
            <label className="label py-1">
              <span className="label-text-alt text-error">{errors.explanation}</span>
            </label>
          )}
          <label className="label py-1">
            <span className="label-text-alt opacity-50">
              {formData.explanation.length}/2000 字符
            </span>
          </label>
        </div>
      </fieldset>
      </div>
    </InputProvider>
  );

  if (!isOpen) return null;

  // 桌面端渲染
  if (isDesktop) {
    return createPortal(
      <dialog className="modal modal-open modal-middle" open>
        <div className="modal-box w-11/12 max-w-2xl p-0 flex flex-col bg-base-200 shadow-2xl">
          {/* Header */}
          <div className="px-6 py-4 flex items-center justify-between border-b border-base-200">
            <div className="text-lg font-bold text-base-content">
              {isEditing ? '编辑知识条目' : '添加知识条目'}
            </div>
            <button className="btn btn-sm btn-circle btn-ghost" onClick={onCancel}>
              <X className="h-5 w-5" />
            </button>
          </div>
          
          {/* Content */}
          <div className="px-6 py-4 overflow-y-auto max-h-[70vh]">
            {FormContent}
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-base-200 flex justify-end gap-2">
            <button className="btn" onClick={onCancel} disabled={loading}>取消</button>
            <button 
              className="btn btn-primary" 
              onClick={handleSubmit}
              disabled={loading || !formData.name.trim() || !formData.explanation.trim()}
            >
              {loading ? (
                <span className="loading loading-spinner loading-sm"></span>
              ) : (
                <Save className="h-4 w-4 mr-1" />
              )}
              {isEditing ? '保存' : '添加'}
            </button>
          </div>
        </div>
        
        <form method="dialog" className="modal-backdrop">
          <button onClick={onCancel}>close</button>
        </form>
      </dialog>,
      document.body
    );
  }

  // 移动端渲染
  return createPortal(
    <BottomSheetModal
      isOpen={isOpen}
      onOpenChange={(open) => {
        if (!open) onCancel();
      }}
      onClose={onCancel}
      dismissible={true}
      dragEnabled={true}
      distanceThreshold={120}
      velocityThreshold={0.5}
      rubberband={true}
      safeArea={true}
      headerTitle={<div className="text-center text-lg font-semibold text-base-content">{isEditing ? '编辑知识条目' : '添加知识条目'}</div>}
      rightActions={[
        { 
          icon: loading ? <span className="loading loading-spinner loading-sm"></span> : <Check className="h-5 w-5" />, 
          className: 'btn btn-primary btn-square', 
          onClick: handleSubmit,
          disabled: loading || !formData.name.trim() || !formData.explanation.trim()
        }
      ]}
      leftActions={[
        {
          icon: <X className="h-5 w-5" />,
          className: 'btn btn-ghost btn-square bg-base-100',
          role: 'close'
        }
      ]}
    >
      <div className="flex-1 overflow-hidden">
        <div className="h-full overflow-y-auto px-4 pb-8">
          {FormContent}
        </div>
      </div>
    </BottomSheetModal>,
    document.body
  );
};

export default KnowledgeEntryModal;
