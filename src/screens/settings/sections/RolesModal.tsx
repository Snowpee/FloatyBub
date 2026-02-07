import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  Plus,
  X,
  GripVertical,
  Check,
  Zap
} from 'lucide-react';
import { InputProvider } from '@/components/InputProvider';
import { useAppStore, AIRole } from '@/store';
import { toast } from '@/hooks/useToast';
import BottomSheetModal from '@/components/BottomSheetModal';
import RoleAvatarUpload from '../components/RoleAvatarUpload';
import { generateRandomLocalAvatar } from '@/utils/avatarUtils';
import { KnowledgeService } from '@/services/knowledgeService';
import type { KnowledgeBase } from '@/types/knowledge';
import { cn } from '@/lib/utils';

export interface RoleFormData {
  name: string;
  description: string;
  systemPrompt: string;
  openingMessages: string[];
  currentOpeningIndex: number;
  avatar: string;
  globalPromptId: string;
  globalPromptIds: string[];
  skillIds: string[];
  voiceModelId: string;
  knowledgeBaseId: string;
}

interface RolesModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (data: RoleFormData) => Promise<void>;
  initialRole: AIRole | null;
  initialKnowledgeBaseId: string | null;
  knowledgeBases: KnowledgeBase[];
}

const RolesModal: React.FC<RolesModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  initialRole,
  initialKnowledgeBaseId,
  knowledgeBases
}) => {
  const { globalPrompts, voiceSettings, agentSkills } = useAppStore();
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
    skillIds: [],
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
          skillIds: initialRole.skillIds || [],
          voiceModelId: initialRole.voiceModelId || '',
          knowledgeBaseId: initialKnowledgeBaseId || ''
        });
        setIsEditLoading(false);
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
          skillIds: [],
          voiceModelId: '',
          knowledgeBaseId: ''
        });
        setIsEditLoading(false);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, initialRole?.id, initialKnowledgeBaseId]);

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
      globalPromptIds: formData.globalPromptIds,
      skillIds: formData.skillIds
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
    <InputProvider>
      <div className="flex flex-col gap-6">
        {/* 基本信息 */}
      <fieldset className='bub-fieldset py-4'>
        <RoleAvatarUpload
          name={formData.name || '新角色'}
          currentAvatar={formData.avatar}
          onAvatarChange={(avatar) => setFormData({ ...formData, avatar })}
          className="self-center pb-4"
        />
        <div>
          <label className='bub-input'>
            <span className="label">角色名称 *</span>
            <input
              type="text"
              value={formData.name || ''}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className=""
              placeholder="例如: 编程助手"
            />
          </label>
        </div>
        
        <div>
          <div className='bub-textarea'>
            <span className="label">角色提示词 *</span>
            <textarea
              value={formData.systemPrompt || ''}
              onChange={(e) => setFormData({ ...formData, systemPrompt: e.target.value })}
              rows={4}
              className="w-full pt-8"
              placeholder="定义AI的角色、行为方式和回答风格。例如：你是一个专业的编程助手，擅长多种编程语言..."
            />
          </div>
        </div>
        <div>
          <div className='bub-textarea'>
            <span className="label">角色描述</span>
            <textarea
              value={formData.description || ''}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={2}
              className="w-full pt-8"
              placeholder="角色描述，简要描述这个角色的特点和用途"
            />
          </div>
        </div>
      </fieldset>

      {/* 开场白设置 */}
      <div>
        <div className="pl-[calc(1rem+1px)] pb-1 text-sm font-bold text-base-content/50">开场白设置</div>
        <fieldset className="bub-fieldset py-4">
            {formData.openingMessages.map((message, index) => (
              <div key={index} className="flex gap-2 items-center">
                <textarea
                  value={message}
                  onChange={(e) => updateOpeningMessage(index, e.target.value)}
                  rows={3}
                  className="flex-1 bub-textarea"
                  placeholder={`开场白 ${index + 1}：设置角色的开场白，将作为对话的第一句话显示`}
                />
                {formData.openingMessages.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeOpeningMessage(index)}
                    className="btn btn-xs btn-circle hover:bg-error/10"
                    title="删除此开场白"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
            ))}
            <div>
              <button
                type="button"
                onClick={addOpeningMessage}
                className="btn btn-outline w-full border-base-300 bg-base-100 hover:bg-base-200 mt-4"
              >
                <Plus className="h-4 w-4 mr-2 " />
                新增更多开场白
              </button>
            </div>
        </fieldset>
      </div>

      {/* 提示词配置 */}
      <div>
        <div className="pl-[calc(1rem+1px)] pb-1 text-sm font-bold text-base-content/50">附加提示词</div>
        <fieldset className="bub-fieldset"> 
          
          {/* 已选择的提示词列表 */}
          {formData.globalPromptIds.length > 0 && (
            <div className="space-y-0 divide-y divide-base-300">
              {formData.globalPromptIds.map((promptId, index) => {
                const prompt = globalPrompts.find(p => p.id === promptId);
                return (
                  <div 
                    key={promptId} 
                    className="flex items-center justify-between bg-base-100 p-0 h-12 cursor-move transition-colors"
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
                      className="btn btn-circle btn-xs hover:bg-error/10"
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
            <label className="bub-select bub-select-l w-full">
              <select
                value=""
                className='text-left'
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
            
          </div>
          

        </fieldset>
        <p className="label text-base-content/60 text-sm ml-[calc(1rem+1px)]">
          可添加多个全局提示词，它们将按顺序应用到对话中。
        </p>
      </div>

      {/* 技能配置 */}
      <div>
        <div className="pl-[calc(1rem+1px)] pb-1 text-sm font-bold text-base-content/50">Agent Skills</div>
        <fieldset className="bub-fieldset">
          
          {/* 已选择的技能列表 */}
          {formData.skillIds.length > 0 && (
            <div className="space-y-0 divide-y divide-base-300">
              {formData.skillIds.map((skillId, index) => {
                const skill = agentSkills.find(s => s.id === skillId);
                return (
                  <div 
                    key={skillId} 
                    className="flex items-center justify-between bg-base-100 p-0 h-12 cursor-move transition-colors"
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.setData('text/plain', index.toString());
                      e.dataTransfer.setData('type', 'skill');
                    }}
                    onDragOver={(e) => {
                      e.preventDefault();
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      if (e.dataTransfer.getData('type') !== 'skill') return;
                      const dragIndex = parseInt(e.dataTransfer.getData('text/plain'));
                      const hoverIndex = index;      
                      if (dragIndex !== hoverIndex) {
                        setFormData(prev => {
                          const newSkillIds = [...prev.skillIds];
                          const draggedItem = newSkillIds[dragIndex];
                          newSkillIds.splice(dragIndex, 1);
                          newSkillIds.splice(hoverIndex, 0, draggedItem);
                          return {
                            ...prev,
                            skillIds: newSkillIds
                          };
                        });
                      }
                    }}
                  >
                    <div className="flex items-center text-base-content/40 mr-2">
                      <GripVertical className="h-4 w-4" />
                    </div>
                    <div className="flex-1">
                      <h4 className="text-sm text-base-content flex items-center gap-2">
                        <Zap className="h-3 w-3 text-primary" />
                        {skill?.name || '未知技能'}
                      </h4>
                      {skill?.description && (
                        <p className="text-sm text-base-content/60 mt-0.5 truncate max-w-[200px]">{skill.description}</p>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setFormData(prev => ({
                          ...prev,
                          skillIds: prev.skillIds.filter(id => id !== skillId)
                        }));
                      }}
                      className="btn btn-circle btn-xs hover:bg-error/10"
                      title="移除此技能"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
          
          {/* 添加技能下拉选择器 */}
          <div className="space-y-1">
            <label className="bub-select bub-select-l w-full">
              <select
                value=""
                className='text-left'
                onChange={(e) => {
                  const selectedId = e.target.value;
                  if (selectedId && !formData.skillIds.includes(selectedId)) {
                    setFormData(prev => ({
                      ...prev,
                      skillIds: [...prev.skillIds, selectedId]
                    }));
                  }
                  e.target.value = '';
                }}
              >
                <option value="">添加技能...</option>
                {agentSkills
                  .filter(skill => !formData.skillIds.includes(skill.id))
                  .map((skill) => (
                    <option key={skill.id} value={skill.id}>
                      {skill.name}
                    </option>
                  ))
                }
              </select>
            </label>          
          </div>

        </fieldset>
        <p className="label text-base-content/60 text-sm ml-[calc(1rem+1px)]">
          为角色配备特定技能，这些技能将作为上下文提供给 AI。
        </p>
      </div>


      {/* 知识库配置 */}
      <div>
        <fieldset className="bub-fieldset">
          <div>
          {isEditLoading ? (
            <div className="space-y-2">
              <div className="skeleton h-10 w-full" />
              <div className="skeleton h-4 w-56" />
            </div>
          ) : (
            <>
              <label className="bub-select w-full">
                <span className="label">知识库</span>
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
            </>
          )}
          </div>
          <>
          <label className="bub-select w-full">
            <span className="label">语音模型</span>
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
          </>
        </fieldset>
      </div>
      </div>
    </InputProvider>
  );

  if (!isOpen) return null;

  // 桌面端渲染
  if (isDesktop) {
    return createPortal(
      <dialog className="modal modal-open modal-middle" open>
        <div className="modal-box w-11/12 max-w-3xl p-0 flex flex-col bg-base-200 shadow-2xl max-h-[90vh]">
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
      fullScreen={false}
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
