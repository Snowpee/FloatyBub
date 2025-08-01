import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppStore } from '../store';
import { Bot, Users, Sparkles, ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '../lib/utils';
import { toast } from '../hooks/useToast';
import Avatar from './Avatar';

const RoleSelector: React.FC = () => {
  const navigate = useNavigate();
  const {
    aiRoles,
    llmConfigs,
    currentModelId,
    setCurrentRole,
    setCurrentModel,
    createTempSession,
    addMessage
  } = useAppStore();

  // 管理每个角色的开场白选择索引
  const [roleOpeningIndexes, setRoleOpeningIndexes] = useState<Record<string, number>>({});

  const enabledModels = llmConfigs.filter(config => config.enabled);

  const handleRoleSelect = (roleId: string) => {
    if (enabledModels.length === 0) {
      toast.error('请先配置并启用至少一个AI模型');
      return;
    }

    // 设置当前角色
    setCurrentRole(roleId);

    // 如果没有选择模型，使用第一个可用模型
    if (!currentModelId || !enabledModels.find(m => m.id === currentModelId)) {
      setCurrentModel(enabledModels[0].id);
    }

    // 创建临时会话
    const sessionId = createTempSession(roleId, currentModelId || enabledModels[0].id);
    
    // 如果角色有开场白，添加当前选择的开场白为第一条消息
    const selectedRole = aiRoles.find(role => role.id === roleId);
    if (selectedRole?.openingMessages && selectedRole.openingMessages.length > 0) {
      const currentIndex = roleOpeningIndexes[roleId] || 0;
      const openingMessage = selectedRole.openingMessages[currentIndex];
      if (openingMessage?.trim()) {
        addMessage(sessionId, {
          role: 'assistant',
          content: openingMessage,
          timestamp: new Date()
        });
      }
    }
    
    // 导航到聊天页面
    navigate(`/chat/${sessionId}`);
  };

  // 切换开场白
  const switchOpeningMessage = (roleId: string, direction: 'prev' | 'next') => {
    const role = aiRoles.find(r => r.id === roleId);
    if (!role?.openingMessages || role.openingMessages.length <= 1) return;

    const currentIndex = roleOpeningIndexes[roleId] || 0;
    let newIndex = currentIndex;

    if (direction === 'prev') {
      newIndex = currentIndex > 0 ? currentIndex - 1 : role.openingMessages.length - 1;
    } else {
      newIndex = currentIndex < role.openingMessages.length - 1 ? currentIndex + 1 : 0;
    }

    setRoleOpeningIndexes(prev => ({
      ...prev,
      [roleId]: newIndex
    }));
  };

  if (aiRoles.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-8">
        <Users className="h-16 w-16 text-base-content/40 mb-4" />
        <h2 className="text-xl font-semibold text-base-content mb-2">
          还没有AI角色
        </h2>
        <p className="text-base-content/60 text-center mb-6">
          请先在设置中创建AI角色，然后回来开始聊天
        </p>
        <button
          onClick={() => window.location.hash = '#setting/roles'}
          className="btn btn-primary btn-lg"
        >
          前往设置
        </button>
      </div>
    );
  }

  return (
    <div className="h-full max-w-6xl mx-auto p-6 pt-12">
      <div className="text-center mb-8">
        <div className="flex items-center justify-center mb-4">
          <Sparkles className="h-8 w-8 text-primary mr-2" />
          <h1 className="text-3xl font-bold text-base-content">
            选择角色，开始聊天
          </h1>
        </div>
        <p className="text-base-content/60">
          选择一个AI角色开始对话，每个角色都有独特的个性和专长
        </p>
      </div>

      {enabledModels.length === 0 && (
        <div className="alert alert-warning mb-6">
          <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
          <span className="text-md">
            暂无 AI 模型，请先配置并启用 AI 模型才能开始聊天
          </span>
            <button
              onClick={() => window.location.hash = '#setting/config'}
              className="btn btn-sm"
            >
              配置模型
            </button>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {aiRoles.map((role) => (
          <div
            key={role.id}
            onClick={() => handleRoleSelect(role.id)}
            className={cn(
              "card bg-base-100 border border-base-300 cursor-pointer transition-all duration-200 hover:shadow-lg hover:border-primary/50",
              enabledModels.length === 0 && "opacity-50 cursor-not-allowed"
            )}
          >
            <div className="card-body">
              <div className="flex items-start space-x-4">
                <div className="flex-shrink-0">
                  <Avatar
                    name={role.name}
                    avatar={role.avatar}
                    size="lg"
                    className="flex-shrink-0"
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-lg font-semibold text-base-content mb-2">
                    {role.name}
                  </h3>
                  <p className="text-base-content/60 text-sm line-clamp-3">
                    {role.description || '这个角色还没有描述'}
                  </p>
                </div>
              </div>
              
              {(role.systemPrompt || (role.openingMessages && role.openingMessages.length > 0)) && (
                <div className="mt-4 pt-4 border-t border-base-300 space-y-2">
                  {role.openingMessages && role.openingMessages.length > 0 && (
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <p className="text-xs text-base-content/70 font-medium">开场白:</p>
                        {role.openingMessages.length > 1 && (
                          <div className="flex items-center gap-1">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                switchOpeningMessage(role.id, 'prev');
                              }}
                              className="p-1 rounded text-gray-500 hover:bg-black/10 transition-colors"
                              title="上一个开场白"
                            >
                              <ChevronLeft className="h-3 w-3" />
                            </button>
                            <span className="text-xs text-gray-500 px-1">
                              {(roleOpeningIndexes[role.id] || 0) + 1}/{role.openingMessages.length}
                            </span>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                switchOpeningMessage(role.id, 'next');
                              }}
                              className="p-1 rounded text-gray-500 hover:bg-black/10 transition-colors"
                              title="下一个开场白"
                            >
                              <ChevronRight className="h-3 w-3" />
                            </button>
                          </div>
                        )}
                      </div>
                      <p className="text-xs text-base-content/60 line-clamp-2">
                        {role.openingMessages[roleOpeningIndexes[role.id] || 0] || '暂无开场白'}
                      </p>
                    </div>
                  )}
                  {role.systemPrompt && (
                    <div>
                      <p className="text-xs text-base-content/70 font-medium mb-1">系统提示:</p>
                      <p className="text-xs text-base-content/50 line-clamp-2">
                        {role.systemPrompt}
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-8 text-center">
        <p className="text-sm text-base-content/50 mb-4">
          没有找到合适的角色？
        </p>
        <button
          onClick={() => window.location.hash = '#setting/roles'}
          className="btn btn-link btn-sm text-primary"
        >
          创建新角色
        </button>
      </div>
    </div>
  );
};

export default RoleSelector;