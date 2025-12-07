import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X, Save, Check } from 'lucide-react';
import { InputProvider } from '../../../components/InputProvider';
import { useKnowledgeStore } from '../../../store/knowledgeStore';
import type { CreateKnowledgeBaseRequest, UpdateKnowledgeBaseRequest, KnowledgeBase } from '../../../types/knowledge';
import BottomSheetModal from '../../../components/BottomSheetModal';

interface KnowledgeBaseModalProps {
  knowledgeBase?: KnowledgeBase | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const KnowledgeBaseModal: React.FC<KnowledgeBaseModalProps> = ({ knowledgeBase, isOpen, onClose, onSuccess }) => {
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
    createKnowledgeBase,
    updateKnowledgeBase
  } = useKnowledgeStore();

  const [formData, setFormData] = useState({
    name: '',
    description: ''
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  const isEditing = !!knowledgeBase;

  useEffect(() => {
    if (isOpen) {
      if (isEditing && knowledgeBase) {
        setFormData({
          name: knowledgeBase.name,
          description: knowledgeBase.description || ''
        });
      } else {
        setFormData({ name: '', description: '' });
      }
      setErrors({});
    }
  }, [isOpen, isEditing, knowledgeBase]);

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

  const handleSubmit = async () => {
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
      
      onSuccess();
      onClose();
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

  const FormContent = (
    <InputProvider>
      <div className="flex flex-col gap-4" >
        <fieldset className='bub-fieldset pb-3'>
        <div>
          <div className='bub-input bub-input-ht'>
            <label>
              <span className='label'>知识库名称 *</span>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => handleInputChange('name', e.target.value)}
                placeholder="请输入知识库名称"
                maxLength={50}
                className={errors.name ? 'input-error' : ''}
              />
            </label>
            <span>
              {errors.name && (
                <span className="text-error">{errors.name}</span>
              )}
                <span>
                  {formData.name.length}/50 字符
                </span>
            </span>

          </div>
        </div>
        <div>
          <div className='bub-textarea'>
            <span className="label">描述</span>
            <textarea
              value={formData.description}
              onChange={(e) => handleInputChange('description', e.target.value)}
              rows={3}
              className={`w-full pt-8 ${errors.description ? 'textarea-error' : ''}`}
              placeholder="请输入知识库描述（可选）"
              maxLength={500}
            />
          </div>
          {errors.description && (
              <span className="label text-xs text-error">{errors.description}</span>
          )}
            <span className="label text-xs">
              {formData.description.length}/500 字符
            </span>
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
        <div className="modal-box w-11/12 max-w-lg p-0 flex flex-col bg-base-200 shadow-2xl">
          {/* Header */}
          <div className="px-6 py-4 flex items-center justify-between border-b border-base-200">
            <div className="text-lg font-bold text-base-content">
              {isEditing ? '编辑知识库' : '创建知识库'}
            </div>
            <button className="btn btn-sm btn-circle btn-ghost" onClick={onClose}>
              <X className="h-5 w-5" />
            </button>
          </div>
          
          {/* Content */}
          <div className="px-6 py-4">
            {FormContent}
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-base-200 flex justify-end gap-2">
            <button className="btn" onClick={onClose} disabled={loading}>取消</button>
            <button 
              className="btn btn-primary" 
              onClick={handleSubmit}
              disabled={loading || !formData.name.trim()}
            >
              {loading ? (
                <span className="loading loading-spinner loading-sm"></span>
              ) : (
                <Save className="h-4 w-4 mr-1" />
              )}
              {isEditing ? '保存' : '创建'}
            </button>
          </div>
        </div>
        
        <form method="dialog" className="modal-backdrop">
          <button onClick={onClose}>close</button>
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
        if (!open) onClose();
      }}
      onClose={onClose}
      dismissible={true}
      dragEnabled={true}
      distanceThreshold={120}
      velocityThreshold={0.5}
      rubberband={true}
      safeArea={true}
      headerTitle={<div className="text-center text-lg font-semibold text-base-content">{isEditing ? '编辑知识库' : '创建知识库'}</div>}
      rightActions={[
        { 
          icon: loading ? <span className="loading loading-spinner loading-sm"></span> : <Check className="h-5 w-5" />, 
          className: 'btn btn-primary btn-square', 
          onClick: handleSubmit,
          disabled: loading || !formData.name.trim()
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

export default KnowledgeBaseModal;
