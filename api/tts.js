const axios = require('axios');
const msgpack = require('msgpack5')();

// Fish Audio API 配置
const FISH_AUDIO_API_KEY = process.env.FISH_AUDIO_API_KEY;
const FISH_AUDIO_BASE_URL = 'https://api.fish.audio/v1';

// 支持的模型列表
const SUPPORTED_MODELS = ['speech-1.5', 'speech-1.6', 's1'];
const DEFAULT_MODEL = 'speech-1.6';

module.exports = async (req, res) => {
  // 设置 CORS 头
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-api-key');

  // 处理 OPTIONS 请求
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // API 密钥验证
  const apiKey = req.headers['x-api-key'];
  const expectedApiKey = process.env.API_SECRET;
  
  if (!expectedApiKey) {
    return res.status(500).json({ error: '服务器未配置 API 密钥' });
  }
  
  if (!apiKey || apiKey !== expectedApiKey) {
    return res.status(401).json({ error: '未授权访问：无效的 API 密钥' });
  }

  // 处理 GET 请求 - 返回支持的模型列表
  if (req.method === 'GET') {
    return res.status(200).json({
      success: true,
      models: SUPPORTED_MODELS,
      default: DEFAULT_MODEL
    });
  }

  // 只允许 POST 请求进行 TTS
  if (req.method !== 'POST') {
    return res.status(405).json({ error: '只允许 POST 和 GET 请求' });
  }

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

    if (!FISH_AUDIO_API_KEY) {
      return res.status(500).json({ error: '服务器未配置 API 密钥' });
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
      timeout: 30000 // 30秒超时（Vercel 限制）
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
};