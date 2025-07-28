import React, { useState, useRef } from 'react';
import { Play, Square, Download, Volume2 } from 'lucide-react';

interface TTSRequest {
  text: string;
  format: 'mp3' | 'wav';
  mp3_bitrate: number;
  reference_id?: string;
  normalize: boolean;
  latency: 'normal' | 'balanced';
  chunk_length: number;
}



const VoiceTest: React.FC = () => {
  const [text, setText] = useState('你好，这是一个语音测试。欢迎使用 Fish Audio 文本转语音功能！');
  const [isLoading, setIsLoading] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [serverStatus, setServerStatus] = useState<'unknown' | 'online' | 'offline'>('unknown');
  const [modelId, setModelId] = useState('59cb5986671546eaa6ca8ae6f29f6d22');
  const [customModelId, setCustomModelId] = useState('');
  
  const [config, setConfig] = useState<TTSRequest>({
    text: '',
    format: 'mp3',
    mp3_bitrate: 128,
    normalize: true,
    latency: 'normal',
    chunk_length: 200
  });
  
  const audioRef = useRef<HTMLAudioElement>(null);

  // 检查服务器状态
  const checkServerStatus = async () => {
    try {
      // 根据环境选择 API 地址
      const apiBaseUrl = import.meta.env.PROD ? '' : 'http://localhost:3001';
      const response = await fetch(`${apiBaseUrl}/api/health`);
      if (response.ok) {
        const data = await response.json();
        setServerStatus('online');
        console.log('服务器状态:', data);
      } else {
        setServerStatus('offline');
      }
    } catch (error) {
      setServerStatus('offline');
      console.error('服务器连接失败:', error);
    }
  };

  // 生成语音
  const generateSpeech = async () => {
    if (!text.trim()) {
      setError('请输入要转换的文本');
      return;
    }

    setIsLoading(true);
    setError(null);
    
    try {
      // 设置模型 ID
      const finalModelId = modelId === 'custom' ? customModelId : modelId;
      
      const requestData = {
        text,
        format: config.format,
        mp3_bitrate: config.mp3_bitrate,
        normalize: config.normalize,
        latency: config.latency,
        chunk_length: config.chunk_length,
        ...(finalModelId && { reference_id: finalModelId })
      };

      console.log('发送 TTS 请求:', {
        text: text.substring(0, 50) + '...',
        format: config.format
      });

      // 根据环境选择 API 地址
      const apiBaseUrl = import.meta.env.PROD ? '' : 'http://localhost:3001';
      const response = await fetch(`${apiBaseUrl}/api/tts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestData)
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: '未知错误' }));
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }

      const audioBlob = await response.blob();
      const url = URL.createObjectURL(audioBlob);
      
      // 清理之前的 URL
      if (audioUrl) {
        URL.revokeObjectURL(audioUrl);
      }
      
      setAudioUrl(url);
      console.log('语音生成成功');
      
    } catch (error) {
      console.error('语音生成失败:', error);
      setError(error instanceof Error ? error.message : '语音生成失败');
    } finally {
      setIsLoading(false);
    }
  };

  // 播放音频
  const playAudio = () => {
    if (audioRef.current && audioUrl) {
      audioRef.current.play();
    }
  };

  // 停止音频
  const stopAudio = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
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
    }
  };



  // 页面加载时检查服务器状态
  React.useEffect(() => {
    checkServerStatus();
  }, []);

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

        {/* 服务器状态 */}
        <div className="card bg-base-200 shadow-sm mb-6">
          <div className="card-body">
            <div className="flex items-center justify-between">
              <h2 className="card-title">服务器状态</h2>
              <button 
                className="btn btn-sm btn-outline"
                onClick={checkServerStatus}
              >
                刷新状态
              </button>
            </div>
            <div className="flex items-center gap-2">
              <div className={`w-3 h-3 rounded-full ${
                serverStatus === 'online' ? 'bg-success' :
                serverStatus === 'offline' ? 'bg-error' : 'bg-warning'
              }`}></div>
              <span className="text-sm">
                {serverStatus === 'online' ? 
                  (import.meta.env.PROD ? '在线 (Vercel Functions)' : '在线 (http://localhost:3001)') :
                 serverStatus === 'offline' ? 
                  (import.meta.env.PROD ? '离线 - API 服务不可用' : '离线 - 请启动后端服务') : 
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

        {/* 语音模型选择 */}
        <div className="card bg-base-200 shadow-sm mb-6">
          <div className="card-body">
            <h2 className="card-title mb-4">🎤 语音模型</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="label">
                  <span className="label-text">选择语音模型</span>
                </label>
                <select
                  className="select select-bordered w-full"
                  value={modelId}
                  onChange={(e) => setModelId(e.target.value)}
                >
                  <option value="59cb5986671546eaa6ca8ae6f29f6d22">央视配音</option>
                  <option value="faccba1a8ac54016bcfc02761285e67f">电台女声</option>
                  <option value="6ce7ea8ada884bf3889fa7c7fb206691">茉莉</option>
                  <option value="custom">自定义 ID</option>
                </select>
              </div>

              {modelId === 'custom' && (
                <div>
                  <label className="label">
                    <span className="label-text">自定义模型 ID</span>
                  </label>
                  <input
                    type="text"
                    placeholder="输入 Fish Audio 模型 ID"
                    className="input input-bordered w-full"
                    value={customModelId}
                    onChange={(e) => setCustomModelId(e.target.value)}
                  />
                </div>
              )}
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
              disabled={isLoading || !text.trim() || serverStatus !== 'online'}
            >
              {isLoading ? '生成中...' : '🎵 生成语音'}
            </button>
            
            {serverStatus !== 'online' && (
              <div className="alert alert-warning mt-4">
                <span>请先启动后端服务: cd tts-server && npm run dev</span>
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
          <div className="card bg-base-200 shadow-s'm mb-6">
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
                <li>在 <code className="bg-base-300 px-2 py-1 rounded">tts-server/.env</code> 文件中配置你的 Fish Audio API 密钥</li>
                <li>输入要转换的文本内容</li>
                <li>根据需要调整音频格式、比特率等配置</li>
                <li>可选：上传参考音频文件以启用语音克隆功能</li>
                <li>点击"生成语音"按钮</li>
                <li>生成完成后可以播放、下载音频文件</li>
              </ol>
              
              <div className="mt-4 p-4 bg-base-300 rounded-lg">
                <h3 className="font-semibold mb-2">注意事项:</h3>
                <ul className="list-disc list-inside space-y-1 text-sm">
                  <li>需要有效的 Fish Audio API 密钥</li>
                  <li>参考音频用于语音克隆，可提供更个性化的语音效果</li>
                  <li>文本长度建议控制在合理范围内</li>
                  <li>生成时间取决于文本长度和网络状况</li>
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