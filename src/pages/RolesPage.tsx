import React, { useState, useEffect } from 'react';
import { useAppStore, AIRole } from '../store';
import {
  Plus,
  Edit,
  Trash2,
  X,
  GripVertical,
  Check
} from 'lucide-react';
import { cn } from '../lib/utils';
import { toast } from '../hooks/useToast';
import ConfirmDialog from '../components/ConfirmDialog';
import Avatar from '../components/Avatar';
import RoleAvatarUpload from '../components/RoleAvatarUpload';
import { generateRandomLocalAvatar } from '../utils/avatarUtils';
import { KnowledgeService } from '../services/knowledgeService';
import type { KnowledgeBase } from '../types/knowledge';
import HeroModal from '../components/HeroModal';

interface RolesPageProps {
  onCloseModal?: () => void;
  className?: string;
}

const RolesPage: React.FC<RolesPageProps> = ({ onCloseModal, className }) => {
  const {
    aiRoles,
    globalPrompts,
    addAIRole,
    updateAIRole,
    deleteAIRole,
    voiceSettings
  } = useAppStore();

  const [isEditing, setIsEditing] = useState(false);
  const [isEditLoading, setIsEditLoading] = useState(false);
  
  // 使用智能滚动遮罩 Hook（HeroModal 内部自带滚动，这里不再应用遮罩）
  // const { scrollContainerRef, scrollMaskClasses } = useScrollMask({
  //   gradientPadding: '1rem'
  // });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    roleId: string;
    roleName: string;
  }>({ isOpen: false, roleId: '', roleName: '' });
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    systemPrompt: '',
    openingMessages: [''],
    currentOpeningIndex: 0,
    avatar: '',
    globalPromptId: '', // 向后兼容
    globalPromptIds: [] as string[], // 新的多选提示词数组
    voiceModelId: '',
    knowledgeBaseId: ''
  });
  const [knowledgeBases, setKnowledgeBases] = useState<KnowledgeBase[]>([]);

  // 移除roleIcons，现在使用Avatar组件

  const defaultRoles = [
    'default-assistant',
    'code-expert',
    'creative-writer'
  ];

  // 加载知识库列表
  useEffect(() => {
    const loadKnowledgeBases = async () => {
      try {
        const bases = await KnowledgeService.getKnowledgeBases();
        setKnowledgeBases(bases);
      } catch (error) {
        console.error('加载知识库列表失败:', error);
      }
    };
    loadKnowledgeBases();
  }, []);



  const handleEdit = async (role: AIRole) => {
    // 先立即打开弹窗，填充基础表单，随后异步获取知识库关联，避免点击后延迟
    const globalPromptIds = role.globalPromptIds || (role.globalPromptId ? [role.globalPromptId] : []);

    setFormData({
      name: role.name,
      description: role.description,
      systemPrompt: role.systemPrompt,
      openingMessages: role.openingMessages || [''],
      currentOpeningIndex: role.currentOpeningIndex || 0,
      avatar: role.avatar,
      globalPromptId: role.globalPromptId || '', // 向后兼容
      globalPromptIds: globalPromptIds,
      voiceModelId: role.voiceModelId || '',
      knowledgeBaseId: ''
    });
    setEditingId(role.id);
    setIsEditing(true);
    setIsEditLoading(true);

    try {
      const knowledgeBaseId = await KnowledgeService.getRoleKnowledgeBaseId(role.id);
      setFormData(prev => ({
        ...prev,
        knowledgeBaseId: knowledgeBaseId || ''
      }));
    } catch (error) {
      console.error('获取角色知识库关联失败:', error);
    } finally {
      setIsEditLoading(false);
    }
  };

  const handleAdd = () => {
    // 生成随机头像
    const generateRandomAvatar = () => {
      return generateRandomLocalAvatar();
    };
    
    setFormData({
      name: '',
      description: '',
      systemPrompt: '',
      openingMessages: [''],
      currentOpeningIndex: 0,
      avatar: generateRandomAvatar(),
      globalPromptId: '', // 向后兼容
      globalPromptIds: [],
      voiceModelId: '',
      knowledgeBaseId: ''
    });
    setEditingId(null);
      setIsEditing(true);
  };

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

    try {
      let roleId: string;
      
      if (editingId) {
        updateAIRole(editingId, roleData);
        roleId = editingId;
        toast.success('角色更新成功');
      } else {
        const newRole = addAIRole(roleData as Omit<AIRole, 'id' | 'createdAt' | 'updatedAt'>);
        roleId = newRole.id;
        toast.success('角色创建成功');
      }

      // 保存知识库关联
      if (formData.knowledgeBaseId) {
        await KnowledgeService.setRoleKnowledgeBase(roleId, formData.knowledgeBaseId);
      } else {
        // 如果没有选择知识库，清除关联
        await KnowledgeService.setRoleKnowledgeBase(roleId, null);
      }

      closeEditModal();
    } catch (error) {
      console.error('保存角色知识库关联失败:', error);
      toast.error('保存知识库关联失败，但角色信息已保存');
      closeEditModal();
    }
  };

  const closeEditModal = () => {
    setIsEditing(false);
    setEditingId(null);
    setIsEditLoading(false);
    setFormData({
      name: '',
      description: '',
      systemPrompt: '',
      openingMessages: [''],
      currentOpeningIndex: 0,
      avatar: '',
      globalPromptId: '', // 向后兼容
      globalPromptIds: [],
      voiceModelId: '',
      knowledgeBaseId: ''
    });
  };

  // HeroModal 将通过 onClose 回调完成重置，这里不再监听原生 dialog 事件
  useEffect(() => {}, []);

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

  const handleDelete = (id: string) => {
    if (defaultRoles.includes(id)) {
      toast.error('默认角色不能删除');
      return;
    }

    const role = aiRoles.find(r => r.id === id);
    setConfirmDialog({
      isOpen: true,
      roleId: id,
      roleName: role?.name || '未知角色'
    });
  };

  const confirmDelete = async () => {
    try {
      await deleteAIRole(confirmDialog.roleId);
      toast.success('角色已删除');
      setConfirmDialog({ isOpen: false, roleId: '', roleName: '' });
    } catch (error) {
      console.error('删除角色失败:', error);
      toast.error(error instanceof Error ? error.message : '删除角色失败');
    }
  };

  const handleCancelDelete = () => {
    setConfirmDialog({ isOpen: false, roleId: '', roleName: '' });
  };




  // 移除getIconComponent，现在使用Avatar组件

  const getRoleTypeLabel = (id: string) => {
    if (defaultRoles.includes(id)) {
      return '系统角色';
    }
    return '自定义角色';
  };

  return (
    <div className={cn("max-w-6xl mx-auto p-6 md:pt-0", className)}>
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
        <div>
          <p className="text-base-content/60">
            创建和管理AI角色，定义不同的对话风格和专业领域
          </p>
        </div>
        <button
          onClick={handleAdd}
          className="btn btn-outline-light md:btn-primary w-full md:w-auto"
        >
          <Plus className="h-4 w-4 mr-2" />
          创建新角色
        </button>
      </div>

      {/* 角色网格 */}
      <div className="grid gap-6 md:grid-cols-2">
        {aiRoles.map((role) => {
          const isDefault = defaultRoles.includes(role.id);

          return (
            <div
              key={role.id}
              className={cn(
                'card bg-base-100 shadow-sm hover:shadow-md transition-all duration-200'
              )}
            >
              <div className="card-body pb-4 group">
              {/* 角色头部 */}
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center space-x-3">
                  <Avatar
                    name={role.name}
                    avatar={role.avatar}
                    size="lg"
                  />
                  <div>
                    <h3 className="text-lg font-medium text-base-content">
                      {role.name}
                    </h3>
                    <span className={cn(
                      'text-base-content/40 text-xs',
                      isDefault ? 'badge-primary' : ''
                    )}>
                      {getRoleTypeLabel(role.id)}
                    </span>
                  </div>
                </div>
                

              </div>

              {/* 角色描述 */}
              <div className="mb-4">
                <p className="text-sm text-base-content/60 line-clamp-2 overflow-hidden text-ellipsis">
                  {role.description}
                </p>
              </div>
              <div className="text-xs text-base-content/50 mt-auto">
                创建于 {new Date(role.createdAt).toLocaleDateString()}
              </div>
              {/* 创建时间和当前角色toggle */}
              <div className="mt-auto pt-3 border-t border-base-300 flex items-center justify-between">
                <div className="flex space-x-1">
                  <button
                    onClick={() => handleEdit(role)}
                    className="btn btn-sm"
                  >
                    <Edit className="h-4 w-4" />
                  </button>
                  {!isDefault && (
                    <button
                      onClick={() => handleDelete(role.id)}
                      className="btn btn-circle btn-sm text-error ml-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>

              </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* 编辑/添加模态框：替换为 HeroModal */}
      <HeroModal
        isOpen={isEditing}
        title={editingId ? '编辑角色' : '创建新角色'}
        onClose={closeEditModal}
        onConfirm={handleSave}
        confirmText="保存"
        confirmIcon={<><Check className="h-4 w-4" /><span className="sr-only">保存</span></>}
        cancelText="取消"
        variant="primary"
        fullScreenOnMobile
      >
        <div className="space-y-2">
          {/* 基本信息 */}
          <fieldset className="fieldset bg-base-200 border-base-300 rounded-box border p-4">
            <legend className="fieldset-legend">基本信息</legend>
            
            <RoleAvatarUpload
              name={formData.name || '新角色'}
              currentAvatar={formData.avatar}
              onAvatarChange={(avatar) => setFormData({ ...formData, avatar })}
              className="self-center"
            />

            <label className="input w-full mb-1 mt-2">
              <span className="label">角色名称 *</span>
              <input
                type="text"
                value={formData.name || ''}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className=""
                placeholder="例如: 编程助手"
              />
            </label>

            <fieldset className="fieldset floating-label mt-2">
              <span className="label">角色提示词 *</span>
              <textarea
                value={formData.systemPrompt || ''}
                onChange={(e) => setFormData({ ...formData, systemPrompt: e.target.value })}
                rows={4}
                className="textarea textarea-bordered w-full"
                placeholder="定义AI的角色、行为方式和回答风格。例如：你是一个专业的编程助手，擅长多种编程语言..."
              />
            </fieldset>
            <fieldset className="fieldset floating-label mt-2">
              <span className="label">角色描述</span>
              <textarea
              value={formData.description || ''}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={2}
              className="textarea textarea-bordered w-full mb-1"
              placeholder="角色描述，简要描述这个角色的特点和用途"
            />
            </fieldset>
          </fieldset>

          {/* 提示词配置 */}
          <fieldset className="fieldset bg-base-200 border-base-300 rounded-box border p-4"> 
            <legend className="fieldset-legend">附加提示词</legend>
            
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
            <div className="space-y-3">
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
              
              {formData.globalPromptIds.length > 0 && (
                <p className="label text-info text-sm">
                  已选择 {formData.globalPromptIds.length} 个提示词，保存后将在对话时自动应用
                </p>
              )}
            </div>

          </fieldset>

          {/* 开场白设置 */}
          <fieldset className="fieldset bg-base-200 border-base-300 rounded-box border p-4">
            <legend className="fieldset-legend">开场白设置</legend>
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

          {/* 知识库配置 */}
          <fieldset className="fieldset bg-base-200 border-base-300 rounded-box border p-4">
            <legend className="fieldset-legend">知识库配置</legend>
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
                {formData.knowledgeBaseId && (
                  <p className="label text-info text-sm mt-1">
                    已选择知识库，保存后将在对话时自动应用
                  </p>
                )}
              </>
            )}
          </fieldset>

          <fieldset className="fieldset bg-base-200 border-base-300 rounded-box border p-4">
            <legend className="fieldset-legend">语音设置</legend>
                            
            <label className="select w-full mb-1">
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
      </HeroModal>

      {/* 删除确认弹窗（统一使用 ConfirmDialog） */}
      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        onClose={() => setConfirmDialog({ isOpen: false, roleId: '', roleName: '' })}
        onConfirm={confirmDelete}
        title="删除角色"
        message={`确定要删除角色 "${confirmDialog.roleName}" 吗？此操作不可撤销。`}
        confirmText="删除"
        cancelText="取消"
        variant="danger"
      />
    </div>
  );
};

export default RolesPage;
