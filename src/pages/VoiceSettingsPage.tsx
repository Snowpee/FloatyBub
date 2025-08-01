import React, { useState, useEffect, useRef } from 'react';
import { Volume2, Play, Square, RefreshCw, Settings, Plus, Trash2, Save, Activity, X } from 'lucide-react';
import { toast } from '../hooks/useToast';

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
}

interface VoiceSettingsPageProps {
  onCloseModal?: () => void;
}

const VoiceSettingsPage: React.FC<VoiceSettingsPageProps> = ({ onCloseModal }) => {
  const [settings, setSettings] = useState<VoiceSettings>({
    provider: 'fish-audio',
    apiUrl: 'https://api.fish.audio',
    apiKey: '',
    readingMode: 'all',
    customModels: []
  });
  
  const [tempSettings, setTempSettings] = useState<VoiceSettings>({
    provider: 'fish-audio',
    apiUrl: 'https://api.fish.audio',
    apiKey: '',
    readingMode: 'all',
    customModels: []
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

  // 预设的语音模型
  const presetModels: VoiceModel[] = [
    { id: '59cb5986671546eaa6ca8ae6f29f6d22', name: '央视配音', description: '专业新闻播报风格', isPreset: true },
    { id: 'faccba1a8ac54016bcfc02761285e67f', name: '电台女声', description: '温柔电台主播风格', isPreset: true }
  ];

  // 从本地存储加载设置
  useEffect(() => {
    const savedSettings = localStorage.getItem('voiceSettingsPage');
    if (savedSettings) {
      try {
        const parsed = JSON.parse(savedSettings);
        // 确保包含预设模型
        const customModels = parsed.customModels || [];
        const allModels = [...presetModels, ...customModels.filter((m: VoiceModel) => !m.isPreset)];
        const loadedSettings = { ...settings, ...parsed, customModels: allModels };
        setSettings(loadedSettings);
        setTempSettings(loadedSettings);
      } catch (error) {
        console.error('加载语音设置失败:', error);
        // 如果加载失败，至少设置预设模型
        const defaultSettings = { ...settings, customModels: presetModels };
        setSettings(defaultSettings);
        setTempSettings(defaultSettings);
      }
    } else {
      // 首次使用，设置预设模型
      const defaultSettings = { ...settings, customModels: presetModels };
      setSettings(defaultSettings);
      setTempSettings(defaultSettings);
    }
  }, []);

  // 解析模型ID或网址
  const parseModelInput = (input: string): string => {
    if (input.includes('fish.audio/zh-CN/m/')) {
      const match = input.match(/\/m\/([a-f0-9]+)\/?/);
      return match ? match[1] : input;
    }
    return input;
  };

  // 检查API健康状态和密钥有效性
  const checkApiHealth = async () => {
    setIsCheckingHealth(true);
    
    let currentApiStatus: 'online' | 'offline' | 'unknown' = 'unknown';
    let currentKeyStatus: 'valid' | 'invalid' | 'unknown' = 'unknown';
    
    // 检查API连通性
    try {
      const apiBaseUrl = import.meta.env.PROD ? '' : 'http://localhost:3001';
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
    
    // 检查密钥有效性
    if (tempSettings.apiKey.trim()) {
      try {
        const apiBaseUrl = import.meta.env.PROD ? '' : 'http://localhost:3001';
        const response = await fetch(`${apiBaseUrl}/api/validate-key`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': import.meta.env.VITE_API_SECRET || ''
          },
          body: JSON.stringify({
            apiKey: tempSettings.apiKey,
            apiUrl: tempSettings.apiUrl
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
    
    // 显示结果提示 - 使用局部变量而不是状态变量
    const apiMsg = currentApiStatus === 'online' ? 'API 连接正常' : 'API 连接失败';
    const keyMsg = currentKeyStatus === 'valid' ? '密钥验证通过' : '密钥验证失败';
    
    if (currentApiStatus === 'online' && currentKeyStatus === 'valid') {
      toast.success(`${apiMsg}，${keyMsg}`);
    } else {
      toast.error(`${apiMsg}，${keyMsg}`);
    }
  };

  // 获取模型信息
  const fetchModelInfo = async (modelId: string): Promise<VoiceModel | null> => {
    try {
      const apiBaseUrl = import.meta.env.PROD ? '' : 'http://localhost:3001';
      const response = await fetch(`${apiBaseUrl}/api/model-info?modelId=${encodeURIComponent(modelId)}`, {
        headers: {
          'x-api-key': import.meta.env.VITE_API_SECRET || ''
        }
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success && data.model) {
          return {
            id: data.model.id,
            name: data.model.title,
            description: data.model.description,
            author: data.model.author,
            tags: data.model.tags,
            isPreset: false
          };
        }
      }
      return null;
    } catch (error) {
      console.error('获取模型信息失败:', error);
      return null;
    }
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
    setNewModelInput('');
    setNewModelNote('');
  };

  // 添加自定义模型
  const addCustomModel = async () => {
    if (!newModelInput.trim()) {
      toast.error('请输入模型ID或网址');
      return;
    }

    if (!tempSettings.apiKey.trim()) {
      toast.error('请先设置 Fish Audio API 密钥');
      return;
    }

    setIsAddingModel(true);
    try {
      const modelId = parseModelInput(newModelInput.trim());
      
      // 检查是否已存在
      if (tempSettings.customModels.some(m => m.id === modelId)) {
        toast.error('该模型已存在');
        return;
      }

      // 获取模型信息
      const modelInfo = await fetchModelInfo(modelId);
      if (modelInfo) {
        const newModel: VoiceModel = {
          ...modelInfo,
          userNote: newModelNote.trim()
        };

        setTempSettings({
          ...tempSettings,
          customModels: [...tempSettings.customModels, newModel]
        });

        closeAddModelModal();
        toast.success(`成功添加模型: ${modelInfo.name}`);
      } else {
        toast.error('无法获取模型信息，请检查模型ID是否正确');
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
    const model = tempSettings.customModels.find(m => m.id === modelId);
    if (model?.isPreset) {
      toast.error('不能删除预设模型');
      return;
    }

    setTempSettings({
      ...tempSettings,
      customModels: tempSettings.customModels.filter(m => m.id !== modelId)
    });
    toast.success('模型已删除');
  };

  // 更新模型备注
  const updateModelNote = (modelId: string, note: string) => {
    setTempSettings({
      ...tempSettings,
      customModels: tempSettings.customModels.map(m => 
        m.id === modelId ? { ...m, userNote: note } : m
      )
    });
  };

  // 保存设置到本地存储
  const saveSettings = (newSettings: VoiceSettings) => {
    setSettings(newSettings);
    localStorage.setItem('voiceSettingsPage', JSON.stringify(newSettings));
    toast.success('设置已保存');
  };

  // 加载音色列表
  const loadVoiceModels = async () => {
    if (settings.provider !== 'fish-audio') {
      toast.error('当前供应商不支持加载音色列表');
      return;
    }

    if (!settings.apiKey.trim()) {
      toast.error('请先设置 API 密钥');
      return;
    }

    setIsLoadingModels(true);
    try {
      // 根据环境选择 API 地址
      const apiBaseUrl = import.meta.env.PROD ? '' : 'http://localhost:3001';
      const response = await fetch(`${apiBaseUrl}/api/tts`, {
        method: 'GET',
        headers: {
          'x-api-key': import.meta.env.VITE_API_SECRET || ''
        }
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success && data.models) {
          // 将预设模型和API返回的模型合并
          const apiModels = data.models.map((model: string) => ({
            id: model,
            name: model,
            description: '系统模型'
          }));
          setModels([...presetModels, ...apiModels]);
          toast.success(`成功加载 ${presetModels.length + apiModels.length} 个音色`);
        } else {
          setModels(presetModels);
          toast.info('使用预设音色列表');
        }
      } else {
        throw new Error('API 请求失败');
      }
    } catch (error) {
      console.error('加载音色列表失败:', error);
      setModels(presetModels);
      toast.error('加载失败，使用预设音色列表');
    } finally {
      setIsLoadingModels(false);
    }
  };

  // 试听音色
  const testVoice = async (modelId: string) => {
    if (tempSettings.provider !== 'fish-audio') {
      toast.error('当前供应商不支持试听功能');
      return;
    }

    if (!tempSettings.apiKey.trim()) {
      toast.error('请先设置 API 密钥');
      return;
    }

    if (!modelId.trim()) {
      toast.error('请选择音色模型');
      return;
    }

    // 停止当前播放
    if (audioRef) {
      audioRef.pause();
      audioRef.currentTime = 0;
    }

    setPlayingVoiceId(modelId);
    
    try {
      const testText = `你好，这是语音试听测试。`;
      
      const requestData = {
        text: testText,
        format: 'mp3',
        mp3_bitrate: 128,
        normalize: true,
        latency: 'normal',
        chunk_length: 200,
        model: 'speech-1.6',
        fish_audio_key: tempSettings.apiKey,
        reference_id: modelId
      };

      // 根据环境选择 API 地址
      const apiBaseUrl = import.meta.env.PROD ? '' : 'http://localhost:3001';
      const response = await fetch(`${apiBaseUrl}/api/tts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': import.meta.env.VITE_API_SECRET || ''
        },
        body: JSON.stringify(requestData)
      });

      if (!response.ok) {
        throw new Error('语音生成失败');
      }

      const audioBlob = await response.blob();
      const audioUrl = URL.createObjectURL(audioBlob);
      
      const audio = new Audio(audioUrl);
      setAudioRef(audio);
      
      audio.onended = () => {
        setPlayingVoiceId(null);
        URL.revokeObjectURL(audioUrl);
      };
      
      audio.onerror = () => {
        setPlayingVoiceId(null);
        URL.revokeObjectURL(audioUrl);
        toast.error('音频播放失败');
      };
      
      await audio.play();
      toast.success('开始播放试听');
      
    } catch (error) {
      console.error('试听失败:', error);
      setPlayingVoiceId(null);
      toast.error('试听失败，请检查网络连接和API配置');
    }
  };

  // 停止试听
  const stopVoice = () => {
    if (audioRef) {
      audioRef.pause();
      audioRef.currentTime = 0;
    }
    setPlayingVoiceId(null);
  };

  // 添加音色ID
  const addVoiceId = () => {
    setTempSettings({
      ...tempSettings,
      customModels: [...tempSettings.customModels, {
        id: '',
        name: '新音色',
        description: '',
        isPreset: false
      }]
    });
  };

  // 更新音色ID
  const updateVoiceId = (index: number, newId: string) => {
    const updatedModels = [...tempSettings.customModels];
    updatedModels[index] = { ...updatedModels[index], id: newId };
    setTempSettings({
      ...tempSettings,
      customModels: updatedModels
    });
  };

  // 删除音色ID
  const removeVoiceId = (index: number) => {
    const updatedModels = tempSettings.customModels.filter((_, i) => i !== index);
    setTempSettings({
      ...tempSettings,
      customModels: updatedModels
    });
  };

  // 保存设置
  const handleSaveSettings = () => {
    setSettings(tempSettings);
    localStorage.setItem('voiceSettingsPage', JSON.stringify(tempSettings));
    toast.success('设置已保存');
  };

  return (
    <div className="p-6 max-w-6xl mx-auto md:pt-0">
      <div className="mb-0">
        <p className="text-base-content/70">
          配置文本转语音功能的相关设置
        </p>
      </div>

      {/* 供应商选择 */}
      <h2 className="text-lg font-medium pt-4 pb-2 md:py-6">供应商配置</h2>
      <div className="form-control w-full flex">
        <p className="text-base mb-4 hidden md:block">语音供应商</p>
        <label className="select w-full md:w-1/2 ml-auto">
          <span className="label md:!hidden">语音供应商</span>
          <select 
            value={tempSettings.provider}
            onChange={(e) => setTempSettings({ ...tempSettings, provider: e.target.value as 'fish-audio' | 'other' })}
          >
            <option value="fish-audio">Fish Audio</option>
            <option value="other">其它</option>
          </select>
        </label>
        
      </div>
      {tempSettings.provider === 'other' && (
        <div className="alert alert-info mt-4">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" className="stroke-current shrink-0 w-6 h-6">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
          </svg>
          <span>暂不支持其它供应商</span>
        </div>
      )}

      {/* API 配置 */}
      {tempSettings.provider === 'fish-audio' && (
        <div className="card mt-4">
          <div className="card-body">
            <h3 className="font-medium text-base mb-2">API 配置</h3>
            <div className="grid grid-cols-1 gap-4">
              <div className="flex hero-fieldset">
                <p className="hero-label-md text-base mb-4 hidden md:block">API 地址</p>
                <label className="input w-full md:w-1/2 ml-auto">
                  <span className="label block md:!hidden">API 地址</span>
                  <input
                    type="url"
                    className="w-full"
                    value={tempSettings.apiUrl}
                    onChange={(e) => setTempSettings({ ...tempSettings, apiUrl: e.target.value })}
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
                    value={tempSettings.apiKey}
                    onChange={(e) => setTempSettings({ ...tempSettings, apiKey: e.target.value })}
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
        </div>
      )}

      {/* 自定义模型管理 */}
      {tempSettings.provider === 'fish-audio' && (
        <div className="card my-4">
          <div className="card-body">
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
              {tempSettings.customModels.map((model) => (
                <div key={model.id} className="card bg-base-100 p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h3 className="font-medium text-base">{model.name}</h3>
                        {model.isPreset && (
                          <span className="badge badge-neutral badge-sm">预设</span>
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
                      <p className="text-xs text-base-content/50 font-mono">ID: {model.id}</p>
                    </div>
                    <div className="flex items-center gap-2 ml-4">
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
                  {/* 用户备注 */}
                  <div className="mt-3">
                    <div className="text-sm text-base-content/70 min-h-[2rem] flex items-center px-3 py-2 bg-base-200/50 rounded-md border border-base-300">
                      {model.userNote || '暂无备注'}
                    </div>
                  </div>
                </div>
              ))}
            </div>
            
            {tempSettings.customModels.length === 0 && (
              <div className="text-center py-8 text-base-content/60">
                <Volume2 className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>暂无语音模型，请添加模型开始使用</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 朗读设置 - 始终显示 */}
      <div className="card bg-base-100 shadow-sm mb-6">
        <div className="card-body">
          <h2 className="card-title mb-4">朗读设置</h2>
          <div className="form-control">
            <label className="label cursor-pointer">
              <input
                type="radio"
                name="readingMode"
                className="radio radio-primary"
                checked={tempSettings.readingMode === 'all'}
                onChange={() => setTempSettings({ ...tempSettings, readingMode: 'all' })}
              />
              <span className="label-text">
                <span className="font-medium">全部朗读</span>
                <span className="block text-sm text-base-content/60">朗读所有文本内容</span>
              </span>
            </label>
          </div>
          <div className="form-control">
            <label className="label cursor-pointer">
              <input
                type="radio"
                name="readingMode"
                className="radio radio-primary"
                checked={tempSettings.readingMode === 'dialogue-only'}
                onChange={() => setTempSettings({ ...tempSettings, readingMode: 'dialogue-only' })}
              />
              <span className="label-text">
                <span className="font-medium">仅朗读对白</span>
                <span className="block text-sm text-base-content/60">
                  排除斜体文字（场景描述、心理描述等）
                </span>
              </span>
            </label>
          </div>
        </div>
      </div>

      {/* 保存按钮 */}
      <div className="flex justify-end">
        <button
          className="btn btn-primary"
          onClick={handleSaveSettings}
        >
          <Save className="h-4 w-4 mr-2" />
          保存设置
        </button>
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

          <div className="space-y-4">
            {/* 模型ID/网址输入 */}
            <div className="form-control">
              <label className="label">
                <span className="label-text">模型ID或网址 *</span>
              </label>
              <input
                type="text"
                className="input input-bordered w-full"
                value={newModelInput}
                onChange={(e) => setNewModelInput(e.target.value)}
                placeholder="输入模型ID或Fish Audio网址 (如: https://fish.audio/zh-CN/m/7f92f8afb8ec43bf81429cc1c9199cb1/)"
              />
            </div>

            {/* 备注输入 */}
            <div className="form-control">
              <label className="label">
                <span className="label-text">备注</span>
              </label>
              <input
                type="text"
                className="input input-bordered w-full"
                value={newModelNote}
                onChange={(e) => setNewModelNote(e.target.value)}
                placeholder="添加备注 (可选)"
              />
            </div>
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
              <Plus className="h-4 w-4" />
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