const express = require('express');
const cors = require('cors');
const axios = require('axios');
const msgpack = require('msgpack5')();
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;

// 中间件
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Fish Audio API 配置
const FISH_AUDIO_API_KEY = process.env.FISH_AUDIO_API_KEY;
const FISH_AUDIO_BASE_URL = 'https://api.fish.audio/v1';

// 支持的模型列表
const SUPPORTED_MODELS = ['speech-1.5', 'speech-1.6', 's1'];
const DEFAULT_MODEL = 'speech-1.6';

if (!FISH_AUDIO_API_KEY) {
  console.warn('警告: 未设置 FISH_AUDIO_API_KEY 环境变量');
}

// API 密钥验证中间件
const apiKeyAuth = (req, res, next) => {
  const apiKey = req.headers['x-api-key'];
  const expectedApiKey = process.env.API_SECRET;
  
  if (!expectedApiKey) {
    return res.status(500).json({ error: '服务器未配置 API 密钥' });
  }
  
  if (!apiKey || apiKey !== expectedApiKey) {
    return res.status(401).json({ error: '未授权访问：无效的 API 密钥' });
  }
  
  next();
};

// 获取支持的模型列表
app.get('/api/tts', apiKeyAuth, (req, res) => {
  res.json({
    success: true,
    models: SUPPORTED_MODELS,
    default: DEFAULT_MODEL
  });
});

// TTS 请求处理
app.post('/api/tts', apiKeyAuth, async (req, res) => {
  try {
    const {
      text,
      format = 'mp3',
      mp3_bitrate = 128,
      reference_id = null,
      normalize = true,
      latency = 'normal',
      chunk_length = 200,
      model = 'speech-1.6'
    } = req.body;

    if (!text) {
      return res.status(400).json({ error: '缺少必需的 text 参数' });
    }

    // 验证模型参数
    const selectedModel = SUPPORTED_MODELS.includes(model) ? model : DEFAULT_MODEL;

    // 构建请求数据
    const requestData = {
      text,
      chunk_length: parseInt(chunk_length),
      format,
      mp3_bitrate: parseInt(mp3_bitrate),
      references: [],
      reference_id,
      normalize: Boolean(normalize),
      latency
    };

    console.log('TTS 请求:', {
      text: text.substring(0, 100) + (text.length > 100 ? '...' : ''),
      format,
      reference_id,
      model: selectedModel
    });

    // 使用 msgpack 编码请求数据
    const encodedData = msgpack.encode(requestData);

    // 调用 Fish Audio API
    const response = await axios({
      method: 'POST',
      url: `${FISH_AUDIO_BASE_URL}/tts`,
      data: encodedData,
      headers: {
        'Authorization': `Bearer ${FISH_AUDIO_API_KEY}`,
        'Content-Type': 'application/msgpack',
        'Model': selectedModel
      },
      responseType: 'stream',
      timeout: 60000 // 60秒超时
    });

    // 设置响应头
    res.setHeader('Content-Type', `audio/${format}`);
    res.setHeader('Content-Disposition', `attachment; filename="tts.${format}"`);

    // 流式传输音频数据
    response.data.pipe(res);

  } catch (error) {
    console.error('TTS 错误:', error.message);
    
    if (error.response) {
      console.error('API 响应错误:', error.response.status, error.response.statusText);
      return res.status(error.response.status).json({
        error: 'Fish Audio API 错误',
        details: error.response.statusText
      });
    }
    
    res.status(500).json({
      error: '服务器内部错误',
      details: error.message
    });
  }
});

// 健康检查端点
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    api_key_configured: !!FISH_AUDIO_API_KEY
  });
});

// 获取可用模型列表（如果需要）
app.get('/api/models', async (req, res) => {
  try {
    if (!FISH_AUDIO_API_KEY) {
      return res.status(401).json({ error: '未配置 API 密钥' });
    }

    const response = await axios({
      method: 'GET',
      url: `${FISH_AUDIO_BASE_URL}/models`,
      headers: {
        'Authorization': `Bearer ${FISH_AUDIO_API_KEY}`
      }
    });

    res.json(response.data);
  } catch (error) {
    console.error('获取模型列表错误:', error.message);
    res.status(500).json({
      error: '获取模型列表失败',
      details: error.message
    });
  }
});

// 启动服务器
app.listen(PORT, () => {
  console.log(`🎵 TTS 服务器运行在 http://localhost:${PORT}`);
  console.log(`📋 健康检查: http://localhost:${PORT}/api/health`);
  console.log(`🔑 API 密钥配置: ${FISH_AUDIO_API_KEY ? '✅ 已配置' : '❌ 未配置'}`);
});

// 优雅关闭
process.on('SIGTERM', () => {
  console.log('收到 SIGTERM 信号，正在关闭服务器...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('收到 SIGINT 信号，正在关闭服务器...');
  process.exit(0);
});