import React, { useState, useEffect } from 'react';
import { Volume2, Play, Square, RefreshCw, Settings, Plus, Trash2, Save } from 'lucide-react';
import { toast } from 'sonner';

interface VoiceModel {
  id: string;
  name: string;
  description?: string;
}

interface VoiceSettings {
  provider: 'fish-audio' | 'other';
  apiUrl: string;
  apiKey: string;
  readingMode: 'all' | 'dialogue-only';
  voiceIds: string[];
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
    voiceIds: ['']
  });
  
  const [tempSettings, setTempSettings] = useState<VoiceSettings>({
    provider: 'fish-audio',
    apiUrl: 'https://api.fish.audio',
    apiKey: '',
    readingMode: 'all',
    voiceIds: ['']
  });
  
  const [models, setModels] = useState<VoiceModel[]>([]);
  const [isLoadingModels, setIsLoadingModels] = useState(false);
  const [playingModel, setPlayingModel] = useState<string | null>(null);
  const [playingVoiceId, setPlayingVoiceId] = useState<string | null>(null);
  const [audioRef, setAudioRef] = useState<HTMLAudioElement | null>(null);

  // 预设的语音模型
  const presetModels: VoiceModel[] = [
    { id: '59cb5986671546eaa6ca8ae6f29f6d22', name: '央视配音', description: '专业新闻播报风格' },
    { id: 'faccba1a8ac54016bcfc02761285e67f', name: '电台女声', description: '温柔电台主播风格' },
    { id: '6ce7ea8ada884bf3889fa7c7fb206691', name: '茉莉', description: '清新自然女声' }
  ];

  // 从本地存储加载设置
  useEffect(() => {
    const savedSettings = localStorage.getItem('voiceSettings');
    if (savedSettings) {
      try {
        const parsed = JSON.parse(savedSettings);
        const loadedSettings = { ...settings, ...parsed };
        setSettings(loadedSettings);
        setTempSettings(loadedSettings);
      } catch (error) {
        console.error('加载语音设置失败:', error);
      }
    }
  }, []);

  // 添加音色ID
  const addVoiceId = () => {
    setTempSettings({
      ...tempSettings,
      voiceIds: [...tempSettings.voiceIds, '']
    });
  };

  // 更新音色ID
  const updateVoiceId = (index: number, value: string) => {
    const newVoiceIds = [...tempSettings.voiceIds];
    newVoiceIds[index] = value;
    setTempSettings({
      ...tempSettings,
      voiceIds: newVoiceIds
    });
  };

  // 删除音色ID
  const removeVoiceId = (index: number) => {
    const newVoiceIds = tempSettings.voiceIds.filter((_, i) => i !== index);
    setTempSettings({
      ...tempSettings,
      voiceIds: newVoiceIds.length > 0 ? newVoiceIds : ['']
    });
  };

  // 保存设置到本地存储
  const saveSettings = (newSettings: VoiceSettings) => {
    setSettings(newSettings);
    localStorage.setItem('voiceSettings', JSON.stringify(newSettings));
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
          'x-api-key': import.meta.env.VITE_API_SECRET || 'your-api-key-here'
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
  const testVoice = async (voiceId: string) => {
    if (tempSettings.provider !== 'fish-audio') {
      toast.error('当前供应商不支持试听功能');
      return;
    }

    if (!tempSettings.apiKey.trim()) {
      toast.error('请先设置 API 密钥');
      return;
    }

    if (!voiceId.trim()) {
      toast.error('请输入音色ID');
      return;
    }

    // 停止当前播放
    if (audioRef) {
      audioRef.pause();
      audioRef.currentTime = 0;
    }

    setPlayingVoiceId(voiceId);
    
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
        reference_id: voiceId
      };

      // 根据环境选择 API 地址
      const apiBaseUrl = import.meta.env.PROD ? '' : 'http://localhost:3001';
      const response = await fetch(`${apiBaseUrl}/api/tts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': import.meta.env.VITE_API_SECRET || 'your-api-key-here'
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

  // 保存设置
  const handleSaveSettings = () => {
    setSettings(tempSettings);
    localStorage.setItem('voiceSettings', JSON.stringify(tempSettings));
    toast.success('设置已保存');
  };

  return (
    <div className="p-6 max-w-6xl mx-auto md:pt-0">
      <div className="mb-8">
        <p className="text-base-content/70">
          配置文本转语音功能的相关设置
        </p>
      </div>

      {/* 供应商选择 */}
      <div className="card bg-base-100 shadow-sm mb-6">
        <div className="card-body">
          <h2 className="card-title mb-4">语音供应商</h2>
          <div className="form-control">
            <label className="label cursor-pointer">
              <input
                type="radio"
                name="provider"
                className="radio radio-primary"
                checked={tempSettings.provider === 'fish-audio'}
                onChange={() => setTempSettings({ ...tempSettings, provider: 'fish-audio' })}
              />
              <span className="label-text">Fish Audio</span>
            </label>
          </div>
          <div className="form-control">
            <label className="label cursor-pointer">
              <input
                type="radio"
                name="provider"
                className="radio radio-primary"
                checked={tempSettings.provider === 'other'}
                onChange={() => setTempSettings({ ...tempSettings, provider: 'other' })}
              />
              <span className="label-text">其它</span>
            </label>
          </div>
          
          {tempSettings.provider === 'other' && (
            <div className="mt-4 p-4 bg-base-300 rounded-lg">
              <p className="text-base-content/70 text-center">暂不支持其它供应商</p>
            </div>
          )}
        </div>
      </div>

      {/* API 配置 */}
      {tempSettings.provider === 'fish-audio' && (
        <div className="card bg-base-100 shadow-sm mb-6">
          <div className="card-body">
            <h2 className="card-title mb-4">API 配置</h2>
            <div className="grid grid-cols-1 gap-4">
              <div>
                <label className="label">
                  <span className="label-text">API 地址</span>
                </label>
                <input
                  type="url"
                  className="input input-bordered w-full"
                  value={tempSettings.apiUrl}
                  onChange={(e) => setTempSettings({ ...tempSettings, apiUrl: e.target.value })}
                  placeholder="https://api.fish.audio"
                />
              </div>
              
              <div>
                <label className="label">
                  <span className="label-text">API 密钥</span>
                </label>
                <input
                  type="password"
                  className="input input-bordered w-full"
                  value={tempSettings.apiKey}
                  onChange={(e) => setTempSettings({ ...tempSettings, apiKey: e.target.value })}
                  placeholder="输入你的 Fish Audio API 密钥"
                />
                <div className="label">
                  <span className="label-text-alt text-base-content/60">
                    请在 Fish Audio 官网获取 API 密钥
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 音色ID配置 */}
      {tempSettings.provider === 'fish-audio' && (
        <div className="card bg-base-100 shadow-sm mb-6">
          <div className="card-body">
            <div className="flex items-center justify-between mb-4">
              <h2 className="card-title">音色ID配置</h2>
              <button
                className="btn btn-primary btn-sm"
                onClick={addVoiceId}
              >
                <Plus className="h-4 w-4 mr-2" />
                添加音色ID
              </button>
            </div>
            
            <div className="space-y-3">
              {tempSettings.voiceIds.map((voiceId, index) => (
                <div key={index} className="flex gap-2 items-center">
                  <input
                    type="text"
                    className="input input-bordered flex-1"
                    value={voiceId}
                    onChange={(e) => updateVoiceId(index, e.target.value)}
                    placeholder="输入音色ID，如：59cb5986671546eaa6ca8ae6f29f6d22"
                  />
                  <div className="flex gap-1">
                    {playingVoiceId === voiceId ? (
                      <button
                        className="btn btn-warning btn-sm"
                        onClick={stopVoice}
                      >
                        <Square className="h-4 w-4" />
                      </button>
                    ) : (
                      <button
                        className="btn btn-primary btn-sm"
                        onClick={() => testVoice(voiceId)}
                        disabled={!voiceId.trim()}
                      >
                        <Play className="h-4 w-4" />
                      </button>
                    )}
                    {tempSettings.voiceIds.length > 1 && (
                      <button
                        className="btn btn-error btn-sm"
                        onClick={() => removeVoiceId(index)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
            
            {tempSettings.voiceIds.length === 0 && (
              <div className="text-center py-8 text-base-content/60">
                <Volume2 className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>点击"添加音色ID"按钮开始配置</p>
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
    </div>
  );
};

export default VoiceSettingsPage;