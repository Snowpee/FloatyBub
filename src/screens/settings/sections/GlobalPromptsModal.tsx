import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  Check,
  Save
} from 'lucide-react';
import { InputProvider } from '@/components/InputProvider';
import { useAppStore, GlobalPrompt } from '@/store';
import { toast } from '@/hooks/useToast';
import BottomSheetModal from '@/components/BottomSheetModal';

export interface GlobalPromptFormData {
  title: string;
  description: string;
  prompt: string;
}

interface GlobalPromptsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (data: GlobalPromptFormData) => Promise<void> | void;
  initialPrompt: GlobalPrompt | null;
}

export const GlobalPromptsModal: React.FC<GlobalPromptsModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  initialPrompt
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

  const [formData, setFormData] = useState<GlobalPromptFormData>({
    title: '',
    description: '',
    prompt: ''
  });

  // 初始化表单数据
  useEffect(() => {
    if (isOpen) {
      if (initialPrompt) {
        // 编辑模式
        setFormData({
          title: initialPrompt.title,
          description: initialPrompt.description || '',
          prompt: initialPrompt.prompt
        });
      } else {
        // 创建模式
        setFormData({
          title: '',
          description: '',
          prompt: ''
        });
      }
    }
  }, [isOpen, initialPrompt]);

  const handleSave = async () => {
    if (!formData.title?.trim() || !formData.prompt?.trim()) {
      toast.error('请填写标题和提示词内容');
      return;
    }

    await onConfirm(formData);
  };

  // 表单内容
  const FormContent = (
    <InputProvider>
      <div className="flex flex-col gap-6">
        <fieldset className='bub-fieldset'>
          <div>
            <label className='bub-input'>
            <span className="label">标题 *</span>
            <input
              type="text"
              value={formData.title || ''}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              className=""
              placeholder="例如: 专业编程助手提示词"
              maxLength={50}
            />
          </label>
        </div>

        <div>
          <div className='bub-textarea'>
            <span className="label">提示词内容 *</span>
            <textarea
              value={formData.prompt || ''}
              onChange={(e) => setFormData({ ...formData, prompt: e.target.value })}
              rows={8}
              className="w-full pt-8"
              placeholder="输入全局提示词内容，这将作为系统级别的指导原则..."
            />
          </div>
        </div>

        <div>
          <label className='bub-input'>
            <span className="label">备注</span>
            <input
              type="text"
              value={formData.description || ''}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className=""
              placeholder="简要描述该提示词的用途和特点"
              maxLength={100}
            />
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
        <div className="modal-box w-11/12 max-w-2xl p-0 flex flex-col bg-base-200 shadow-2xl max-h-[90vh]">
          {/* Header */}
          <div className="px-6 py-4 flex items-center justify-between border-b border-base-200">
            <div className="text-lg font-bold text-base-content">
              {initialPrompt ? '编辑全局提示词' : '创建全局提示词'}
            </div>
            <button className="btn btn-sm btn-circle btn-ghost" onClick={onClose}>
              <X className="h-5 w-5" />
            </button>
          </div>
          
          {/* Content */}
          <div className="flex-1 overflow-y-auto px-6 py-4">
            {FormContent}
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-base-200 flex justify-end gap-2">
            <button className="btn" onClick={onClose}>取消</button>
            <button className="btn btn-primary" onClick={handleSave}>
              <Save className="h-4 w-4 mr-1" />
              保存
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
  return (
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
      debug={true}
      fullScreen={false}
      className="--testyou"
      headerTitle={<div className="text-center text-lg font-semibold text-base-content">{initialPrompt ? '编辑全局提示词' : '创建全局提示词'}</div>}
      rightActions={[
        { 
          icon: <Check className="h-5 w-5" />, 
          className: 'btn btn-primary btn-square', 
          onClick: handleSave
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
    </BottomSheetModal>
  );
};

export default GlobalPromptsModal;
