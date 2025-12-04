import React, { useState, useEffect, useMemo } from 'react';
import { X, Check, Loader2, AlertCircle } from 'lucide-react';
import { createPortal } from 'react-dom';
import { cn } from '../../../lib/utils';
import { toast } from '../../../hooks/useToast';
import { getDefaultBaseUrl } from '../../../utils/providerUtils';
import type { LLMConfig } from '../../../store';
import BottomSheetModal from '../../../components/BottomSheetModal';

interface ConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (config: Partial<LLMConfig>) => void;
  initialConfig: Partial<LLMConfig> | null;
  title: string;
}

const ConfigModal: React.FC<ConfigModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  initialConfig,
  title
}) => {
  // 简单的桌面端检测逻辑 (参考 HistoryModal)
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

  // 表单状态
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

  // 获取模型列表相关状态
  const [fetchingModels, setFetchingModels] = useState(false);
  const [fetchedModels, setFetchedModels] = useState<string[]>([]);

  const isFormValid = useMemo(() => {
    const nameOk = (formData.name || '').trim().length > 0;
    const providerOk = !!formData.provider && (formData.provider || '').trim().length > 0;
    const apiKeyOk = (formData.apiKey || '').trim().length > 0;
    const modelOk = (formData.model || '').trim().length > 0;
    return nameOk && providerOk && apiKeyOk && modelOk;
  }, [formData.name, formData.provider, formData.apiKey, formData.model]);

  // 初始化表单数据
  useEffect(() => {
    if (isOpen && initialConfig) {
      setFormData(initialConfig);
      setFetchedModels([]); // 重置模型列表
    } else if (isOpen && !initialConfig) {
      // 重置为默认值
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
      setFetchedModels([]);
    }
  }, [isOpen, initialConfig]);

  const providers = [
    { value: 'openai', label: 'OpenAI', models: ['gpt-3.5-turbo', 'gpt-4', 'gpt-4-turbo'] },
    { value: 'claude', label: 'Claude', models: ['claude-3-haiku', 'claude-3-sonnet', 'claude-3-opus'] },
    { value: 'gemini', label: 'Gemini', models: ['gemini-pro', 'gemini-pro-vision'] },
    { value: 'kimi', label: 'Kimi', models: [
      // kimi-k2 系列
      'kimi-k2-0711-preview',
      'kimi-k2-turbo-preview',
      // kimi-latest 系列
      'kimi-latest',
      'kimi-latest-8k',
      'kimi-latest-32k', 
      'kimi-latest-128k',
      // moonshot-v1 系列
      'moonshot-v1-8k',
      'moonshot-v1-32k',
      'moonshot-v1-128k',
      'moonshot-v1-8k-vision-preview',
      'moonshot-v1-32k-vision-preview',
      'moonshot-v1-128k-vision-preview',
      // 思考模型
      'kimi-thinking-preview'
    ] },
    { value: 'deepseek', label: 'DeepSeek', models: ['deepseek-chat', 'deepseek-reasoner'] },
    { value: 'openrouter', label: 'OpenRouter', models: [
      'openai/gpt-4o',
      'openai/gpt-4o-mini',
      'anthropic/claude-3.5-sonnet',
      'anthropic/claude-3-haiku',
      'google/gemini-pro-1.5',
      'meta-llama/llama-3.1-405b-instruct',
      'meta-llama/llama-3.1-70b-instruct',
      'mistralai/mistral-large',
      'cohere/command-r-plus'
    ] },
    { value: 'custom', label: '自定义', models: [] }
  ];

  // 辅助函数
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

  const getProviderModels = (provider: string) => {
    if (fetchedModels.length > 0) {
      return fetchedModels;
    }
    return providers.find(p => p.value === provider)?.models || [];
  };
  
  const supportsModelsApi = (provider: string) => {
    return ['openai', 'kimi', 'deepseek', 'openrouter', 'custom'].includes(provider);
  };
  
  const fetchModelsList = async () => {
    if (!formData.apiKey || !formData.provider) {
      toast.error('请先填写API密钥和选择提供商');
      return;
    }
    
    if (!supportsModelsApi(formData.provider)) {
      toast.error('该提供商不支持自动获取模型列表');
      return;
    }
    
    setFetchingModels(true);
    toast.info('正在获取模型列表...');
    
    try {
      const baseUrl = formData.baseUrl || getDefaultBaseUrl(formData.provider);
      const url = formData.proxyUrl || baseUrl;
      const endpoint = `${url}/v1/models`;
      
      const headers: Record<string, string> = {
        'Authorization': `Bearer ${formData.apiKey}`,
        'Content-Type': 'application/json'
      };
      
      if (formData.provider === 'openrouter') {
        headers['HTTP-Referer'] = window.location.origin;
        headers['X-Title'] = 'Floaty Bub';
      }
      
      const response = await fetch(endpoint, {
        method: 'GET',
        headers,
        signal: AbortSignal.timeout(10000)
      });
      
      if (response.ok) {
        const data = await response.json();
        const models = data.data?.map((model: any) => model.id) || [];
        
        if (models.length > 0) {
          setFetchedModels(models);
          setFormData(prev => ({ ...prev, model: '' }));
          toast.success(`成功获取到 ${models.length} 个模型`);
        } else {
          toast.warning('未获取到可用模型');
        }
      } else {
        const errorData = await response.json().catch(() => ({}));
        const errorMessage = errorData.error?.message || errorData.message || `HTTP ${response.status}`;
        const simplifiedMessage = simplifyErrorMessage(errorMessage);
        toast.error(`获取模型列表失败: ${simplifiedMessage}`);
      }
    } catch (error: any) {
      if (error.name === 'AbortError') {
        toast.error('获取模型列表超时');
      } else if (error.message.includes('fetch')) {
        toast.error('网络连接失败');
      } else {
        const simplifiedMessage = simplifyErrorMessage(error.message);
        toast.error(`获取模型列表失败: ${simplifiedMessage}`);
      }
    } finally {
      setFetchingModels(false);
    }
  };

  const handleConfirm = () => {
    onConfirm(formData);
  };

  // 表单内容组件
  const FormContent = (
    <div className="flex flex-col gap-4 p-1">
      <fieldset className="fieldset bg-base-100 md:bg-base-200 border-base-300 rounded-box border p-3 md:p-4 gap-3 md:gap-4">
        <div>
          <label className="input w-full">
            <span className="label">配置名称 *</span>
            <input
              type="text"
              value={formData.name || ''}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="grow"
              placeholder="例如: GPT-4"
            />
          </label>
        </div>
        <div>
          <label className="select w-full">
            <span className="label">提供商 *</span>
            <select
              value={formData.provider || 'openai'}
              onChange={(e) => {
                const newProvider = e.target.value as any;
                const newBaseUrl = getDefaultBaseUrl(newProvider);
                setFetchedModels([]);
                setFormData({
                  ...formData,
                  provider: newProvider,
                  model: '',
                  baseUrl: newProvider === 'custom' ? formData.baseUrl : newBaseUrl
                });
              }}
              className="grow"
            >
              {providers.map(provider => (
                <option key={provider.value} value={provider.value}>
                  {provider.label}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="">
          <label className="input w-full pr-2">
            <span className="label">API密钥 *</span>
            <input
              type="password"
              value={formData.apiKey || ''}
              onChange={(e) => {
                setFormData({ ...formData, apiKey: e.target.value });
                if (fetchedModels.length > 0) {
                  setFetchedModels([]);
                  setFormData(prev => ({ ...prev, model: '' }));
                }
              }}
              className=""
              placeholder="输入API密钥"
            />
            {formData.provider && supportsModelsApi(formData.provider) && (
              <button
                type="button"
                onClick={fetchModelsList}
                disabled={fetchingModels || !formData.apiKey}
                className="btn btn-xs"
              >
                {fetchingModels ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    获取中
                  </>
                ) : (
                  '获取模型'
                )}
              </button>
            )}
          </label>
        </div>

        <div className="">
          <label
            className={cn(
              'w-full',
              formData.provider && getProviderModels(formData.provider).length > 0 ? (
                'select'
              ) : (
                'input'
              )
            )}
          >
            <span className="label">模型 *</span>
            {formData.provider && getProviderModels(formData.provider).length > 0 ? (
              <select
                value={formData.model || ''}
                onChange={(e) => setFormData({ ...formData, model: e.target.value })}
                className=""
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
                className=""
                placeholder="输入模型名称"
              />
            )}
          </label>
        </div>

        <div className="">
          <label className="input w-full">
            <span className="label">基础URL</span>
            <input
              type="url"
              value={formData.baseUrl || ''}
              onChange={(e) => setFormData({ ...formData, baseUrl: e.target.value })}
              className=""
              placeholder="https://api.openai.com/v1"
            />
          </label>
        </div>

        <div className="">
          <label className="input w-full">
            <span className="label">代理URL</span>
            <input
              type="url"
              value={formData.proxyUrl || ''}
              onChange={(e) => setFormData({ ...formData, proxyUrl: e.target.value })}
              className=""
              placeholder="http://proxy.example.com:8080"
            />
          </label>
        </div>
      </fieldset>

      <fieldset className="fieldset bg-base-100 md:bg-base-200 border-base-300 rounded-box border p-3 md:p-4 gap-3 md:gap-4">
        <div>
          <label className="input w-full">
            <span className="label">温度</span>
            <input
              type="number"
              min="0"
              max="2"
              step="0.1"
              value={formData.temperature || 0.7}
              onChange={(e) => setFormData({ ...formData, temperature: parseFloat(e.target.value) })}
              className=""
            />
          </label>
        </div>
        <div>
          <label className="input w-full">
            <span className="label">最大令牌</span>
            <input
              type="number"
              min="1"
              max="8192"
              value={formData.maxTokens || 2048}
              onChange={(e) => setFormData({ ...formData, maxTokens: parseInt(e.target.value) })}
              className=""
            />
          </label>
        </div>
      </fieldset>

      <fieldset className="fieldset bg-base-100 md:bg-base-200 border-base-300 rounded-box border p-3 md:p-4">
        <div className="form-control flex items-center">
          <span className="text-sm text-base-content/70">启用此配置</span>
          <label className="label cursor-pointer ml-auto">
            <input
              type="checkbox"
              checked={formData.enabled || false}
              onChange={(e) => setFormData({ ...formData, enabled: e.target.checked })}
              className="toggle toggle-primary"
            />
          </label>
        </div>
      </fieldset>
    </div>
  );

  if (!isOpen) return null;

  // 桌面端渲染
  if (isDesktop) {
    return createPortal(
      <dialog className="modal modal-open modal-middle" open>
        <div className="modal-box w-11/12 max-w-2xl p-0 flex flex-col bg-base-100 shadow-2xl max-h-[90vh]">
          {/* Header */}
          <div className="px-6 py-4 flex items-center justify-between border-b border-base-200">
            <div className="text-lg font-bold text-base-content">{title}</div>
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
            <button className="btn btn-primary" onClick={handleConfirm} disabled={!isFormValid}>
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
        console.log('[ConfigModal] onOpenChange', { open });
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
      headerTitle={<div className="text-center text-lg font-semibold text-base-content">{title}</div>}
      rightActions={[
        { 
          icon: <Check className="h-5 w-5" />, 
          className: 'btn btn-primary btn-square', 
          onClick: handleConfirm,
          disabled: !isFormValid
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

export default ConfigModal;
