import React, { useState } from 'react';
import { useAppStore, LLMConfig } from '../../../store';
import {
  Plus,
  Edit,
  Trash2,
  CheckCircle,
  Ban,
  Wifi,
  MoreHorizontal
} from 'lucide-react';
import { cn } from '../../../lib/utils';
import { toast } from '../../../hooks/useToast';
import ConfirmDialog from '../../../components/ConfirmDialog';
import ConfigModal from './ConfigModal';
import EmptyState from '../../../components/EmptyState';
import { getDefaultBaseUrl } from '../../../utils/providerUtils';

interface ConfigSettingsProps {
  onCloseModal?: () => void;
  className?: string;
}

const ConfigSettings: React.FC<ConfigSettingsProps> = ({ onCloseModal, className }) => {
  const {
    llmConfigs,
    addLLMConfig,
    updateLLMConfig,
    deleteLLMConfig
  } = useAppStore();

  const [isEditing, setIsEditing] = useState(false);
  const [editingConfig, setEditingConfig] = useState<Partial<LLMConfig> | null>(null);
  const [testingConfigs, setTestingConfigs] = useState<Record<string, boolean>>({});
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    configId: string;
    configName: string;
  }>({ isOpen: false, configId: '', configName: '' });

  const handleEdit = (config: LLMConfig) => {
    setEditingConfig(config);
    setIsEditing(true);
  };

  const handleAdd = () => {
    setEditingConfig(null);
    setIsEditing(true);
  };

  const handleSave = (configData: Partial<LLMConfig>) => {
    if (!configData.name || !configData.apiKey || !configData.model) {
      toast.error('请填写必填字段');
      return;
    }

    if (editingConfig && editingConfig.id) {
      updateLLMConfig(editingConfig.id, configData);
      toast.success('配置已更新');
    } else {
      addLLMConfig(configData as Omit<LLMConfig, 'id'>);
      toast.success('配置已添加');
    }

    setIsEditing(false);
    setEditingConfig(null);
  };

  const handleCancel = () => {
    setIsEditing(false);
    setEditingConfig(null);
  };

  const handleDelete = (id: string) => {
    const config = llmConfigs.find(c => c.id === id);
    setConfirmDialog({
      isOpen: true,
      configId: id,
      configName: config?.name || '未知配置'
    });
  };

  const confirmDelete = async () => {
    try {
      await deleteLLMConfig(confirmDialog.configId);
      toast.success('配置已删除');
    } catch (error) {
      console.error('删除配置失败:', error);
      toast.error(error instanceof Error ? error.message : '删除配置失败');
    }
  };

  // 简化错误消息
  const simplifyErrorMessage = (errorMessage: string): string => {
    const message = errorMessage.toLowerCase();
    
    if (message.includes('api key') || message.includes('unauthorized') || message.includes('invalid key')) {
      return 'API密钥无效';
    }
    if (message.includes('quota') || message.includes('limit') || message.includes('billing')) {
      return '配额已用完';
    }
    if (message.includes('model') && (message.includes('not found') || message.includes('does not exist'))) {
      return '模型不存在';
    }
    if (message.includes('permission') || message.includes('forbidden') || message.includes('access denied')) {
      return '权限不足';
    }
    if (message.includes('network') || message.includes('connection') || message.includes('timeout')) {
      return '网络连接失败';
    }
    if (message.includes('rate limit')) {
      return '请求过于频繁';
    }
    
    return '连接失败';
  };

  const testConnection = async (config: LLMConfig) => {
    setTestingConfigs(prev => ({ ...prev, [config.id]: true }));
    toast.info('正在测试连接...');
    
    try {
      const baseUrl = config.baseUrl || getDefaultBaseUrl(config.provider);
      const url = config.proxyUrl || baseUrl;
      
      // 构建测试请求
      const testPayload = {
        model: config.model,
        messages: [{ role: 'user', content: 'Hello' }],
        max_tokens: 16,
        temperature: 0.1
      };
      
      const headers: Record<string, string> = {
        'Content-Type': 'application/json'
      };
      
      // 根据不同提供商设置认证头
      if (config.provider === 'openai' || config.provider === 'kimi' || config.provider === 'deepseek' || config.provider === 'openrouter') {
        headers['Authorization'] = `Bearer ${config.apiKey}`;
        
        // 为OpenRouter添加可选的识别头部
        if (config.provider === 'openrouter') {
          headers['HTTP-Referer'] = window.location.origin;
          headers['X-Title'] = 'Floaty Bub';
        }
      } else if (config.provider === 'claude') {
        headers['x-api-key'] = config.apiKey;
        headers['anthropic-version'] = '2023-06-01';
      } else if (config.provider === 'gemini') {
        // Gemini 使用 URL 参数传递 API key
      } else {
        headers['Authorization'] = `Bearer ${config.apiKey}`;
      }
      
      const endpoint = getApiEndpoint(config.provider, url);
      const finalUrl = config.provider === 'gemini' 
        ? `${endpoint}?key=${config.apiKey}`
        : endpoint;
      
      const response = await fetch(finalUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify(testPayload),
        signal: AbortSignal.timeout(10000) // 10秒超时
      });
      
      if (response.ok) {
        toast.success('连接测试成功');
      } else {
        const errorData = await response.json().catch(() => ({}));
        const errorMessage = errorData.error?.message || errorData.message || `HTTP ${response.status}`;
        const simplifiedMessage = simplifyErrorMessage(errorMessage);
        toast.error(`连接测试失败: ${simplifiedMessage}`);
      }
    } catch (error: any) {
      if (error.name === 'AbortError') {
        toast.error('连接测试超时');
      } else if (error.message.includes('fetch')) {
        toast.error('网络连接失败');
      } else {
        const simplifiedMessage = simplifyErrorMessage(error.message);
        toast.error(`连接测试失败: ${simplifiedMessage}`);
      }
    } finally {
      setTestingConfigs(prev => ({ ...prev, [config.id]: false }));
    }
  };
  
  const getApiEndpoint = (provider: string, baseUrl: string): string => {
    switch (provider) {
      case 'openai':
      case 'kimi':
      case 'deepseek':
      case 'openrouter':
      case 'custom':
        return `${baseUrl}/v1/chat/completions`;
      case 'claude':
        return `${baseUrl}/v1/messages`;
      case 'gemini':
        return `${baseUrl}/v1beta/models/gemini-pro:generateContent`;
      default:
        return `${baseUrl}/v1/chat/completions`;
    }
  };

  return (
    <div className={cn("max-w-6xl mx-auto p-4 md:p-6 md:pt-0", className)}>
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-4">
        <div>
          <p className="text-base-content/60">
            配置和管理您的AI模型连接设置
          </p>
        </div>
        <button
          onClick={handleAdd}
          className="btn btn-outline-light md:btn md:btn-primary w-full md:w-auto"
        >
          <Plus className="h-4 w-4" />
          添加模型配置
        </button>
      </div>

      {/* 配置列表 */}
      {llmConfigs.length === 0 ? (
        <EmptyState message="点击上方按钮添加您的第一个模型配置" />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-2">
          {llmConfigs.map((config) => (
            <div
              key={config.id}
              className="card bg-base-100 shadow-sm"
            >
            <div className="card-body pb-4 group">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center space-x-2">
                  <h3 className="text-lg font-medium text-base-content">
                    {config.name}
                  </h3>
                  {config.enabled ? (
                    <CheckCircle className="h-5 w-5 text-success" />
                  ) : (
                    <Ban className="h-5 w-5 text-warning" />
                  )}
                </div>

              </div>

              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-base-content/60">提供商:</span>
                  <span className="ml-2 text-base-content capitalize">
                    {config.provider}
                  </span>
                </div>
                
                <div className="flex justify-between">
                  <span className="text-base-content/60">模型:</span>
                  <span className="ml-2 text-base-content overflow-hidden text-ellipsis whitespace-nowrap max-w-2/3">
                    {config.model}
                  </span>
                </div>
                
                <div className="flex justify-between">
                  <span className="text-base-content/60">温度:</span>
                  <span className="text-base-content">
                    {config.temperature}
                  </span>
                </div>
                
                <div className="flex justify-between">
                  <span className="text-base-content/60">最大令牌:</span>
                  <span className="text-base-content">
                    {config.maxTokens}
                  </span>
                </div>
              </div>

              <div className="mt-4 pt-4 border-t border-base-300 mt-auto">
                <div className="flex space-x-1">
                  <div className="dropdown dropdown-top dropdown-start">
                    <label tabIndex={0} className="btn btn-sm btn-ghost">
                      <MoreHorizontal className="h-4 w-4" />
                    </label>
                    <ul tabIndex={0} className="dropdown-content menu bg-base-100 rounded-box z-[1] w-44 p-2 shadow-lg">
                      <li>
                        <a onClick={() => handleEdit(config)} className="gap-3">
                          <Edit className="h-4 w-4" />
                          编辑
                        </a>
                      </li>
                      <li>
                        <a onClick={() => testConnection(config)} className="gap-3">
                          <Wifi className="h-4 w-4" />
                          测试连接
                        </a>
                      </li>
                      <li>
                        <a onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          handleDelete(config.id);
                        }}
                          className="gap-3 text-error"
                        >
                          <Trash2 className="h-4 w-4" />
                          删除
                        </a>
                      </li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
            </div>
          ))}
        </div>
      )}

      {/* 编辑/添加模态框（ConfigModal） */}
      <ConfigModal
        isOpen={isEditing}
        onClose={handleCancel}
        onConfirm={handleSave}
        initialConfig={editingConfig}
        title={editingConfig ? '编辑配置' : '添加配置'}
      />

      {/* 确认删除对话框 */}
      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        onClose={() => setConfirmDialog({ isOpen: false, configId: '', configName: '' })}
        onConfirm={confirmDelete}
        title="删除配置"
        message={`确定要删除配置 "${confirmDialog.configName}" 吗？此操作不可撤销。`}
        confirmText="删除"
        cancelText="取消"
        variant="danger"
      />
    </div>
  );
};

export default ConfigSettings;
