import React, { useState, useRef, useEffect } from 'react';
import { useAppStore, LLMConfig } from '../store';
import {
  Plus,
  Edit,
  Trash2,
  Save,
  X,
  Eye,
  EyeOff,
  CheckCircle,
  MinusCircle,
  Wifi,
  Loader2,
  Ban
} from 'lucide-react';
import { cn } from '../lib/utils';
import { toast } from '../hooks/useToast';
import ConfirmDialog from '../components/ConfirmDialog';
import EmptyState from '../components/EmptyState';

interface ConfigPageProps {
  onCloseModal?: () => void;
}

const ConfigPage: React.FC<ConfigPageProps> = ({ onCloseModal }) => {
  const {
    llmConfigs,
    addLLMConfig,
    updateLLMConfig,
    deleteLLMConfig,
    setCurrentModel
  } = useAppStore();

  const [isEditing, setIsEditing] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const modalRef = useRef<HTMLDialogElement>(null);
  const [showApiKey, setShowApiKey] = useState<Record<string, boolean>>({});
  const [testingConfigs, setTestingConfigs] = useState<Record<string, boolean>>({});
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    configId: string;
    configName: string;
  }>({ isOpen: false, configId: '', configName: '' });
  const [formData, setFormData] = useState<Partial<LLMConfig>>({
    name: '',
    provider: 'openai',
    apiKey: '',
    baseUrl: '',
    proxyUrl: '',
    model: '',
    temperature: 0.7,
    maxTokens: 2048,
    enabled: true
  });

  const providers = [
    { value: 'openai', label: 'OpenAI', models: ['gpt-3.5-turbo', 'gpt-4', 'gpt-4-turbo'] },
    { value: 'claude', label: 'Claude', models: ['claude-3-haiku', 'claude-3-sonnet', 'claude-3-opus'] },
    { value: 'gemini', label: 'Gemini', models: ['gemini-pro', 'gemini-pro-vision'] },
    { value: 'custom', label: '自定义', models: [] }
  ];

  const handleEdit = (config: LLMConfig) => {
    setFormData(config);
    setEditingId(config.id);
    setIsEditing(true);
    modalRef.current?.showModal();
  };

  const handleAdd = () => {
    setFormData({
      name: '',
      provider: 'openai',
      apiKey: '',
      baseUrl: '',
      proxyUrl: '',
      model: '',
      temperature: 0.7,
      maxTokens: 2048,
      enabled: true
    });
    setEditingId(null);
    setIsEditing(true);
    modalRef.current?.showModal();
  };

  const handleSave = () => {
    if (!formData.name || !formData.apiKey || !formData.model) {
      toast.error('请填写必填字段');
      return;
    }

    if (editingId) {
      updateLLMConfig(editingId, formData);
      toast.success('配置已更新');
    } else {
      addLLMConfig(formData as Omit<LLMConfig, 'id'>);
      toast.success('配置已添加');
    }

    setIsEditing(false);
    setEditingId(null);
    modalRef.current?.close();
  };

  const handleCancel = () => {
    setIsEditing(false);
    setEditingId(null);
    modalRef.current?.close();
  };

  const handleDelete = (id: string) => {
    const config = llmConfigs.find(c => c.id === id);
    setConfirmDialog({
      isOpen: true,
      configId: id,
      configName: config?.name || '未知配置'
    });
  };

  const confirmDelete = () => {
    try {
      deleteLLMConfig(confirmDialog.configId);
      toast.success('配置已删除');
    } catch (error) {
      console.error('删除配置失败:', error);
      toast.error('删除配置失败');
    }
  };

  const toggleApiKeyVisibility = (id: string) => {
    setShowApiKey(prev => ({ ...prev, [id]: !prev[id] }));
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
        max_tokens: 10,
        temperature: 0.1
      };
      
      const headers: Record<string, string> = {
        'Content-Type': 'application/json'
      };
      
      // 根据不同提供商设置认证头
      if (config.provider === 'openai') {
        headers['Authorization'] = `Bearer ${config.apiKey}`;
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
  
  const getDefaultBaseUrl = (provider: string): string => {
    switch (provider) {
      case 'openai':
        return 'https://api.openai.com';
      case 'claude':
        return 'https://api.anthropic.com';
      case 'gemini':
        return 'https://generativelanguage.googleapis.com';
      default:
        return 'https://api.openai.com';
    }
  };
  
  const getApiEndpoint = (provider: string, baseUrl: string): string => {
    switch (provider) {
      case 'openai':
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

  const getProviderModels = (provider: string) => {
    return providers.find(p => p.value === provider)?.models || [];
  };

  // 当模态框关闭时重置状态
  useEffect(() => {
    const dialog = modalRef.current;
    if (dialog) {
      const handleClose = () => {
        setIsEditing(false);
        setEditingId(null);
      };
      dialog.addEventListener('close', handleClose);
      return () => dialog.removeEventListener('close', handleClose);
    }
  }, []);

  return (
    <div className="max-w-6xl mx-auto p-6 md:pt-0">
      <div className="mb-6">
        <p className="text-base-content/60">
          配置和管理您的AI模型连接设置
        </p>
      </div>

      {/* 添加按钮 */}
      <div className="mb-6">
        <button
          onClick={handleAdd}
          className="btn btn-primary"
        >
          <Plus className="h-4 w-4" />
          添加模型配置
        </button>
      </div>

      {/* 配置列表 */}
      {llmConfigs.length === 0 ? (
        <EmptyState message="点击上方按钮添加您的第一个模型配置" />
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
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
                  <div className="group">
                    <button
                      onClick={() => handleEdit(config)}
                      className="btn btn-sm"
                    >
                      <Edit className="h-4 w-4" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        handleDelete(config.id);
                      }}
                      className="btn btn-sm btn-circle btn-soft btn-error ml-2 md:opacity-0 group-hover:opacity-100 transition-opacity duration-200"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                  <button
                    onClick={() => testConnection(config)}
                    disabled={testingConfigs[config.id]}
                    className="btn btn-sm ml-auto"
                  >
                    {testingConfigs[config.id] ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        正在测试
                      </>
                    ) : (
                      <>
                        <Wifi className="h-4 w-4" />
                        测试连接
                      </>
                    )}
                  </button>
                </div>

              </div>
            </div>
            </div>
          ))}
        </div>
      )}

      {/* 编辑/添加模态框 */}
      <dialog ref={modalRef} className="modal">
        <div className="modal-box w-full max-w-md max-h-[90vh] overflow-y-auto">
          <form method="dialog">
            <button className="btn btn-sm btn-circle btn-ghost absolute right-2 top-2">
              <X className="h-5 w-5" />
            </button>
          </form>
          <div className="mb-4">
            <h2 className="text-xl font-bold text-base-content">
              {editingId ? '编辑配置' : '添加配置'}
            </h2>
          </div>

            <fieldset className="fieldset">
              <div>
                <label className="label">
                  <span className="label-text">配置名称 *</span>
                </label>
                <input
                  type="text"
                  value={formData.name || ''}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="input input-bordered w-full"
                  placeholder="例如: GPT-4"
                />
              </div>

              <div>
                <label className="label">
                  <span className="label-text">提供商 *</span>
                </label>
                <select
                  value={formData.provider || 'openai'}
                  onChange={(e) => setFormData({ ...formData, provider: e.target.value as any, model: '' })}
                  className="select select-bordered w-full"
                >
                  {providers.map(provider => (
                    <option key={provider.value} value={provider.value}>
                      {provider.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="label">
                  <span className="label-text">模型 *</span>
                </label>
                {formData.provider && getProviderModels(formData.provider).length > 0 ? (
                  <select
                    value={formData.model || ''}
                    onChange={(e) => setFormData({ ...formData, model: e.target.value })}
                    className="select select-bordered w-full"
                  >
                    <option value="">选择模型</option>
                    {getProviderModels(formData.provider).map(model => (
                      <option key={model} value={model}>
                        {model}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="text"
                    value={formData.model || ''}
                    onChange={(e) => setFormData({ ...formData, model: e.target.value })}
                    className="input input-bordered w-full"
                    placeholder="输入模型名称"
                  />
                )}
              </div>

              <div>
                <label className="label">
                  <span className="label-text">API密钥 *</span>
                </label>
                <input
                  type="password"
                  value={formData.apiKey || ''}
                  onChange={(e) => setFormData({ ...formData, apiKey: e.target.value })}
                  className="input input-bordered w-full"
                  placeholder="输入API密钥"
                />
              </div>

              <div>
                <label className="label">
                  <span className="label-text">基础URL</span>
                </label>
                <input
                  type="url"
                  value={formData.baseUrl || ''}
                  onChange={(e) => setFormData({ ...formData, baseUrl: e.target.value })}
                  className="input input-bordered w-full"
                  placeholder="https://api.openai.com/v1"
                />
              </div>

              <div>
                <label className="label">
                  <span className="label-text">代理URL</span>
                </label>
                <input
                  type="url"
                  value={formData.proxyUrl || ''}
                  onChange={(e) => setFormData({ ...formData, proxyUrl: e.target.value })}
                  className="input input-bordered w-full"
                  placeholder="http://proxy.example.com:8080"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">
                    <span className="label-text">温度</span>
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="2"
                    step="0.1"
                    value={formData.temperature || 0.7}
                    onChange={(e) => setFormData({ ...formData, temperature: parseFloat(e.target.value) })}
                    className="input input-bordered w-full"
                  />
                </div>
                <div>
                  <label className="label">
                    <span className="label-text">最大令牌</span>
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="8192"
                    value={formData.maxTokens || 2048}
                    onChange={(e) => setFormData({ ...formData, maxTokens: parseInt(e.target.value) })}
                    className="input input-bordered w-full"
                  />
                </div>
              </div>

              <div className="form-control">
                <label className="label cursor-pointer">
                  <span className="label-text">启用此配置</span>
                  <input
                    type="checkbox"
                    checked={formData.enabled || false}
                    onChange={(e) => setFormData({ ...formData, enabled: e.target.checked })}
                    className="checkbox checkbox-primary"
                  />
                </label>
              </div>
            </fieldset>
            {/* /结束配置表单 */}

          <div className="modal-action">
            <form method="dialog">
              <button className="btn btn-ghost">
                取消
              </button>
            </form>
            <button
              onClick={handleSave}
              className="btn btn-primary"
            >
              <Save className="h-4 w-4" />
              保存
            </button>
          </div>
        </div>
        <form method="dialog" className="modal-backdrop">
          <button>close</button>
        </form>
      </dialog>

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

export default ConfigPage;