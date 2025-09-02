// 知识库表单组件

import React, { useState, useEffect, useRef } from 'react';
import { X, Save, Loader2 } from 'lucide-react';
import { useKnowledgeStore } from '../../stores/knowledgeStore';
import type { CreateKnowledgeBaseRequest, UpdateKnowledgeBaseRequest, KnowledgeBase } from '../../types/knowledge';

interface KnowledgeBaseFormProps {
  knowledgeBase?: KnowledgeBase;
  isOpen: boolean;
  onCancel: () => void;
  onSuccess: () => void;
}

export const KnowledgeBaseForm: React.FC<KnowledgeBaseFormProps> = ({ knowledgeBase, isOpen, onCancel, onSuccess }) => {
  const modalRef = useRef<HTMLDialogElement>(null);
  const {
    currentKnowledgeBase,
    managementState,
    loading,
    createKnowledgeBase,
    updateKnowledgeBase,
    performAction
  } = useKnowledgeStore();

  const [formData, setFormData] = useState({
    name: '',
    description: ''
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  const isEditing = !!knowledgeBase;

  useEffect(() => {
    if (isEditing && knowledgeBase) {
      setFormData({
        name: knowledgeBase.name,
        description: knowledgeBase.description || ''
      });
    } else {
      setFormData({ name: '', description: '' });
    }
  }, [isEditing, knowledgeBase]);

  useEffect(() => {
    if (isOpen) {
      modalRef.current?.showModal();
    } else {
      modalRef.current?.close();
    }
  }, [isOpen]);

  const handleClose = () => {
    if (modalRef.current) {
      modalRef.current.close();
    }
    onCancel();
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.name.trim()) {
      newErrors.name = '知识库名称不能为空';
    } else if (formData.name.trim().length < 2) {
      newErrors.name = '知识库名称至少需要2个字符';
    } else if (formData.name.trim().length > 50) {
      newErrors.name = '知识库名称不能超过50个字符';
    }

    if (formData.description && formData.description.length > 500) {
      newErrors.description = '描述不能超过500个字符';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    try {
      if (isEditing && knowledgeBase) {
        const updateRequest: UpdateKnowledgeBaseRequest = {
          name: formData.name.trim(),
          description: formData.description.trim() || undefined
        };
        await updateKnowledgeBase(knowledgeBase.id, updateRequest);
      } else {
        const createRequest: CreateKnowledgeBaseRequest = {
          name: formData.name.trim(),
          description: formData.description.trim() || undefined
        };
        await createKnowledgeBase(createRequest);
      }
      
      if (modalRef.current) {
        modalRef.current.close();
      }
      onSuccess();
    } catch (error) {
      console.error('保存知识库失败:', error);
    }
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // 清除对应字段的错误
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  return (
    <dialog ref={modalRef} className="modal">
      <div className="modal-box w-full max-w-md">
        {/* 表单头部 */}
        <div className="flex items-center gap-4 mb-6">
          <button
            onClick={handleClose}
            className="btn btn-ghost btn-circle"
          >
            <X className="w-5 h-5" />
          </button>
          <h3 className="text-xl font-semibold text-base-content">
            {isEditing ? '编辑知识库' : '创建知识库'}
          </h3>
        </div>

        {/* 表单内容 */}
        <form onSubmit={handleSubmit}>
          {/* 知识库名称 */}
          <div className="form-control mb-4">
            <label className="label">
              <span className="label-text">
                知识库名称 <span className="text-error">*</span>
              </span>
            </label>
            <input
              type="text"
              id="name"
              value={formData.name}
              onChange={(e) => handleInputChange('name', e.target.value)}
              className={`input input-bordered w-full ${
                errors.name ? 'input-error' : ''
              }`}
              placeholder="请输入知识库名称"
              maxLength={50}
            />
            {errors.name && (
              <label className="label">
                <span className="label-text-alt text-error">{errors.name}</span>
              </label>
            )}
            <label className="label">
              <span className="label-text-alt">
                {formData.name.length}/50 字符
              </span>
            </label>
          </div>

          {/* 知识库描述 */}
          <div className="form-control mb-6">
            <label className="label">
              <span className="label-text">描述</span>
            </label>
            <textarea
              id="description"
              value={formData.description}
              onChange={(e) => handleInputChange('description', e.target.value)}
              rows={3}
              className={`textarea textarea-bordered w-full resize-none ${
                errors.description ? 'textarea-error' : ''
              }`}
              placeholder="请输入知识库描述（可选）"
              maxLength={500}
            />
            {errors.description && (
              <label className="label">
                <span className="label-text-alt text-error">{errors.description}</span>
              </label>
            )}
            <label className="label">
              <span className="label-text-alt">
                {formData.description.length}/500 字符
              </span>
            </label>
          </div>

          {/* 表单按钮 */}
          <div className="modal-action">
            <form method="dialog">
              <button
                type="button"
                onClick={handleClose}
                className="btn btn-ghost"
                disabled={loading}
              >
                取消
              </button>
            </form>
            <button
              type="submit"
              disabled={loading || !formData.name.trim()}
              className="btn btn-primary gap-2"
            >
              {loading ? (
                <span className="loading loading-spinner loading-sm"></span>
              ) : (
                <Save className="w-4 h-4" />
              )}
              {isEditing ? '保存' : '创建'}
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