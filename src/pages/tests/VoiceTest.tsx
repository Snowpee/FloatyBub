import React, { useState, useRef, useEffect } from 'react';
import { Play, Square, Download, Volume2, Trash2, Settings } from 'lucide-react';
import { toast } from '../../hooks/useToast';

interface TTSRequest {
  text: string;
  format: 'mp3' | 'wav';
  mp3_bitrate: number;
  reference_id?: string;
  normalize: boolean;
  latency: 'normal' | 'balanced';
  chunk_length: number;
  model?: string;
  fish_audio_key?: string;
}

// 移除VoiceModel接口定义，使用语音设置中的模型结构

interface FishAudioModel {
  _id: string;
  title: string;
  description: string;
  type: string;
  state: string;
}



const VoiceTest: React.FC = () => {
  const [text, setText] = useState('你好，这是一个语音测试。欢迎使用 Fish Audio 文本转语音功能！');
  const [isLoading, setIsLoading] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [serverStatus, setServerStatus] = useState<'unknown' | 'online' | 'offline'>('unknown');
  // 移除voiceModels状态，直接使用customModels
  const [selectedModelId, setSelectedModelId] = useState('59cb5986671546eaa6ca8ae6f29f6d22');
  const [newModelInput, setNewModelInput] = useState('');
  const [newModelNote, setNewModelNote] = useState('');
  const [isAddingModel, setIsAddingModel] = useState(false);
  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const [defaultModel, setDefaultModel] = useState('speech-1.6');
  const [customModels, setCustomModels] = useState<any[]>([]);
  const [fishApiKey, setFishApiKey] = useState('');
  
  // 服务器地址选择相关状态
  const [serverType, setServerType] = useState<'local' | 'vercel' | 'custom'>('local');
  const [customServerUrl, setCustomServerUrl] = useState('');
  
  // 预置服务器选项
  const serverOptions = {
    local: 'http://localhost:3001',
    vercel: 'https://floatybub.vercel.app',
    custom: customServerUrl
  };
  
  // 获取当前API基础URL
  const getApiBaseUrl = () => {
    if (serverType === 'custom') {
      return customServerUrl || 'http://localhost:3001';
    }
    return serverOptions[serverType];
  };
  
  const [config, setConfig] = useState<TTSRequest>({
    text: '',
    format: 'mp3',
    mp3_bitrate: 128,
    normalize: true,
    latency: 'normal',
    chunk_length: 200,
    model: 'speech-1.6'
  });
  
  const audioRef = useRef<HTMLAudioElement>(null);

  // 从本地存储加载设置
  const loadVoiceSettings = () => {
    // 预置的央视配音模型
    const presetModels = [
      {
        id: '59cb5986671546eaa6ca8ae6f29f6d22',
        name: '央视配音',
        description: '专业的央视新闻播音风格，声音清晰、权威、标准',
        userNote: '预置模型 - 央视新闻播音风格'
      }
    ];

    const savedSettings = localStorage.getItem('voiceSettings');
    if (savedSettings) {
      try {
        const parsed = JSON.parse(savedSettings);
        const savedModels = parsed.customModels || [];
        
        // 合并预置模型和用户自定义模型，避免重复
        const allModels = [...presetModels];
        savedModels.forEach((savedModel: any) => {
          if (!allModels.some(model => model.id === savedModel.id)) {
            allModels.push(savedModel);
          }
        });
        
        setCustomModels(allModels);
        setFishApiKey(parsed.apiKey || '');
      } catch (error) {
        console.error('加载语音设置失败:', error);
        // 如果解析失败，至少加载预置模型
        setCustomModels(presetModels);
      }
    } else {
      // 如果没有保存的设置，使用预置模型
      setCustomModels(presetModels);
    }
  };

  // 获取可用模型列表
  const fetchAvailableModels = async () => {
    try {
      const apiBaseUrl = getApiBaseUrl();
      const response = await fetch(`${apiBaseUrl}/api/tts`, {
        method: 'GET',
        headers: {
          'x-api-key': import.meta.env.VITE_API_SECRET || ''
        }
      });
      if (response.ok) {
        const data = await response.json();
        if (data.success && data.models) {
          setAvailableModels(data.models);
          setDefaultModel(data.default || 'speech-1.6');
          // 如果当前选择的模型不在可用列表中，则设置为默认模型
          if (!data.models.includes(config.model)) {
            setConfig(prev => ({ ...prev, model: data.default || 'speech-1.6' }));
          }
          toast.success('成功获取支持的模型列表');
        }
      } else {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
    } catch (error) {
      console.error('获取模型列表失败:', error);
      toast.error(`获取模型列表失败: ${error instanceof Error ? error.message : '未知错误'}`);
      // 如果获取失败，使用默认模型列表
      setAvailableModels(['speech-1.5', 'speech-1.6', 's1']);
    }
  };

  // 检查服务器状态
  const checkServerStatus = async () => {
    try {
      const apiBaseUrl = getApiBaseUrl();
      const response = await fetch(`${apiBaseUrl}/api/health`, {
        headers: {
          'x-api-key': import.meta.env.VITE_API_SECRET || ''
        }
      });
      if (response.ok) {
        const data = await response.json();
        setServerStatus('online');
        toast.success(`服务器连接成功: ${data.status}`);
        console.log('服务器状态:', data);
      } else {
        setServerStatus('offline');
        toast.error(`服务器连接失败: HTTP ${response.status}`);
      }
    } catch (error) {
      setServerStatus('offline');
      toast.error(`服务器连接失败: ${error instanceof Error ? error.message : '未知错误'}`);
      console.error('服务器连接失败:', error);
    }
  };

  // 从URL或ID中提取模型ID
  const extractModelId = (input: string): string => {
    const urlMatch = input.match(/\/m\/([a-f0-9]+)\/?/);
    return urlMatch ? urlMatch[1] : input.trim();
  };

  // 获取Fish Audio模型信息
  const fetchModelInfo = async (modelId: string): Promise<FishAudioModel | null> => {
    try {
      if (!fishApiKey.trim()) {
        throw new Error('请先输入 Fish Audio API Key');
      }

      const apiBaseUrl = getApiBaseUrl();
      const endpoint = serverType === 'vercel' ? '/api/model-info' : '/api/fish-model';
      const response = await fetch(`${apiBaseUrl}${endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': import.meta.env.VITE_API_SECRET || ''
        },
        body: JSON.stringify({
          model_id: modelId,
          fish_audio_key: fishApiKey
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: '未知错误' }));
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('获取模型信息失败:', error);
      throw error;
    }
  };

  // 添加新的音色模型
  const addVoiceModel = async () => {
    if (!newModelInput.trim()) {
      toast.error('请输入模型 ID 或网址');
      return;
    }

    if (!fishApiKey.trim()) {
      toast.error('请先输入 Fish Audio API Key');
      return;
    }

    setIsAddingModel(true);
    setError(null);

    try {
      const modelId = extractModelId(newModelInput);
      
      // 检查是否已存在
      if (customModels.some(model => model.id === modelId)) {
        throw new Error('该模型已存在');
      }

      const modelInfo = await fetchModelInfo(modelId);
      if (!modelInfo) {
        throw new Error('获取模型信息失败');
      }

      const newModel = {
        id: modelId,
        name: modelInfo.title || '未知模型',
        description: modelInfo.description || '暂无描述',
        userNote: newModelNote.trim() || undefined
      };

      const updatedModels = [...customModels, newModel];
      setCustomModels(updatedModels);
      
      // 保存到语音设置
      const voiceSettings = {
        customModels: updatedModels,
        apiKey: fishApiKey
      };
      localStorage.setItem('voiceSettings', JSON.stringify(voiceSettings));
      
      setNewModelInput('');
      setNewModelNote('');
      setSelectedModelId(modelId);
      
      toast.success(`成功添加音色模型: ${newModel.name}`);
      console.log('音色模型添加成功:', newModel);
    } catch (error) {
      console.error('添加音色模型失败:', error);
      toast.error(`添加模型失败: ${error instanceof Error ? error.message : '未知错误'}`);
      setError(error instanceof Error ? error.message : '添加音色模型失败');
    } finally {
      setIsAddingModel(false);
    }
  };

  // 删除音色模型
  const removeVoiceModel = (modelId: string) => {
    const updatedModels = customModels.filter(model => model.id !== modelId);
    setCustomModels(updatedModels);
    
    // 保存到语音设置
    const voiceSettings = {
      customModels: updatedModels,
      apiKey: fishApiKey
    };
    localStorage.setItem('voiceSettings', JSON.stringify(voiceSettings));
    
    if (selectedModelId === modelId && updatedModels.length > 0) {
      setSelectedModelId(updatedModels[0].id);
    }
    
    toast.success('音色模型已删除');
  };

  // 生成语音
  const generateSpeech = async () => {
    if (!text.trim()) {
      toast.error('请输入要转换的文本');
      return;
    }

    if (!fishApiKey.trim()) {
      toast.error('请先输入 Fish Audio API Key');
      return;
    }

    setIsLoading(true);
    setError(null);
    
    try {
      const apiBaseUrl = getApiBaseUrl();
      
      // 根据服务器类型调整请求数据格式
      let requestData: any;
      if (serverType === 'vercel') {
        // Vercel API 格式
        requestData = {
          text: text,
          model: config.model,
          format: config.format,
          normalize: config.normalize,
          latency: config.latency,
          fish_audio_key: fishApiKey,
          reference_id: selectedModelId
        };
      } else {
        // 本地 TTS 服务器格式
        requestData = {
          text,
          format: config.format,
          mp3_bitrate: config.mp3_bitrate,
          normalize: config.normalize,
          latency: config.latency,
          chunk_length: config.chunk_length,
          model: config.model,
          fish_audio_key: fishApiKey,
          reference_id: selectedModelId
        };
      }

      console.log('发送 TTS 请求:', {
        text: text.substring(0, 50) + '...',
        format: config.format
      });

      const response = await fetch(`${apiBaseUrl}/api/tts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': import.meta.env.VITE_API_SECRET || ''
        },
        body: JSON.stringify(requestData)
      });

      if (!response.ok) {
        const errorText = await response.text();
        let errorMessage;
        try {
          const errorData = JSON.parse(errorText);
          errorMessage = errorData.error || errorData.message || `HTTP ${response.status}: ${response.statusText}`;
        } catch {
          errorMessage = `HTTP ${response.status}: ${response.statusText}`;
        }
        throw new Error(errorMessage);
      }

      const audioBlob = await response.blob();
      const url = URL.createObjectURL(audioBlob);
      
      // 清理之前的 URL
      if (audioUrl) {
        URL.revokeObjectURL(audioUrl);
      }
      
      setAudioUrl(url);
      toast.success('语音生成成功！');
      console.log('语音生成成功');
      
    } catch (error) {
      console.error('语音生成失败:', error);
      const errorMsg = error instanceof Error ? error.message : '语音生成失败';
      toast.error(`语音生成失败: ${errorMsg}`);
      setError(errorMsg);
    } finally {
      setIsLoading(false);
    }
  };

  // 播放音频
  const playAudio = () => {
    if (audioRef.current && audioUrl) {
      audioRef.current.play();
      toast.success('开始播放音频');
    }
  };

  // 停止音频
  const stopAudio = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      toast.info('音频播放已停止');
    }
  };

  // 下载音频
  const downloadAudio = () => {
    if (audioUrl) {
      const a = document.createElement('a');
      a.href = audioUrl;
      a.download = `tts_${Date.now()}.${config.format}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      toast.success('音频下载已开始');
    }
  };



  // 页面加载时检查服务器状态和获取模型列表
  useEffect(() => {
    checkServerStatus();
    fetchAvailableModels();
    loadVoiceSettings();
  }, []);
  
  // 当服务器类型或自定义地址改变时重新检查状态
  useEffect(() => {
    checkServerStatus();
    fetchAvailableModels();
  }, [serverType, customServerUrl]);

  // API Key自动保存
  useEffect(() => {
    if (fishApiKey.trim()) {
      const voiceSettings = {
        customModels,
        apiKey: fishApiKey
      };
      localStorage.setItem('voiceSettings', JSON.stringify(voiceSettings));
    }
  }, [fishApiKey, customModels]);

  // 清理 URL
  React.useEffect(() => {
    return () => {
      if (audioUrl) {
        URL.revokeObjectURL(audioUrl);
      }
    };
  }, [audioUrl]);

  return (
    <div className="min-h-screen bg-base-100 p-6">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-base-content mb-2">
            🎵 Fish Audio 语音测试
          </h1>
          <p className="text-base-content/70">
            测试 Fish Audio 文本转语音功能
          </p>
        </div>

        {/* 服务器选择和状态 */}
        <div className="card bg-base-200 shadow-sm mb-6">
          <div className="card-body">
            <div className="flex items-center justify-between mb-4">
              <h2 className="card-title">服务器配置</h2>
              <button 
                className="btn btn-sm btn-outline"
                onClick={checkServerStatus}
              >
                刷新状态
              </button>
            </div>
            
            {/* 服务器选择 */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              <div>
                <label className="label">
                  <span className="label-text">服务器类型</span>
                </label>
                <select 
                  className="select select-bordered w-full"
                  value={serverType}
                  onChange={(e) => setServerType(e.target.value as 'local' | 'vercel' | 'custom')}
                >
                  <option value="local">本地服务器</option>
                  <option value="vercel">Vercel 部署</option>
                  <option value="custom">自定义地址</option>
                </select>
              </div>
              
              {serverType === 'custom' && (
                <div className="md:col-span-2">
                  <label className="label">
                    <span className="label-text">自定义服务器地址</span>
                  </label>
                  <input
                    type="text"
                    className="input input-bordered w-full"
                    placeholder="http://localhost:3001"
                    value={customServerUrl}
                    onChange={(e) => setCustomServerUrl(e.target.value)}
                  />
                </div>
              )}
            </div>
            
            {/* 当前服务器地址显示 */}
            <div className="mb-4">
              <div className="text-sm text-base-content/70">当前服务器地址:</div>
              <div className="text-sm font-mono bg-base-300 px-2 py-1 rounded">
                {getApiBaseUrl()}
              </div>
            </div>
            
            {/* 服务器状态 */}
            <div className="flex items-center gap-2">
              <div className={`w-3 h-3 rounded-full ${
                serverStatus === 'online' ? 'bg-success' :
                serverStatus === 'offline' ? 'bg-error' : 'bg-warning'
              }`}></div>
              <span className="text-sm">
                {serverStatus === 'online' ? 
                  '在线' :
                 serverStatus === 'offline' ? 
                  '离线 - API 服务不可用' : 
                  '检查中...'}
              </span>
            </div>
          </div>
        </div>

        {/* 文本输入 */}
        <div className="card bg-base-200 shadow-sm mb-6">
          <div className="card-body">
            <h2 className="card-title mb-4">📝 输入文本</h2>
            <textarea
              className="textarea textarea-bordered w-full h-32 text-base"
              placeholder="请输入要转换为语音的文本..."
              value={text}
              onChange={(e) => setText(e.target.value)}
              disabled={isLoading}
            />
            <div className="text-sm text-base-content/60 mt-2">
              字符数: {text.length}
            </div>
          </div>
        </div>

        {/* 配置选项 */}
        <div className="card bg-base-200 shadow-sm mb-6">
          <div className="card-body">
            <h2 className="card-title mb-4">⚙️ 配置选项</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <label className="label">
                  <span className="label-text">音频格式</span>
                </label>
                <select 
                  className="select select-bordered w-full"
                  value={config.format}
                  onChange={(e) => setConfig(prev => ({ ...prev, format: e.target.value as 'mp3' | 'wav' }))}
                >
                  <option value="mp3">MP3</option>
                  <option value="wav">WAV</option>
                </select>
              </div>
              
              <div>
                <label className="label">
                  <span className="label-text">MP3 比特率</span>
                </label>
                <select 
                  className="select select-bordered w-full"
                  value={config.mp3_bitrate}
                  onChange={(e) => setConfig(prev => ({ ...prev, mp3_bitrate: parseInt(e.target.value) }))}
                  disabled={config.format !== 'mp3'}
                >
                  <option value={64}>64 kbps</option>
                  <option value={128}>128 kbps</option>
                  <option value={192}>192 kbps</option>
                  <option value={320}>320 kbps</option>
                </select>
              </div>
              
              <div>
                <label className="label">
                  <span className="label-text">延迟模式</span>
                </label>
                <select 
                  className="select select-bordered w-full"
                  value={config.latency}
                  onChange={(e) => setConfig(prev => ({ ...prev, latency: e.target.value as 'normal' | 'balanced' }))}
                >
                  <option value="normal">普通</option>
                  <option value="balanced">平衡</option>
                </select>
              </div>
              
              <div>
                <label className="label">
                  <span className="label-text">文本块长度</span>
                </label>
                <input 
                  type="number"
                  className="input input-bordered w-full"
                  value={config.chunk_length}
                  onChange={(e) => setConfig(prev => ({ ...prev, chunk_length: parseInt(e.target.value) || 200 }))}
                  min={50}
                  max={500}
                />
              </div>
              
              <div>
                <label className="label">
                  <span className="label-text">AI 模型</span>
                </label>
                <select 
                  className="select select-bordered w-full"
                  value={config.model}
                  onChange={(e) => setConfig(prev => ({ ...prev, model: e.target.value }))}
                >
                  {availableModels.length > 0 ? (
                    availableModels.map((model) => (
                      <option key={model} value={model}>
                        {model === 'speech-1.5' ? 'Speech 1.5' :
                         model === 'speech-1.6' ? 'Speech 1.6' :
                         model === 's1' ? 'S1' : model}
                      </option>
                    ))
                  ) : (
                    <option value={config.model}>加载中...</option>
                  )}
                </select>
              </div>
              
              <div className="flex items-center">
                <label className="label cursor-pointer">
                  <input 
                    type="checkbox"
                    className="checkbox checkbox-primary"
                    checked={config.normalize}
                    onChange={(e) => setConfig(prev => ({ ...prev, normalize: e.target.checked }))}
                  />
                  <span className="label-text ml-2">标准化音频</span>
                </label>
              </div>
            </div>
          </div>
        </div>

        {/* Fish Audio API Key */}
        <div className="card bg-base-200 shadow-sm mb-6">
          <div className="card-body">
            <h2 className="card-title mb-4">🔑 Fish Audio API Key</h2>
            <div className="form-control">
              <label className="label">
                <span className="label-text">请输入您的 Fish Audio API Key</span>
              </label>
              <input
                type="password"
                placeholder="输入 Fish Audio API Key"
                className="input input-bordered w-full"
                value={fishApiKey}
                onChange={(e) => setFishApiKey(e.target.value)}
              />
              <label className="label">
                <span className="label-text-alt">API Key 将保存在本地浏览器中</span>
              </label>
            </div>
          </div>
        </div>

        {/* 语音模型管理 */}
        <div className="card bg-base-200 shadow-sm mb-6">
          <div className="card-body">
            <h2 className="card-title mb-4">🎤 语音模型管理</h2>
            
            {/* 当前选择的模型 */}
            <div className="mb-4">
              <label className="label">
                <span className="label-text">选择语音模型</span>
              </label>
              <div className="space-y-3">
                {/* API密钥状态 */}
                 {!fishApiKey && (
                   <div className="alert alert-warning">
                     <svg xmlns="http://www.w3.org/2000/svg" className="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24">
                       <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.5 0L4.268 18.5c-.77.833.192 2.5 1.732 2.5z" />
                     </svg>
                     <span>请先配置 Fish Audio API 密钥</span>
                   </div>
                 )}
                
                {/* 自定义模型列表 */}
                {customModels.length > 0 ? (
                  <div className="space-y-2">
                    <div className="text-sm font-medium text-base-content/70">可用模型:</div>
                    <div className="grid grid-cols-1 gap-2">
                      {customModels.map((model) => (
                        <div
                          key={model.id}
                          className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                            selectedModelId === model.id
                              ? 'border-primary bg-primary/10'
                              : 'border-base-300 hover:border-primary/50'
                          }`}
                          onClick={() => setSelectedModelId(model.id)}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <span className="font-medium">{model.name}</span>
                              </div>
                              {model.description && (
                                <p className="text-xs text-base-content/60 mt-1">{model.description}</p>
                              )}
                              {model.userNote && (
                                <p className="text-xs text-base-content/50 mt-1 italic">备注: {model.userNote}</p>
                              )}
                            </div>
                            <input
                              type="radio"
                              name="voice-model"
                              className="radio radio-primary"
                              checked={selectedModelId === model.id}
                              onChange={() => setSelectedModelId(model.id)}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-4 text-base-content/60">
                    <p>暂无可用模型</p>
                    <p className="text-sm mt-1">请添加语音模型</p>
                  </div>
                )}
                
                {/* 直接输入模型ID */}
                <div className="form-control">
                  <label className="label">
                    <span className="label-text text-sm">或直接输入模型ID</span>
                  </label>
                  <input
                    type="text"
                    className="input input-bordered input-sm"
                    value={selectedModelId}
                    onChange={(e) => setSelectedModelId(e.target.value)}
                    placeholder="输入模型ID"
                  />
                </div>
              </div>
            </div>

            {/* 模型列表 */}
            <div className="mb-4">
              <h3 className="font-semibold mb-2">已保存的模型:</h3>
              <div className="space-y-2">
                {customModels.map((model) => (
                  <div key={model.id} className="flex items-center justify-between p-3 bg-base-100 rounded-lg">
                    <div className="flex-1">
                      <div className="font-medium">{model.name}</div>
                      <div className="text-sm text-base-content/70">{model.description}</div>
                      {model.userNote && (
                        <div className="text-xs text-base-content/50 mt-1">备注: {model.userNote}</div>
                      )}
                      <div className="text-xs text-base-content/50 mt-1">ID: {model.id}</div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        className="btn btn-sm btn-primary"
                        onClick={() => setSelectedModelId(model.id)}
                        disabled={selectedModelId === model.id}
                      >
                        {selectedModelId === model.id ? '已选择' : '选择'}
                      </button>
                      {customModels.length > 1 && (
                        <button
                          className="btn btn-sm btn-error"
                          onClick={() => removeVoiceModel(model.id)}
                        >
                          删除
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* 添加新模型 */}
            <div className="border-t pt-4">
              <h3 className="font-semibold mb-2">添加新的音色模型:</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="label">
                    <span className="label-text">模型 ID 或网址</span>
                  </label>
                  <input
                    type="text"
                    placeholder="输入模型 ID 或 https://fish.audio/zh-CN/m/xxx/"
                    className="input input-bordered w-full"
                    value={newModelInput}
                    onChange={(e) => setNewModelInput(e.target.value)}
                  />
                </div>
                <div>
                  <label className="label">
                    <span className="label-text">备注 (可选)</span>
                  </label>
                  <input
                    type="text"
                    placeholder="为这个模型添加备注"
                    className="input input-bordered w-full"
                    value={newModelNote}
                    onChange={(e) => setNewModelNote(e.target.value)}
                  />
                </div>
              </div>
              <button
                className={`btn btn-secondary mt-4 ${isAddingModel ? 'loading' : ''}`}
                onClick={addVoiceModel}
                disabled={isAddingModel || !newModelInput.trim() || !fishApiKey.trim()}
              >
                {isAddingModel ? '添加中...' : '添加模型'}
              </button>
            </div>
          </div>
        </div>

        {/* 生成按钮 */}
        <div className="card bg-base-200 shadow-sm mb-6">
          <div className="card-body">
            <button 
              className={`btn btn-primary btn-lg w-full ${
                isLoading ? 'loading' : ''
              }`}
              onClick={generateSpeech}
              disabled={isLoading || !text.trim() || serverStatus !== 'online' || !fishApiKey.trim()}
            >
              {isLoading ? '生成中...' : '🎵 生成语音'}
            </button>
            
            {serverStatus !== 'online' && (
              <div className="alert alert-warning mt-4">
                <span>请先启动后端服务: cd tts-server && npm run dev</span>
              </div>
            )}
            
            {!fishApiKey.trim() && (
              <div className="alert alert-info mt-4">
                <span>请先输入 Fish Audio API Key</span>
              </div>
            )}
          </div>
        </div>

        {/* 错误信息 */}
        {error && (
          <div className="alert alert-error mb-6">
            <span>{error}</span>
          </div>
        )}

        {/* 音频播放器 */}
        {audioUrl && (
          <div className="card bg-base-200 shadow-sm mb-6">
            <div className="card-body">
              <h2 className="card-title mb-4">🔊 生成的语音</h2>
              
              <audio 
                ref={audioRef}
                src={audioUrl}
                controls
                className="w-full mb-4"
              />
              
              <div className="flex gap-2">
                <button 
                  className="btn btn-success"
                  onClick={playAudio}
                >
                  <Play className="w-4 h-4 mr-2" />
                  播放
                </button>
                
                <button 
                  className="btn btn-warning"
                  onClick={stopAudio}
                >
                  <Square className="w-4 h-4 mr-2" />
                  停止
                </button>
                
                <button 
                  className="btn btn-info"
                  onClick={downloadAudio}
                >
                  <Download className="w-4 h-4 mr-2" />
                  下载
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 使用说明 */}
        <div className="card bg-base-200 shadow-sm">
          <div className="card-body">
            <h2 className="card-title mb-4">📖 使用说明</h2>
            <div className="prose max-w-none">
              <ol className="list-decimal list-inside space-y-2 text-sm">
                <li>确保后端服务已启动: <code className="bg-base-300 px-2 py-1 rounded">cd tts-server && npm run dev</code></li>
                <li>输入你的 Fish Audio API 密钥（将保存在本地浏览器中）</li>
                <li>管理语音模型：可以添加新的音色模型或使用预设模型</li>
                <li>输入要转换的文本内容</li>
                <li>选择合适的 AI 模型（Speech 1.5、Speech 1.6 或 S1）</li>
                <li>根据需要调整音频格式、比特率等配置</li>
                <li>选择要使用的语音模型</li>
                <li>点击"生成语音"按钮</li>
                <li>生成完成后可以播放、下载音频文件</li>
              </ol>
              
              <div className="mt-4 p-4 bg-base-300 rounded-lg">
                <h3 className="font-semibold mb-2">音色模型管理:</h3>
                <ul className="list-disc list-inside space-y-1 text-sm">
                  <li>支持输入 Fish Audio 模型 ID 或完整网址</li>
                  <li>网址格式: <code className="bg-base-200 px-1 rounded">https://fish.audio/zh-CN/m/模型ID/</code></li>
                  <li>系统会自动获取模型的名称和描述信息</li>
                  <li>可以为每个模型添加自定义备注</li>
                  <li>模型信息保存在本地浏览器中</li>
                  <li>预置了央视配音和电台女声两个模型</li>
                </ul>
              </div>
              
              <div className="mt-4 p-4 bg-base-300 rounded-lg">
                <h3 className="font-semibold mb-2">注意事项:</h3>
                <ul className="list-disc list-inside space-y-1 text-sm">
                  <li>需要有效的 Fish Audio API 密钥</li>
                  <li>API 密钥和模型信息仅保存在本地，不会上传到服务器</li>
                  <li>不同 AI 模型具有不同的语音特性和质量</li>
                  <li>Speech 1.6 为默认推荐模型，具有较好的平衡性</li>
                  <li>文本长度建议控制在合理范围内</li>
                  <li>生成时间取决于文本长度、模型选择和网络状况</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VoiceTest;