import React, { useState, useEffect, useRef } from 'react';
import { Volume2, Play, Square, RefreshCw, Settings, Plus, Trash2, Activity, X, Database } from 'lucide-react';
import { toast } from '../hooks/useToast';
import { useAppStore } from '../store';
import { getApiBaseUrl } from '../lib/utils';
import { getCacheStats, clearAllCache, generateStreamingVoiceUrl } from '../utils/voiceUtils';

interface VoiceModel {
  id: string;
  name: string;
  description?: string;
  author?: string;
  tags?: string[];
  userNote?: string;
  isPreset?: boolean;
}

interface VoiceSettings {
  provider: 'fish-audio' | 'other';
  apiUrl: string;
  apiKey: string;
  readingMode: 'all' | 'dialogue-only';
  customModels: VoiceModel[];
  defaultVoiceModelId?: string;
  modelVersion: string;
}

interface VoiceSettingsPageProps {
  onCloseModal?: () => void;
}

const VoiceSettingsPage: React.FC<VoiceSettingsPageProps> = ({ onCloseModal }) => {
  const { voiceSettings, setVoiceSettings } = useAppStore();
  
  const [settings, setSettings] = useState<VoiceSettings>({
    provider: 'fish-audio',
    apiUrl: 'https://api.fish.audio',
    apiKey: '',
    readingMode: 'all',
    customModels: [],
    modelVersion: 'speech-1.6'
  });
  

  
  const [models, setModels] = useState<VoiceModel[]>([]);
  const [isLoadingModels, setIsLoadingModels] = useState(false);
  const [playingModel, setPlayingModel] = useState<string | null>(null);
  const [playingVoiceId, setPlayingVoiceId] = useState<string | null>(null);
  const [audioRef, setAudioRef] = useState<HTMLAudioElement | null>(null);
  const [newModelInput, setNewModelInput] = useState('');
  const [newModelNote, setNewModelNote] = useState('');
  const [isAddingModel, setIsAddingModel] = useState(false);
  const [apiStatus, setApiStatus] = useState<'unknown' | 'online' | 'offline'>('unknown');
  const [keyStatus, setKeyStatus] = useState<'unknown' | 'valid' | 'invalid'>('unknown');
  const [isCheckingHealth, setIsCheckingHealth] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const modalRef = useRef<HTMLDialogElement>(null);
  const [cacheStats, setCacheStats] = useState({ count: 0, size: 0, sizeFormatted: '0 B' });
  const [isClearingCache, setIsClearingCache] = useState(false);

  // 预设的语音模型
  const presetModels: VoiceModel[] = [
    { id: '59cb5986671546eaa6ca8ae6f29f6d22', name: '央视配音', description: '专业新闻播报风格', isPreset: true },
    { id: 'faccba1a8ac54016bcfc02761285e67f', name: '电台女声', description: '温柔电台主播风格', isPreset: true }
  ];

  // 刷新缓存统计
  const refreshCacheStats = async () => {
    try {
      const stats = await getCacheStats();
      setCacheStats(stats);
    } catch (error) {
      console.error('获取缓存统计失败:', error);
    }
  };

  // 清空所有缓存
  const handleClearCache = async () => {
    setIsClearingCache(true);
    try {
      await clearAllCache();
      await refreshCacheStats();
      toast.success('缓存已清空');
    } catch (error) {
      console.error('清空缓存失败:', error);
      toast.error('清空缓存失败');
    } finally {
      setIsClearingCache(false);
    }
  };

  // 从store或本地存储加载设置
  useEffect(() => {
    let loadedSettings: VoiceSettings;
    
    // 优先从store获取语音设置
    if (voiceSettings) {
      loadedSettings = { ...voiceSettings, modelVersion: voiceSettings.modelVersion || 'speech-1.6' };
    } else {
      // 如果store中没有，尝试从localStorage加载
      const savedSettings = localStorage.getItem('voiceSettingsPage');
      if (savedSettings) {
        try {
          const parsed = JSON.parse(savedSettings);
          const customModels = parsed.customModels || [];
          const allModels = [...presetModels, ...customModels.filter((m: VoiceModel) => !m.isPreset)];
          loadedSettings = { ...settings, ...parsed, customModels: allModels, modelVersion: parsed.modelVersion || 'speech-1.6' };
          // 同步到store
          setVoiceSettings(loadedSettings);
        } catch (error) {
          console.error('加载语音设置失败:', error);
          loadedSettings = { ...settings, customModels: presetModels, modelVersion: 'speech-1.6' };
        setVoiceSettings(loadedSettings);
        }
      } else {
        // 使用默认设置
        loadedSettings = { ...settings, customModels: presetModels, modelVersion: 'speech-1.6' };
        setVoiceSettings(loadedSettings);
      }
    }
    
    setSettings(loadedSettings);
    refreshCacheStats();
  }, [voiceSettings]);

  // 解析模型ID或网址
  const parseModelInput = (input: string): string => {
    // 支持多种Fish Audio URL格式
    if (input.includes('fish.audio') && input.includes('/m/')) {
      const match = input.match(/\/m\/([a-f0-9]+)\/?/);
      return match ? match[1] : input;
    }
    return input;
  };

  // 保存设置到store和localStorage
  const saveSettings = (newSettings: VoiceSettings) => {
    try {
      localStorage.setItem('voiceSettingsPage', JSON.stringify(newSettings));
      setSettings(newSettings);
      setVoiceSettings(newSettings);
    } catch (error) {
      console.error('保存设置失败:', error);
      toast.error('保存设置失败');
    }
  };

  // 检查API健康状态和密钥有效性
  const checkApiHealth = async () => {
    setIsCheckingHealth(true);
    
    let currentApiStatus: 'online' | 'offline' | 'unknown' = 'unknown';
    let currentKeyStatus: 'valid' | 'invalid' | 'unknown' = 'unknown';
    
    try {
  const apiBaseUrl = getApiBaseUrl();
  const response = await fetch(`${apiBaseUrl}/api/health`, {
        headers: {
          'x-api-key': import.meta.env.VITE_API_SECRET || ''
        }
      });
      
      if (response.ok) {
        currentApiStatus = 'online';
        setApiStatus('online');
      } else {
        currentApiStatus = 'offline';
        setApiStatus('offline');
      }
    } catch (error) {
      currentApiStatus = 'offline';
      setApiStatus('offline');
    }
    
    if (settings.apiKey.trim()) {
      try {
  const apiBaseUrl = getApiBaseUrl();
  const response = await fetch(`${apiBaseUrl}/api/validate-key`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': import.meta.env.VITE_API_SECRET || ''
          },
          body: JSON.stringify({
            apiKey: settings.apiKey,
            apiUrl: settings.apiUrl
          })
        });
        
        if (response.ok) {
          const data = await response.json();
          currentKeyStatus = data.valid ? 'valid' : 'invalid';
          setKeyStatus(data.valid ? 'valid' : 'invalid');
        } else {
          currentKeyStatus = 'invalid';
          setKeyStatus('invalid');
        }
      } catch (error) {
        currentKeyStatus = 'invalid';
        setKeyStatus('invalid');
      }
    } else {
      currentKeyStatus = 'invalid';
      setKeyStatus('invalid');
    }
    
    setIsCheckingHealth(false);
    
    if (currentApiStatus === 'online' && currentKeyStatus === 'valid') {
      toast.success('API连接正常，密钥有效');
    } else if (currentApiStatus === 'offline') {
      toast.error('API连接失败');
    } else if (currentKeyStatus === 'invalid') {
      toast.error('API密钥无效');
    }
  };

  // 获取模型信息
  const fetchModelInfo = async (modelId: string): Promise<VoiceModel | null> => {
    try {
  const apiBaseUrl = getApiBaseUrl();
  const response = await fetch(`${apiBaseUrl}/api/model-info/${encodeURIComponent(modelId)}`, {
        method: 'GET',
        headers: {
          'x-api-key': import.meta.env.VITE_API_SECRET || '',
          'fish-audio-key': settings.apiKey
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        return {
          id: modelId,
          name: data.title || `模型 ${modelId.slice(0, 8)}`,
          description: data.description || '',
          author: (typeof data.author === 'object' ? data.author?.nickname : data.author) || '',
          tags: data.tags || []
        };
      }
    } catch (error) {
      console.error('获取模型信息失败:', error);
    }
    return null;
  };

  // 测试语音（流式播放）
  const testVoice = async (modelId: string) => {
    if (playingVoiceId) {
      stopVoice();
      return;
    }

    try {
      setPlayingVoiceId(modelId);
      
      // 构建语音模型和设置对象
      const voiceModel = { id: modelId, name: '', description: '' };
      const voiceSettings = {
        ...settings,
        apiKey: settings.apiKey,
        modelVersion: settings.modelVersion || 'speech-1.6'
      };
      
      // 生成流式音频URL
      const streamingUrl = generateStreamingVoiceUrl(
        '这是一个语音测试，用来试听当前语音模型的效果。',
        voiceModel,
        voiceSettings
      );
      
      // 创建音频对象并直接使用流式URL
      const audio = new Audio(streamingUrl);
      
      audio.onended = () => {
        setPlayingVoiceId(null);
      };
      
      audio.onerror = (event) => {
        console.error('流式语音播放失败:', event);
        setPlayingVoiceId(null);
        toast.error('语音播放失败');
      };

      audio.onloadstart = () => {
        console.log('开始加载流式测试音频');
      };

      audio.oncanplay = () => {
        console.log('流式测试音频可以开始播放');
      };
      
      setAudioRef(audio);
      await audio.play();
      
    } catch (error) {
      console.error('语音测试失败:', error);
      toast.error('语音测试失败');
      setPlayingVoiceId(null);
    }
  };

  // 停止语音
  const stopVoice = () => {
    if (audioRef) {
      audioRef.pause();
      audioRef.currentTime = 0;
      setAudioRef(null);
    }
    setPlayingVoiceId(null);
  };

  // 添加自定义模型
  const addCustomModel = async () => {
    if (!newModelInput.trim()) {
      toast.error('请输入模型ID或网址');
      return;
    }

    const modelId = parseModelInput(newModelInput.trim());
    
    if (settings.customModels.some(m => m.id === modelId)) {
      toast.error('该模型已存在');
      return;
    }

    setIsAddingModel(true);
    try {
      const modelInfo = await fetchModelInfo(modelId);
      
      if (modelInfo) {
        const newModel: VoiceModel = {
          ...modelInfo,
          userNote: newModelNote.trim() || undefined
        };
        
        const newSettings = {
          ...settings,
          customModels: [...settings.customModels, newModel]
        };
        saveSettings(newSettings);
        
        toast.success(`已添加模型: ${newModel.name}`);
        closeAddModelModal();
      } else {
        const fallbackModel: VoiceModel = {
          id: modelId,
          name: `模型 ${modelId.slice(0, 8)}`,
          userNote: newModelNote.trim() || undefined
        };
        
        const newSettings = {
          ...settings,
          customModels: [...settings.customModels, fallbackModel]
        };
        saveSettings(newSettings);
        
        toast.success(`已添加模型: ${fallbackModel.name}`);
        closeAddModelModal();
      }
    } catch (error) {
      console.error('添加模型失败:', error);
      toast.error('添加模型失败');
    } finally {
      setIsAddingModel(false);
    }
  };

  // 删除自定义模型
  const removeCustomModel = (modelId: string) => {
    const newSettings = {
      ...settings,
      customModels: settings.customModels.filter(m => m.id !== modelId),
      defaultVoiceModelId: settings.defaultVoiceModelId === modelId ? undefined : settings.defaultVoiceModelId
    };
    saveSettings(newSettings);
    toast.success('模型已删除');
  };

  // 打开添加模型弹窗
  const openAddModelModal = () => {
    setNewModelInput('');
    setNewModelNote('');
    setIsModalOpen(true);
    modalRef.current?.showModal();
  };

  // 关闭添加模型弹窗
  const closeAddModelModal = () => {
    setIsModalOpen(false);
    modalRef.current?.close();
  };



  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto md:pt-0">
      <div className="mb-0">
        <p className="text-base-content/70">
          配置文本转语音功能的相关设置
        </p>
      </div>

      {/* 供应商选择 */}
      <div className="card mt-4 mb-4">
        <div className="card-body pt-4 md:pt-6 gap-4">
          <h3 className="font-medium text-base mb-2">供应商配置</h3>
          <div className="form-control w-full flex">
            <p className="text-base mb-4 hidden md:block">语音供应商</p>
            <label className="select w-full md:w-1/2 ml-auto">
              <span className="label md:!hidden">语音供应商</span>
              <select 
                value={settings.provider}
                onChange={(e) => {
                  const newSettings = { ...settings, provider: e.target.value as 'fish-audio' | 'other' };
                  saveSettings(newSettings);
                }}
              >
                <option value="fish-audio">Fish Audio</option>
                <option value="other">其它</option>
              </select>
            </label>
          </div>

      
      {settings.provider === 'other' && (
        <div className="alert alert-warning mb-4">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" className="stroke-current shrink-0 w-6 h-6">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
          </svg>
          <span>暂不支持其它供应商</span>
        </div>
      )}

      {/* API 配置 */}
      {settings.provider === 'fish-audio' && (
          <div>
            <div className="grid grid-cols-1 gap-4">
              <div className="flex hero-fieldset">
                <p className="hero-label-md text-base mb-4 hidden md:block">API 地址</p>
                <label className="input w-full md:w-1/2 ml-auto">
                  <span className="label block md:!hidden">API 地址</span>
                  <input
                    type="url"
                    className="w-full"
                    value={settings.apiUrl}
                    onChange={(e) => {
                      const newSettings = { ...settings, apiUrl: e.target.value };
                      saveSettings(newSettings);
                    }}
                    placeholder="https://api.fish.audio"
                  />
                </label>
              </div>

              <div className="flex hero-fieldset">
                <p className="hero-label-md text-base mb-4 hidden md:block">API 密钥</p>
                <label className="input w-full md:w-1/2 ml-auto">
                  <span className="label block md:!hidden">API 密钥</span>
                  <input
                    type="password"
                    className="w-full"
                    value={settings.apiKey}
                    onChange={(e) => {
                      const newSettings = { ...settings, apiKey: e.target.value };
                      saveSettings(newSettings);
                    }}
                    placeholder="输入你的 Fish Audio API 密钥"
                  />
                </label>
              </div>
            
              {/* 健康检查 */}
              <div className="">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-base">连接状态检查</span>
                  <button
                    className={`btn btn-sm ${isCheckingHealth ? 'btn-disabled' : 'btn-outline'}`}
                    onClick={checkApiHealth}
                    disabled={isCheckingHealth}
                  >
                    {isCheckingHealth ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                      <Activity className="w-4 h-4" />
                    )}
                    {isCheckingHealth ? '检查中...' : '检查连接'}
                  </button>
                </div>
                
                {/* API 状态 */}
                <div className="flex items-center gap-2 mb-2">
                  <div className={`w-3 h-3 rounded-full ${
                    apiStatus === 'online' ? 'bg-success' :
                    apiStatus === 'offline' ? 'bg-error' : 'bg-warning'
                  }`}></div>
                  <span className="text-sm">
                    API 状态: {apiStatus === 'online' ? 
                      '在线' :
                     apiStatus === 'offline' ? 
                      '离线' : 
                      '未知'}
                  </span>
                </div>
                
                {/* 密钥状态 */}
                <div className="flex items-center gap-2">
                  <div className={`w-3 h-3 rounded-full ${
                    keyStatus === 'valid' ? 'bg-success' :
                    keyStatus === 'invalid' ? 'bg-error' : 'bg-warning'
                  }`}></div>
                  <span className="text-sm">
                    密钥状态: {keyStatus === 'valid' ? 
                      '有效' :
                     keyStatus === 'invalid' ? 
                      '无效' : 
                      '未知'}
                  </span>
                </div>
              </div>
            </div>
          </div>

      )}
          </div>
        </div>
      {/* 自定义模型管理 */}
      {settings.provider === 'fish-audio' && (
        <div className="card my-4">
          <div className="card-body pt-4 md:pt-6">
            <h3 className="font-medium text-base mb-4">语音模型管理</h3>
            
            {/* 添加新模型按钮 */}
            <div className="mb-4">
              <button
                onClick={openAddModelModal}
                className="btn btn-base w-full btn-outline border-base-300 bg-base-100 hover:bg-base-200"
              >
                <Plus className="h-4 w-4" />
                添加新模型
              </button>
            </div>

            {/* 模型列表 */}
            <div className="space-y-4">
              {settings.customModels.map((model) => (
                <div key={model.id} className="card bg-base-100 p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h3 className="font-medium text-base">{model.name}</h3>
                        {model.isPreset && (
                          <span className="badge badge-neutral badge-sm">预设</span>
                        )}
                        {settings.defaultVoiceModelId === model.id && (
                          <span className="badge badge-primary badge-sm">默认</span>
                        )}
                      </div>
                      {model.description && (
                        <p className="text-sm text-base-content/70 mb-1">{model.description}</p>
                      )}
                      {model.author && (
                        <p className="text-xs text-base-content/60 mb-1">作者: {model.author}</p>
                      )}
                      {model.tags && model.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1 mb-2">
                          {model.tags.map((tag, index) => (
                            <span key={index} className="badge badge-outline badge-xs">
                              {tag}
                            </span>
                          ))}
                        </div>
                      )}
                      <p className="text-xs text-base-content/50 font-mono">{model.id}</p>
                    </div>

                  </div>
                  {/* 用户备注 */}
                  <div className="mt-3">
                    <div className="text-sm text-base-content/70 flex items-center rounded-md">
                      {model.userNote || ''}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 mr-4">
                    {playingVoiceId === model.id ? (
                      <button
                        className="btn btn-warning btn-sm"
                        onClick={stopVoice}
                      >
                        <Square className="h-4 w-4" />
                      </button>
                    ) : (
                      <button
                        className="btn btn-neutral btn-sm"
                        onClick={() => testVoice(model.id)}
                      >
                        <Play className="h-4 w-4" />
                      </button>
                    )}

                    {!model.isPreset && (
                      <button
                        className="btn btn-error btn-sm"
                        onClick={() => removeCustomModel(model.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
            
            {settings.customModels.length === 0 && (
              <div className="text-center py-8 text-base-content/60">
                <Volume2 className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>暂无语音模型，请添加模型开始使用</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 朗读设置 - 始终显示 */}
      <div className="card bg-base-100 shadow-sm mb-4">
        <div className="card-body pt-4 md:pt-6">
          <h3 className="font-medium text-base mb-4">朗读设置</h3>
          
          {/* 默认语音模型选择 */}
          <div className="form-control flex hero-fieldset mb-2">
            <p className="hero-label-md text-base mb-4 hidden md:block">默认语音</p>
            <label className="select w-full md:w-1/2 ml-auto">
              <span className="label block md:!hidden">默认语音</span>
              <select 
                className="select select-bordered w-full"
                value={settings.defaultVoiceModelId || ''}
                onChange={(e) => {
                  const newSettings = { ...settings, defaultVoiceModelId: e.target.value || undefined };
                  saveSettings(newSettings);
                }}
              >
                <option value="">请选择默认语音模型</option>
                {settings.customModels.map((model) => (
                  <option key={model.id} value={model.id}>
                    {model.name} {model.isPreset ? '(预设)' : ''}
                  </option>
                ))}
              </select>
            </label>
          </div>
          
          {/* 模型版本选择 */}
          <div className="form-control flex hero-fieldset">
            <p className="hero-label-md text-base mb-4 hidden md:block">模型版本</p>
            <label className="select w-full md:w-1/2 ml-auto">
              <span className="label block md:!hidden">模型版本</span>
              <select 
                className="select select-bordered w-full"
                value={settings.modelVersion || 'speech-1.6'}
                onChange={(e) => {
                  const newSettings = { ...settings, modelVersion: e.target.value };
                  saveSettings(newSettings);
                }}
              >
                <option value="speech-1.5">speech-1.5</option>
                <option value="speech-1.6">speech-1.6</option>
                <option value="s1">s1</option>
              </select>
            </label>
          </div>

        </div>
      </div>

      <div className="card bg-base-100 shadow-sm mb-6">
        <div className="card-body pt-4 md:pt-6">
          <h3 className="font-medium text-base mb-4">缓存管理</h3>
          
          {/* 缓存管理 */}
          <div className="mb-4">
            <div className="stats stats-vertical lg:stats-horizontal w-full p-4 mb-4">
              <div className="stat">
                <div className="text-center mb-4">
                  <div className="text-2xl font-bold text-primary">{cacheStats.count}</div>
                  <div className="text-sm text-base-content/60">缓存文件数</div>
                </div>
                <button
                  className="btn btn-base flex-1"
                  onClick={refreshCacheStats}
                >
                  <RefreshCw className="h-4 w-4" />
                  刷新统计
                </button>
              </div>
              
              <div className="stat">

                <div className="text-center mb-4">
                  <div className="text-2xl font-bold text-secondary">
                    {cacheStats.sizeFormatted}
                  </div>
                  <div className="text-sm text-base-content/60">占用空间</div>
                </div>
                <button
                  className={`btn btn-error btn-base flex-1 ${isClearingCache ? 'loading' : ''}`}
                  onClick={handleClearCache}
                  disabled={isClearingCache || cacheStats.count === 0}
                >
                  {isClearingCache ? (
                    <RefreshCw className="h-4 w-4 animate-spin" />
                  ) : (
                    <Trash2 className="h-4 w-4" />
                  )}
                  {isClearingCache ? '清空中...' : '清空缓存'}
                </button>
              </div>
            </div>
            
            <div className="text-sm text-base-content/60">
              <p>• 语音缓存可以提高重复播放的速度</p>
              <p>• 清空缓存不会影响设置，但会重新下载语音文件</p>
            </div>
          </div>
        </div>
      </div>



      {/* 添加模型弹窗 */}
      <dialog ref={modalRef} className="modal">
        <div className="modal-box w-full max-w-md">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-base-content">
              添加新模型
            </h2>
            <button
              onClick={closeAddModelModal}
              className="btn btn-ghost btn-sm btn-circle"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="">
            {/* 模型信息 */}
            <fieldset className="fieldset">
              <label className="input w-full mb-1">
                <input
                  type="text"
                  className=""
                  value={newModelInput}
                  onChange={(e) => setNewModelInput(e.target.value)}
                  placeholder="输入模型ID或Fish Audio网址"
                />
              </label>
            </fieldset>

            {/* 用户备注 */}
            <fieldset className="fieldset">
              <label className="input w-full mb-1">
                <input
                  type="text"
                  className=""
                  value={newModelNote}
                  onChange={(e) => setNewModelNote(e.target.value)}
                  placeholder="为此模型添加备注"
                />
              </label>
            </fieldset>
          </div>

          <div className="modal-action">
            <button
              onClick={closeAddModelModal}
              className="btn btn-ghost"
            >
              取消
            </button>
            <button
              onClick={addCustomModel}
              className="btn btn-primary"
              disabled={isAddingModel || !newModelInput.trim()}
            >
              {isAddingModel ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : (
                <Plus className="h-4 w-4" />
              )}
              {isAddingModel ? '添加中...' : '添加模型'}
            </button>
          </div>
        </div>
        <form method="dialog" className="modal-backdrop">
          <button>close</button>
        </form>
      </dialog>
    </div>
  );
};

export default VoiceSettingsPage;