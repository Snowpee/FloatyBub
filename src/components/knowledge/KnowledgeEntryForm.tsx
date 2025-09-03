// 知识条目表单组件

import React, { useState, useEffect, useRef } from 'react';
import { X, Save, Loader2, Plus, Minus, Tag } from 'lucide-react';
import { useKnowledgeStore } from '../../stores/knowledgeStore';
import type { KnowledgeBase, KnowledgeEntry, CreateKnowledgeEntryRequest, UpdateKnowledgeEntryRequest } from '../../types/knowledge';

interface KnowledgeEntryFormProps {
  knowledgeBase: KnowledgeBase;
  entry?: KnowledgeEntry | null;
  isOpen: boolean;
  onCancel: () => void;
}

export const KnowledgeEntryForm: React.FC<KnowledgeEntryFormProps> = ({
  knowledgeBase,
  entry,
  isOpen,
  onCancel
}) => {
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
    if (isEditing && entry) {
      setFormData({
        name: entry.name,
        keywords: entry.keywords.length > 0 ? entry.keywords : [''],
        explanation: entry.explanation
      });
    } else {
      setFormData({ name: '', keywords: [''], explanation: '' });
    }
  }, [isEditing, entry]);

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

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
      
      performAction('cancel');
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

  const handleKeywordChange = (index: number, value: string) => {
    const newKeywords = [...formData.keywords];
    newKeywords[index] = value;
    setFormData(prev => ({ ...prev, keywords: newKeywords }));
    
    // 清除关键词错误
    if (errors.keywords) {
      setErrors(prev => ({ ...prev, keywords: '' }));
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

  const modalRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    if (isOpen) {
      modalRef.current?.showModal();
    } else {
      modalRef.current?.close();
    }
  }, [isOpen]);

  const handleClose = () => {
    modalRef.current?.close();
    onCancel();
  };

  return (
    <dialog ref={modalRef} className="modal">
      <div className="modal-box w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* 表单头部 */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-base-content">
            {isEditing ? '编辑知识条目' : '添加知识条目'}
          </h2>
          <button
            onClick={handleClose}
            className="btn btn-sm btn-circle btn-ghost"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 表单内容 */}
        <form onSubmit={handleSubmit}>
          <div className="space-y-4">
            {/* 条目名称 */}
            <fieldset className="fieldset">
              <legend className="fieldset-legend">条目名称 *</legend>
              <input
                type="text"
                id="name"
                value={formData.name}
                onChange={(e) => handleInputChange('name', e.target.value)}
                className={`input input-bordered w-full ${
                  errors.name ? 'input-error' : ''
                }`}
                placeholder="请输入条目名称"
                maxLength={100}
              />
              {errors.name && (
                <label className="label label-padding">
                  <span className="label-text-alt text-error">{errors.name}</span>
                </label>
              )}
              <label className="label">
                <span className="label-text-alt">
                  {formData.name.length}/100 字符
                </span>
              </label>
            </fieldset>

            {/* 关键词 */}
            <fieldset className="fieldset">
              <legend className="fieldset-legend">关键词 *</legend>
              <div className="space-y-3">
                {/* 关键词标签列表 */}
                <div className="flex flex-wrap gap-2">
                  {formData.keywords.filter(k => k.trim()).map((keyword, index) => (
                    <div key={index} className="badge border-base-content/10 bg-base-200 gap-2 px-3 py-0 h-auto">
                      <span className="text-sm">{keyword}</span>
                      <button
                        type="button"
                        onClick={() => removeKeyword(index)}
                        className="btn btn-ghost btn-xs btn-circle text-error hover:bg-error hover:text-error-content ml-1"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}

                  {/* 新建关键词输入框或按钮 */}
                  {isAddingKeyword ? (
                    <div className="badge gap-2 px-0 py-0 h-auto border-none">
                      <input
                        type="text"
                        value={newKeywordValue}
                        onChange={(e) => setNewKeywordValue(e.target.value)}
                        onKeyDown={handleNewKeywordKeyPress}
                        onBlur={confirmAddKeyword}
                        className="input bg-transparent text-sm text-content placeholder-primary-content/70 w-20 min-w-[80px]"
                        placeholder="输入关键词"
                        maxLength={50}
                        autoFocus
                      />
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={startAddingKeyword}
                      className="btn btn-dash border-base-content/20 gap-1 px-3 py-2 h-auto cursor-pointer transition-colors"
                    >
                      <Plus className="w-3 h-3" />
                      <span className="text-sm">新建</span>
                    </button>
                  )}
                </div>
              </div>

              {errors.keywords && (
                <label className="label">
                  <span className="label-text-alt text-error">{errors.keywords}</span>
                </label>
              )}
            </fieldset>

            {/* 解释内容 */}
            <fieldset className="fieldset">
              <legend className="fieldset-legend">解释内容 *</legend>
              <textarea
                id="explanation"
                value={formData.explanation}
                onChange={(e) => handleInputChange('explanation', e.target.value)}
                rows={8}
                className={`textarea textarea-bordered w-full resize-none ${
                  errors.explanation ? 'textarea-error' : ''
                }`}
                placeholder="请输入详细的解释内容，这将作为系统提示词插入到聊天中"
                maxLength={2000}
              />
              {errors.explanation && (
                <label className="label">
                  <span className="label-text-alt text-error">{errors.explanation}</span>
                </label>
              )}
              <label className="label">
                <span className="label-text-alt">
                  {formData.explanation.length}/2000 字符
                </span>
              </label>
            </fieldset>
          </div>

          {/* 表单按钮 */}
          <div className="modal-action">
            <button
              type="button"
              onClick={handleClose}
              className="btn btn-ghost"
              disabled={loading}
            >
              取消
            </button>
            <button
              type="submit"
              disabled={loading || !formData.name.trim() || !formData.explanation.trim()}
              className="btn btn-primary gap-2"
            >
              {loading ? (
                <span className="loading loading-spinner loading-sm"></span>
              ) : (
                <Save className="w-4 h-4" />
              )}
              {isEditing ? '保存' : '添加'}
            </button>
          </div>
        </form>
      </div>
      <form method="dialog" className="modal-backdrop">
        <button onClick={handleClose}>close</button>
      </form>
    </dialog>
  );
};