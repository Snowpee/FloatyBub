import React, { useState, useEffect, useRef } from 'react';
import { toast } from '../../hooks/useToast';

interface ModelListResponse {
  success: boolean;
  models: string[];
  default: string;
}

interface TTSConfig {
  text: string;
  model: string;
  format: string;
  normalize: boolean;
  latency: string;
  reference_id?: string;
}

const VercelModelTest: React.FC = () => {
  const [supportedModels, setSupportedModels] = useState<string[]>([]);
  const [defaultModel, setDefaultModel] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');
  const [ttsLoading, setTtsLoading] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string>('');
  const [config, setConfig] = useState<TTSConfig>({
    text: '你好，这是一个语音测试。',
    model: 'speech-1.6',
    format: 'mp3',
    normalize: true,
    latency: 'normal'
  });
  const [modelId, setModelId] = useState('59cb5986671546eaa6ca8ae6f29f6d22');
  const [customModelId, setCustomModelId] = useState('');
  const audioRef = useRef<HTMLAudioElement>(null);

  const VERCEL_DOMAIN = 'https://floatybub.vercel.app';

  // 获取支持的模型列表（从 /api/tts GET 接口）
  const fetchSupportedModels = async () => {
    try {
      setLoading(true);
      setError('');
      
      const response = await fetch(`${VERCEL_DOMAIN}/api/tts`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': import.meta.env.VITE_API_SECRET || 'your-api-key-here'
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data: ModelListResponse = await response.json();
      
      if (data.success) {
        setSupportedModels(data.models);
        setDefaultModel(data.default);
        toast.success('成功获取支持的模型列表');
      } else {
        throw new Error('API 返回失败状态');
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : '未知错误';
      setError(`获取支持的模型列表失败: ${errorMsg}`);
      toast.error(`获取支持的模型列表失败: ${errorMsg}`);
    } finally {
      setLoading(false);
    }
  };

  // 语音合成测试
  const testTTS = async () => {
    if (!config.text.trim()) {
      toast.error('请输入要转换的文本');
      return;
    }

    try {
      setTtsLoading(true);
      setError('');
      
      // 设置模型 ID
      const finalModelId = modelId === 'custom' ? customModelId : modelId;
      
      const requestData = {
        text: config.text,
        model: config.model,
        format: config.format,
        normalize: config.normalize,
        latency: config.latency,
        ...(finalModelId && { reference_id: finalModelId })
      };
      
      const response = await fetch(`${VERCEL_DOMAIN}/api/tts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': import.meta.env.VITE_API_SECRET || 'your-api-key-here'
        },
        body: JSON.stringify(requestData)
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      // 创建音频 blob URL
      const audioBlob = await response.blob();
      const url = URL.createObjectURL(audioBlob);
      setAudioUrl(url);
      
      toast.success('语音合成成功！');
      
      // 自动播放
      setTimeout(() => {
        if (audioRef.current) {
          audioRef.current.play();
        }
      }, 100);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : '未知错误';
      setError(`语音合成失败: ${errorMsg}`);
      toast.error(`语音合成失败: ${errorMsg}`);
    } finally {
      setTtsLoading(false);
    }
  };

  // 下载音频文件
  const downloadAudio = () => {
    if (audioUrl) {
      const a = document.createElement('a');
      a.href = audioUrl;
      a.download = `tts_${Date.now()}.${config.format}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }
  };

  // 测试健康检查
  const testHealth = async () => {
    try {
      setLoading(true);
      setError('');
      
      const response = await fetch(`${VERCEL_DOMAIN}/api/health`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': import.meta.env.VITE_API_SECRET || 'your-api-key-here'
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      toast.success(`健康检查成功: ${data.status}`);
      console.log('健康检查结果:', data);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : '未知错误';
      setError(`健康检查失败: ${errorMsg}`);
      toast.error(`健康检查失败: ${errorMsg}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // 页面加载时自动获取支持的模型列表
    fetchSupportedModels();
  }, []);

  // 当支持的模型列表更新时，更新默认模型
  useEffect(() => {
    if (supportedModels.length > 0 && defaultModel) {
      setConfig(prev => ({ ...prev, model: defaultModel }));
    }
  }, [supportedModels, defaultModel]);

  // 清理音频 URL
  useEffect(() => {
    return () => {
      if (audioUrl) {
        URL.revokeObjectURL(audioUrl);
      }
    };
  }, [audioUrl]);

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Vercel TTS 测试</h1>
        <p className="text-gray-600">测试域名: <code className="bg-gray-100 px-2 py-1 rounded">{VERCEL_DOMAIN}</code></p>
      </div>

      {error && (
        <div className="alert alert-error mb-6">
          <span>{error}</span>
        </div>
      )}

      {/* 操作按钮 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
        <button 
          className={`btn btn-primary ${loading ? 'loading' : ''}`}
          onClick={fetchSupportedModels}
          disabled={loading}
        >
          获取支持的模型列表
        </button>
        
        <button 
          className={`btn btn-accent ${loading ? 'loading' : ''}`}
          onClick={testHealth}
          disabled={loading}
        >
          健康检查
        </button>
      </div>

      {/* 支持的模型列表 */}
      <div className="card bg-base-100 shadow-xl mb-6">
        <div className="card-body">
          <h2 className="card-title">支持的 TTS 模型</h2>
          {supportedModels.length > 0 ? (
            <div>
              <p className="mb-4">默认模型: <span className="badge badge-primary">{defaultModel}</span></p>
              <div className="flex flex-wrap gap-2">
                {supportedModels.map((model, index) => (
                  <span 
                    key={index} 
                    className={`badge ${model === defaultModel ? 'badge-primary' : 'badge-outline'}`}
                  >
                    {model}
                  </span>
                ))}
              </div>
            </div>
          ) : (
            <p className="text-gray-500">暂无数据，请点击"获取支持的模型列表"按钮</p>
          )}
        </div>
      </div>

      {/* 语音测试功能 */}
      <div className="card bg-base-100 shadow-xl">
        <div className="card-body">
          <h2 className="card-title">语音合成测试</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            {/* 文本输入 */}
            <div className="form-control">
              <label className="label">
                <span className="label-text">输入文本</span>
              </label>
              <textarea 
                className="textarea textarea-bordered h-24"
                placeholder="请输入要转换为语音的文本..."
                value={config.text}
                onChange={(e) => setConfig(prev => ({ ...prev, text: e.target.value }))}
              />
            </div>
            
            {/* 配置选项 */}
            <div className="space-y-4">
              <div className="form-control">
                <label className="label">
                  <span className="label-text">AI 模型</span>
                </label>
                <select 
                  className="select select-bordered"
                  value={config.model}
                  onChange={(e) => setConfig(prev => ({ ...prev, model: e.target.value }))}
                >
                  {supportedModels.map((model) => (
                    <option key={model} value={model}>
                      {model === 'speech-1.5' ? 'Speech 1.5' :
                       model === 'speech-1.6' ? 'Speech 1.6' :
                       model === 's1' ? 'S1' : model}
                    </option>
                  ))}
                </select>
              </div>
              
              <div className="form-control">
                <label className="label">
                  <span className="label-text">音频格式</span>
                </label>
                <select 
                  className="select select-bordered"
                  value={config.format}
                  onChange={(e) => setConfig(prev => ({ ...prev, format: e.target.value }))}
                >
                  <option value="mp3">MP3</option>
                  <option value="wav">WAV</option>
                </select>
              </div>
              
              <div className="form-control">
                <label className="label cursor-pointer">
                  <span className="label-text">音频标准化</span>
                  <input 
                    type="checkbox" 
                    className="checkbox"
                    checked={config.normalize}
                    onChange={(e) => setConfig(prev => ({ ...prev, normalize: e.target.checked }))}
                  />
                </label>
              </div>
            </div>
          </div>
          
          {/* 语音模型选择 */}
          <div className="col-span-1 md:col-span-2">
            <div className="form-control">
              <label className="label">
                <span className="label-text">🎤 语音模型</span>
              </label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <select
                  className="select select-bordered"
                  value={modelId}
                  onChange={(e) => setModelId(e.target.value)}
                >
                  <option value="59cb5986671546eaa6ca8ae6f29f6d22">央视配音</option>
                  <option value="faccba1a8ac54016bcfc02761285e67f">电台女声</option>
                  <option value="6ce7ea8ada884bf3889fa7c7fb206691">茉莉</option>
                  <option value="custom">自定义 ID</option>
                </select>
                
                {modelId === 'custom' && (
                  <input
                    type="text"
                    placeholder="输入 Fish Audio 模型 ID"
                    className="input input-bordered"
                    value={customModelId}
                    onChange={(e) => setCustomModelId(e.target.value)}
                  />
                )}
              </div>
            </div>
          </div>
          
          {/* 操作按钮 */}
          <div className="flex gap-4 mb-4">
            <button 
              className={`btn btn-primary ${ttsLoading ? 'loading' : ''}`}
              onClick={testTTS}
              disabled={ttsLoading || !config.text.trim()}
            >
              {ttsLoading ? '生成中...' : '生成语音'}
            </button>
            
            {audioUrl && (
              <button 
                className="btn btn-secondary"
                onClick={downloadAudio}
              >
                下载音频
              </button>
            )}
          </div>
          
          {/* 音频播放器 */}
          {audioUrl && (
            <div className="bg-gray-50 p-4 rounded-lg">
              <h3 className="font-medium mb-2">生成的语音:</h3>
              <audio 
                ref={audioRef}
                controls 
                className="w-full"
                src={audioUrl}
              >
                您的浏览器不支持音频播放。
              </audio>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default VercelModelTest;