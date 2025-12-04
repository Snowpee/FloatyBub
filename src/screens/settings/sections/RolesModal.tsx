import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  Plus,
  X,
  GripVertical,
  Check
} from 'lucide-react';
import { useAppStore, AIRole } from '../../../store';
import { toast } from '../../../hooks/useToast';
import BottomSheetModal from '../../../components/BottomSheetModal';
import RoleAvatarUpload from '../../../components/RoleAvatarUpload';
import { generateRandomLocalAvatar } from '../../../utils/avatarUtils';
import { KnowledgeService } from '../../../services/KnowledgeService';
import type { KnowledgeBase } from '../../../types/knowledge';

export interface RoleFormData {
  name: string;
  description: string;
  systemPrompt: string;
  openingMessages: string[];
  currentOpeningIndex: number;
  avatar: string;
  globalPromptId: string;
  globalPromptIds: string[];
  voiceModelId: string;
  knowledgeBaseId: string;
}

interface RolesModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (data: RoleFormData) => Promise<void>;
  initialRole: AIRole | null;
  knowledgeBases: KnowledgeBase[];
}

const RolesModal: React.FC<RolesModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  initialRole,
  knowledgeBases
}) => {
  const { globalPrompts, voiceSettings } = useAppStore();
  const [isEditLoading, setIsEditLoading] = useState(false);
  
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

  const [formData, setFormData] = useState<RoleFormData>({
    name: '',
    description: '',
    systemPrompt: '',
    openingMessages: [''],
    currentOpeningIndex: 0,
    avatar: '',
    globalPromptId: '',
    globalPromptIds: [],
    voiceModelId: '',
    knowledgeBaseId: ''
  });

  // 初始化表单数据
  useEffect(() => {
    if (isOpen) {
      if (initialRole) {
        // 编辑模式
        const globalPromptIds = initialRole.globalPromptIds || (initialRole.globalPromptId ? [initialRole.globalPromptId] : []);
        
        setFormData({
          name: initialRole.name,
          description: initialRole.description,
          systemPrompt: initialRole.systemPrompt,
          openingMessages: initialRole.openingMessages || [''],
          currentOpeningIndex: initialRole.currentOpeningIndex || 0,
          avatar: initialRole.avatar,
          globalPromptId: initialRole.globalPromptId || '',
          globalPromptIds: globalPromptIds,
          voiceModelId: initialRole.voiceModelId || '',
          knowledgeBaseId: '' // 将异步获取
        });
        
        // 异步获取知识库关联
        const loadKnowledgeBaseId = async () => {
          setIsEditLoading(true);
          try {
            const kbId = await KnowledgeService.getRoleKnowledgeBaseId(initialRole.id);
            setFormData(prev => ({
              ...prev,
              knowledgeBaseId: kbId || ''
            }));
          } catch (error) {
            console.error('获取角色知识库关联失败:', error);
          } finally {
            setIsEditLoading(false);
          }
        };
        loadKnowledgeBaseId();
      } else {
        // 创建模式
        setFormData({
          name: '',
          description: '',
          systemPrompt: '',
          openingMessages: [''],
          currentOpeningIndex: 0,
          avatar: generateRandomLocalAvatar(),
          globalPromptId: '',
          globalPromptIds: [],
          voiceModelId: '',
          knowledgeBaseId: ''
        });
        setIsEditLoading(false);
      }
    }
  }, [isOpen, initialRole]);

  const handleSave = async () => {
    if (!formData.name?.trim()) {
      toast.error('请输入角色名称');
      return;
    }

    // 过滤空的开场白
    const filteredOpeningMessages = formData.openingMessages.filter(msg => msg.trim() !== '');
    if (filteredOpeningMessages.length === 0) {
      filteredOpeningMessages.push(''); // 至少保留一个空的开场白
    }

    const roleData = {
      ...formData,
      openingMessages: filteredOpeningMessages,
      currentOpeningIndex: Math.min(formData.currentOpeningIndex, filteredOpeningMessages.length - 1),
      // 向后兼容：如果有globalPromptIds，设置第一个为globalPromptId
      globalPromptId: formData.globalPromptIds.length > 0 ? formData.globalPromptIds[0] : '',
      globalPromptIds: formData.globalPromptIds
    };

    await onConfirm(roleData);
  };

  // 开场白管理函数
  const addOpeningMessage = () => {
    setFormData(prev => ({
      ...prev,
      openingMessages: [...prev.openingMessages, '']
    }));
  };

  const removeOpeningMessage = (index: number) => {
    if (formData.openingMessages.length <= 1) {
      toast.error('至少需要保留一个开场白');
      return;
    }
    setFormData(prev => ({
      ...prev,
      openingMessages: prev.openingMessages.filter((_, i) => i !== index),
      currentOpeningIndex: Math.min(prev.currentOpeningIndex, prev.openingMessages.length - 2)
    }));
  };

  const updateOpeningMessage = (index: number, value: string) => {
    setFormData(prev => ({
      ...prev,
      openingMessages: prev.openingMessages.map((msg, i) => i === index ? value : msg)
    }));
  };

  // 表单内容
  const FormContent = (
    <div className="flex flex-col gap-4">
      {/* 基本信息 */}
      <fieldset className="fieldset bg-base-100 md:bg-base-200 border-base-300 rounded-box border p-3 md:p-4 gap-3 md:gap-4">
        <RoleAvatarUpload
          name={formData.name || '新角色'}
          currentAvatar={formData.avatar}
          onAvatarChange={(avatar) => setFormData({ ...formData, avatar })}
          className="self-center"
        />

        <label className="input w-full">
          <span className="label">角色名称 *</span>
          <input
            type="text"
            value={formData.name || ''}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            className=""
            placeholder="例如: 编程助手"
          />
        </label>

        <fieldset className="fieldset relative p-0">
          <span className="label ml-[calc(0.75rem+var(--border))] absolute top-3 left-0 z-10">角色提示词 *</span>
          <textarea
            value={formData.systemPrompt || ''}
            onChange={(e) => setFormData({ ...formData, systemPrompt: e.target.value })}
            rows={4}
            className="textarea textarea-bordered w-full pt-8"
            placeholder="定义AI的角色、行为方式和回答风格。例如：你是一个专业的编程助手，擅长多种编程语言..."
          />
        </fieldset>
        <fieldset className="fieldset relative p-0">
          <span className="label ml-[calc(0.75rem+var(--border))] absolute top-3 left-0 z-10">角色描述</span>
          <textarea
            value={formData.description || ''}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            rows={2}
            className="textarea textarea-bordered w-full pt-8"
            placeholder="角色描述，简要描述这个角色的特点和用途"
          />
        </fieldset>
      </fieldset>


      {/* 开场白设置 */}
      <div>
        <div className="pl-3 pb-1 text-sm font-bold text-base-content/50">开场白设置</div>
        <fieldset className="fieldset bg-base-100 md:bg-base-200 border-base-300 rounded-box border p-3 md:p-4">
          <div className="space-y-3">
            {formData.openingMessages.map((message, index) => (
              <div key={index} className="flex gap-2">
                <textarea
                  value={message}
                  onChange={(e) => updateOpeningMessage(index, e.target.value)}
                  rows={3}
                  className="textarea textarea-bordered flex-1"
                  placeholder={`开场白 ${index + 1}：设置角色的开场白，将作为对话的第一句话显示`}
                />
                {formData.openingMessages.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeOpeningMessage(index)}
                    className="btn btn-ghost btn-sm text-error hover:bg-error/10"
                    title="删除此开场白"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
            ))}
            <button
              type="button"
              onClick={addOpeningMessage}
              className="btn btn-outline w-full border-base-300 bg-base-100 hover:bg-base-200"
            >
              <Plus className="h-4 w-4 mr-2 " />
              新增更多开场白
            </button>
          </div>
        </fieldset>
      </div>

      {/* 提示词配置 */}
      <div>
        <div className="pl-3 pb-1 text-sm font-bold text-base-content/50">附加提示词</div>
        <fieldset className="fieldset bg-base-100 md:bg-base-200 border-base-300 rounded-box border p-3 md:p-4"> 
          
          {/* 已选择的提示词列表 */}
          {formData.globalPromptIds.length > 0 && (
            <div className="space-y-2 mb-1">
              {formData.globalPromptIds.map((promptId, index) => {
                const prompt = globalPrompts.find(p => p.id === promptId);
                return (
                  <div 
                    key={promptId} 
                    className="flex items-center justify-between bg-base-100 rounded-field p-1 pl-2 border-[length:var(--border-width)] border-base-300 cursor-move hover:bg-base-200 transition-colors"
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.setData('text/plain', index.toString());
                    }}
                    onDragOver={(e) => {
                      e.preventDefault();
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      const dragIndex = parseInt(e.dataTransfer.getData('text/plain'));
                      const hoverIndex = index;      
                      if (dragIndex !== hoverIndex) {
                        setFormData(prev => {
                          const newPromptIds = [...prev.globalPromptIds];
                          const draggedItem = newPromptIds[dragIndex];
                          newPromptIds.splice(dragIndex, 1);
                          newPromptIds.splice(hoverIndex, 0, draggedItem);
                          return {
                            ...prev,
                            globalPromptIds: newPromptIds
                          };
                        });
                      }
                    }}
                  >
                    <div className="flex items-center text-base-content/40 mr-2">
                      <GripVertical className="h-4 w-4" />
                    </div>
                    <div className="flex-1">
                      <h4 className="text-sm text-base-content">{prompt?.title || '未知提示词'}</h4>
                      {prompt?.description && (
                        <p className="text-sm text-base-content/60 mt-1">{prompt.description}</p>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setFormData(prev => ({
                          ...prev,
                          globalPromptIds: prev.globalPromptIds.filter(id => id !== promptId)
                        }));
                      }}
                      className="btn btn-ghost btn-circle btn-sm text-error hover:bg-error/10"
                      title="删除此提示词"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
          
          {/* 添加提示词按钮和下拉选择器 */}
          <div className="space-y-1">
            <label className="select w-full">
              <select
                value=""
                onChange={(e) => {
                  const selectedId = e.target.value;
                  if (selectedId && !formData.globalPromptIds.includes(selectedId)) {
                    setFormData(prev => ({
                      ...prev,
                      globalPromptIds: [...prev.globalPromptIds, selectedId]
                    }));
                  }
                  // 重置选择器
                  e.target.value = '';
                }}
              >
                <option value="">选择要添加的提示词...</option>
                {globalPrompts
                  .filter(prompt => !formData.globalPromptIds.includes(prompt.id))
                  .map((prompt) => (
                    <option key={prompt.id} value={prompt.id}>
                      {prompt.title}
                    </option>
                  ))
                }
              </select>
            </label>          
            <p className="label">
              可添加多个全局提示词，它们将按顺序应用到对话中。
            </p>
          </div>

        </fieldset>
      </div>


      {/* 知识库配置 */}
      <div>
        <div className="pl-3 pb-1 text-sm font-bold text-base-content/50">知识库配置</div>
        <fieldset className="fieldset bg-base-100 md:bg-base-200 border-base-300 rounded-box border p-3 md:p-4">
        {isEditLoading ? (
          <div className="space-y-2">
            <div className="skeleton h-10 w-full" />
            <div className="skeleton h-4 w-56" />
          </div>
        ) : (
          <>
            <label className="select w-full">
              <select
                value={formData.knowledgeBaseId || ''}
                onChange={(e) => setFormData({ ...formData, knowledgeBaseId: e.target.value })}
              >
                <option value="">不使用知识库</option>
                {knowledgeBases.map((kb) => (
                  <option key={kb.id} value={kb.id}>
                    {kb.name}
                  </option>
                ))}
              </select>
            </label>
            <p className="label">
              选择知识库后，AI将能够根据对话内容搜索相关知识条目。
            </p>
          </>
        )}
        </fieldset>
      </div>
      <div>
        <div className="pl-3 pb-1 text-sm font-bold text-base-content/50">语音设置</div>
        <fieldset className="fieldset bg-base-100 md:bg-base-200 border-base-300 rounded-box border p-3 md:p-4">
          <label className="select w-full">
            {/* <span className="label">语音模型</span> */}
            <select
              value={formData.voiceModelId || ''}
              onChange={(e) => setFormData({ ...formData, voiceModelId: e.target.value || undefined })}
            >
              <option value="">默认</option>
              {voiceSettings?.customModels?.map((model) => (
                <option key={model.id} value={model.id}>
                  {model.name} {model.isPreset ? '(预设)' : ''}
                </option>
              ))}
            </select>
          </label>
          <span className="label">未设置时将使用默认语音模型</span>
        </fieldset>
      </div>
    </div>
  );

  if (!isOpen) return null;

  // 桌面端渲染
  if (isDesktop) {
    return createPortal(
      <dialog className="modal modal-open modal-middle" open>
        <div className="modal-box w-11/12 max-w-3xl p-0 flex flex-col bg-base-100 shadow-2xl max-h-[90vh]">
          {/* Header */}
          <div className="px-6 py-4 flex items-center justify-between border-b border-base-200">
            <div className="text-lg font-bold text-base-content">{initialRole ? '编辑角色' : '创建新角色'}</div>
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
              <Check className="h-4 w-4 mr-1" />
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
      debug={true}
      headerTitle={<div className="text-center text-lg font-semibold text-base-content">{initialRole ? '编辑角色' : '创建新角色'}</div>}
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
    </BottomSheetModal>,
    document.body
  );
};

export default RolesModal;
