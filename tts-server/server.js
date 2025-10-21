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
const FISH_AUDIO_BASE_URL = 'https://api.fish.audio/v1';
const FISH_AUDIO_MODEL_URL = 'https://api.fish.audio';

// 支持的模型列表
const SUPPORTED_MODELS = ['speech-1.5', 'speech-1.6', 's1'];
const DEFAULT_MODEL = 'speech-1.6';

console.log('TTS 服务启动，Fish Audio API Key 将由前端提供');

// API 密钥验证中间件
const apiKeyAuth = (req, res, next) => {
  const timestamp = new Date().toISOString();
  const clientIP = req.ip || req.connection.remoteAddress || req.headers['x-forwarded-for'] || 'unknown';
  // 支持从 header 或 query 参数读取 API 密钥
  const apiKey = req.headers['x-api-key'] || req.query['x_api_key'];
  const expectedApiKey = process.env.API_SECRET;
  
  console.log(`[${timestamp}] API 密钥验证 - IP: ${clientIP}, 路径: ${req.path}, 方法: ${req.method}`);
  
  if (!expectedApiKey) {
    console.error(`[${timestamp}] 服务器配置错误 - 未配置 API 密钥`);
    return res.status(500).json({ error: '服务器未配置 API 密钥' });
  }
  
  if (!apiKey || apiKey !== expectedApiKey) {
    console.warn(`[${timestamp}] API 密钥验证失败 - IP: ${clientIP}, 提供的密钥: ${apiKey ? '***' : '无'}`);
    return res.status(401).json({ error: '未授权访问：无效的 API 密钥' });
  }
  
  console.log(`[${timestamp}] API 密钥验证成功 - IP: ${clientIP}`);
  next();
};

// 获取支持的模型列表
app.get('/api/tts', apiKeyAuth, (req, res) => {
  const timestamp = new Date().toISOString();
  const clientIP = req.ip || req.connection.remoteAddress || req.headers['x-forwarded-for'] || 'unknown';
  
  console.log(`[${timestamp}] 获取模型列表请求 - IP: ${clientIP}`);
  console.log(`[${timestamp}] 返回支持的模型: ${SUPPORTED_MODELS.join(', ')}, 默认模型: ${DEFAULT_MODEL}`);
  
  res.json({
    success: true,
    models: SUPPORTED_MODELS,
    default: DEFAULT_MODEL
  });
});

// TTS 请求处理
app.post('/api/tts', apiKeyAuth, async (req, res) => {
  const timestamp = new Date().toISOString();
  const clientIP = req.ip || req.connection.remoteAddress || req.headers['x-forwarded-for'] || 'unknown';
  
  try {
    const {
      text,
      format = 'mp3',
      mp3_bitrate = 128,
      reference_id = null,
      normalize = true,
      latency = 'normal',
      chunk_length = 200,
      model = 'speech-1.6',
      fish_audio_key
    } = req.body;

    console.log(`[${timestamp}] TTS 请求开始 - IP: ${clientIP}`);
    console.log(`[${timestamp}] 请求参数 - 文本长度: ${text ? text.length : 0}, 格式: ${format}, 模型: ${model}, 参考ID: ${reference_id || '无'}`);

    if (!text) {
      console.warn(`[${timestamp}] TTS 请求失败 - 缺少文本参数`);
      return res.status(400).json({ error: '缺少必需的 text 参数' });
    }

    if (!fish_audio_key) {
      console.warn(`[${timestamp}] TTS 请求失败 - 缺少 Fish Audio API Key`);
      return res.status(400).json({ error: '缺少必需的 fish_audio_key 参数' });
    }

    // 验证模型参数
    const selectedModel = SUPPORTED_MODELS.includes(model) ? model : DEFAULT_MODEL;
    if (model !== selectedModel) {
      console.log(`[${timestamp}] 模型参数修正 - 原始: ${model}, 修正为: ${selectedModel}`);
    }

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

    console.log(`[${timestamp}] 发送到 Fish Audio API - 文本预览: "${text.substring(0, 50)}${text.length > 50 ? '...' : ''}", 模型: ${selectedModel}`);

    // 使用 msgpack 编码请求数据
    const encodedData = msgpack.encode(requestData);
    console.log(`[${timestamp}] 请求数据已编码，大小: ${encodedData.length} 字节`);

    // 调用 Fish Audio API
    console.log(`[${timestamp}] 调用 Fish Audio API - URL: ${FISH_AUDIO_BASE_URL}/tts`);
    const response = await axios({
      method: 'POST',
      url: `${FISH_AUDIO_BASE_URL}/tts`,
      data: encodedData,
      headers: {
        'Authorization': `Bearer ${fish_audio_key}`,
        'Content-Type': 'application/msgpack',
        'Model': selectedModel
      },
      responseType: 'stream',
      timeout: 60000 // 60秒超时
    });

    console.log(`[${timestamp}] Fish Audio API 响应成功 - 状态码: ${response.status}`);
    console.log(`[${timestamp}] 响应头 - Content-Type: ${response.headers['content-type']}, Content-Length: ${response.headers['content-length'] || '未知'}`);

    // 设置响应头 - 去掉 Content-Disposition attachment 以支持边下边播
    res.setHeader('Content-Type', `audio/${format}`);
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Accept-Ranges', 'bytes');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-api-key, fish-audio-key');
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');

    console.log(`[${timestamp}] 开始流式传输音频数据`);
    // 流式传输音频数据
    response.data.on('end', () => {
      console.log(`[${timestamp}] 音频数据传输完成`);
    });
    
    response.data.on('error', (streamError) => {
      console.error(`[${timestamp}] 音频流传输错误:`, streamError.message);
    });
    
    response.data.pipe(res);

  } catch (error) {
    console.error(`[${timestamp}] TTS 请求失败 - IP: ${clientIP}`);
    console.error(`[${timestamp}] 错误详情:`, error.message);
    
    if (error.response) {
      console.error(`[${timestamp}] Fish Audio API 错误 - 状态码: ${error.response.status}, 状态文本: ${error.response.statusText}`);
      if (error.response.data) {
        console.error(`[${timestamp}] API 错误响应:`, error.response.data);
      }
      return res.status(error.response.status).json({
        error: 'Fish Audio API 错误',
        details: error.response.statusText
      });
    }
    
    if (error.code === 'ECONNABORTED') {
      console.error(`[${timestamp}] 请求超时错误`);
      return res.status(408).json({
        error: '请求超时',
        details: 'Fish Audio API 响应超时'
      });
    }
    
    console.error(`[${timestamp}] 服务器内部错误:`, error.stack || error.message);
    res.status(500).json({
      error: '服务器内部错误',
      details: error.message
    });
  }
});

// 新增 GET /api/tts/stream 接口支持边下边播
app.get('/api/tts/stream', apiKeyAuth, async (req, res) => {
  const timestamp = new Date().toISOString();
  const clientIP = req.ip || req.connection.remoteAddress || req.headers['x-forwarded-for'] || 'unknown';
  
  try {
    const {
      text,
      format = 'mp3',
      mp3_bitrate = 128,
      reference_id = null,
      normalize = 'true',
      latency = 'normal',
      chunk_length = 100, // 降低到 100 提升首响应速度
      model = 'speech-1.6',
      fish_audio_key,
      x_api_key
    } = req.query;

    console.log(`[${timestamp}] TTS Stream 请求开始 - IP: ${clientIP}`);
    console.log(`[${timestamp}] 请求参数 - 文本长度: ${text ? text.length : 0}, 格式: ${format}, 模型: ${model}, 参考ID: ${reference_id || '无'}`);

    if (!text) {
      console.warn(`[${timestamp}] TTS Stream 请求失败 - 缺少文本参数`);
      return res.status(400).json({ error: '缺少必需的 text 参数' });
    }

    const apiKey = fish_audio_key || req.headers['fish-audio-key'];
    if (!apiKey) {
      console.warn(`[${timestamp}] TTS Stream 请求失败 - 缺少 Fish Audio API Key`);
      return res.status(400).json({ error: '缺少必需的 fish_audio_key 参数' });
    }

    // 验证模型参数
    const selectedModel = SUPPORTED_MODELS.includes(model) ? model : DEFAULT_MODEL;
    if (model !== selectedModel) {
      console.log(`[${timestamp}] 模型参数修正 - 原始: ${model}, 修正为: ${selectedModel}`);
    }

    // 严格解析 normalize 参数
    const normalizeValue = normalize === 'true' || normalize === true;

    // 构建请求数据
    const requestData = {
      text,
      chunk_length: parseInt(chunk_length),
      format,
      mp3_bitrate: parseInt(mp3_bitrate),
      references: [],
      reference_id,
      normalize: normalizeValue,
      latency
    };

    console.log(`[${timestamp}] 发送到 Fish Audio API - 文本预览: "${text.substring(0, 50)}${text.length > 50 ? '...' : ''}", 模型: ${selectedModel}`);

    // 使用 msgpack 编码请求数据
    const encodedData = msgpack.encode(requestData);
    console.log(`[${timestamp}] 请求数据已编码，大小: ${encodedData.length} 字节`);

    // 调用 Fish Audio API
    console.log(`[${timestamp}] 调用 Fish Audio API - URL: ${FISH_AUDIO_BASE_URL}/tts`);
    const response = await axios({
      method: 'POST',
      url: `${FISH_AUDIO_BASE_URL}/tts`,
      data: encodedData,
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/msgpack',
        'Model': selectedModel
      },
      responseType: 'stream',
      timeout: 60000 // 60秒超时
    });

    console.log(`[${timestamp}] Fish Audio API 响应成功 - 状态码: ${response.status}`);
    console.log(`[${timestamp}] 响应头 - Content-Type: ${response.headers['content-type']}, Content-Length: ${response.headers['content-length'] || '未知'}`);

    // 设置响应头 - 优化为流式播放
    res.setHeader('Content-Type', `audio/${format}`);
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Accept-Ranges', 'bytes');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-api-key, fish-audio-key');
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');

    console.log(`[${timestamp}] 开始流式传输音频数据`);
    // 流式传输音频数据
    response.data.on('end', () => {
      console.log(`[${timestamp}] 音频数据传输完成`);
    });
    
    response.data.on('error', (streamError) => {
      console.error(`[${timestamp}] 音频流传输错误:`, streamError.message);
    });
    
    response.data.pipe(res);

  } catch (error) {
    console.error(`[${timestamp}] TTS Stream 请求失败 - IP: ${clientIP}`);
    console.error(`[${timestamp}] 错误详情:`, error.message);
    
    if (error.response) {
      console.error(`[${timestamp}] Fish Audio API 错误 - 状态码: ${error.response.status}, 状态文本: ${error.response.statusText}`);
      if (error.response.data) {
        console.error(`[${timestamp}] API 错误响应:`, error.response.data);
      }
      return res.status(error.response.status).json({
        error: 'Fish Audio API 错误',
        details: error.response.statusText
      });
    }
    
    if (error.code === 'ECONNABORTED') {
      console.error(`[${timestamp}] 请求超时错误`);
      return res.status(408).json({
        error: '请求超时',
        details: 'Fish Audio API 响应超时'
      });
    }
    
    console.error(`[${timestamp}] 服务器内部错误:`, error.stack || error.message);
    res.status(500).json({
      error: '服务器内部错误',
      details: error.message
    });
  }
});

// 健康检查端点
app.get('/api/health', (req, res) => {
  const timestamp = new Date().toISOString();
  const clientIP = req.ip || req.connection.remoteAddress || req.headers['x-forwarded-for'] || 'unknown';
  
  console.log(`[${timestamp}] 健康检查请求 - IP: ${clientIP}, User-Agent: ${req.headers['user-agent'] || '未知'}`);
  
  const healthData = {
    status: 'ok',
    timestamp: timestamp,
    note: 'Fish Audio API Key 由前端提供',
    server_info: {
      node_version: process.version,
      platform: process.platform,
      uptime: process.uptime()
    }
  };
  
  console.log(`[${timestamp}] 健康检查响应 - 状态: ${healthData.status}, 运行时间: ${Math.floor(healthData.server_info.uptime)}秒`);
  
  res.json(healthData);
});

// 验证 Fish Audio API 密钥
app.post('/api/validate-key', apiKeyAuth, async (req, res) => {
  const timestamp = new Date().toISOString();
  const clientIP = req.ip || req.connection.remoteAddress || req.headers['x-forwarded-for'] || 'unknown';
  
  try {
    const { apiKey, apiUrl } = req.body;

    console.log(`[${timestamp}] 密钥验证请求 - IP: ${clientIP}`);
    console.log(`[${timestamp}] API URL: ${apiUrl || 'https://api.fish.audio'}, API Key 状态: ${apiKey ? '已提供' : '未提供'}`);

    if (!apiKey) {
      console.warn(`[${timestamp}] 密钥验证失败 - 缺少 API 密钥`);
      return res.status(400).json({ 
        valid: false, 
        error: '缺少必需的 apiKey 参数' 
      });
    }

    // 通过调用 Fish Audio API 验证密钥
    const testUrl = `${FISH_AUDIO_MODEL_URL}/model`;
    console.log(`[${timestamp}] 验证 Fish Audio API 密钥 - URL: ${testUrl}`);
    
    const response = await axios({
      method: 'GET',
      url: testUrl,
      headers: {
        'Authorization': `Bearer ${apiKey}`
      },
      timeout: 20000
    });

    console.log(`[${timestamp}] Fish Audio API 密钥验证成功 - 状态码: ${response.status}`);
    
    res.json({ valid: true });
  } catch (error) {
    console.error(`[${timestamp}] 密钥验证失败 - IP: ${clientIP}`);
    console.error(`[${timestamp}] 错误详情:`, error.message);
    
    if (error.response) {
      console.error(`[${timestamp}] Fish Audio API 错误 - 状态码: ${error.response.status}, 状态文本: ${error.response.statusText}`);
      
      if (error.response.status === 401) {
        console.warn(`[${timestamp}] API 密钥无效`);
        return res.json({ 
          valid: false, 
          error: 'API 密钥无效' 
        });
      }
      
      return res.json({ 
        valid: false, 
        error: `Fish Audio API 错误: ${error.response.statusText}` 
      });
    }
    
    if (error.code === 'ECONNABORTED') {
      console.error(`[${timestamp}] 请求超时错误`);
      return res.json({ 
        valid: false, 
        error: '请求超时' 
      });
    }
    
    console.error(`[${timestamp}] 服务器内部错误:`, error.stack || error.message);
    res.json({ 
      valid: false, 
      error: '验证过程中发生错误' 
    });
  }
});

// 获取Fish Audio模型信息 (别名端点)
app.get('/api/model-info/:modelId', apiKeyAuth, async (req, res) => {
  const timestamp = new Date().toISOString();
  const clientIP = req.ip || req.connection.remoteAddress || req.headers['x-forwarded-for'] || 'unknown';
  
  try {
    const { modelId } = req.params;
    const fish_audio_key = req.headers['fish-audio-key'];

    console.log(`[${timestamp}] 获取模型信息请求 - IP: ${clientIP}, 模型ID: ${modelId}`);
    console.log(`[${timestamp}] API Key 状态: ${fish_audio_key ? '已提供' : '未提供'}`);

    if (!modelId) {
      console.warn(`[${timestamp}] 模型信息请求失败 - 缺少模型ID`);
      return res.status(400).json({ error: '缺少必需的 modelId 参数' });
    }

    if (!fish_audio_key) {
      console.warn(`[${timestamp}] 模型信息请求失败 - 缺少 Fish Audio API Key`);
      return res.status(400).json({ error: '缺少必需的 fish_audio_key 参数' });
    }

    // 使用正确的Fish Audio API URL格式
    const apiUrl = `https://api.fish.audio/model/${modelId}`;
    console.log(`[${timestamp}] 调用 Fish Audio API - URL: ${apiUrl}`);
    
    const response = await axios({
      method: 'GET',
      url: apiUrl,
      headers: {
        'Authorization': `Bearer ${fish_audio_key}`
      },
      timeout: 10000
    });

    console.log(`[${timestamp}] Fish Audio API 响应成功 - 状态码: ${response.status}`);
    console.log(`[${timestamp}] 模型信息获取成功 - 模型名称: ${response.data.title || '未知'}, 类型: ${response.data.type || '未知'}`);

    res.json(response.data);
  } catch (error) {
    console.error(`[${timestamp}] 获取模型信息失败 - IP: ${clientIP}`);
    console.error(`[${timestamp}] 错误详情:`, error.message);
    
    if (error.response) {
      console.error(`[${timestamp}] Fish Audio API 错误 - 状态码: ${error.response.status}, 状态文本: ${error.response.statusText}`);
      if (error.response.data) {
        console.error(`[${timestamp}] API 错误响应:`, error.response.data);
      }
      
      if (error.response.status === 404) {
        console.warn(`[${timestamp}] 模型不存在 - 模型ID: ${modelId}`);
        return res.status(404).json({
          error: '模型不存在',
          details: '找不到指定的模型ID'
        });
      }
      
      return res.status(error.response.status).json({
        error: 'Fish Audio API 错误',
        details: error.response.statusText
      });
    }
    
    if (error.code === 'ECONNABORTED') {
      console.error(`[${timestamp}] 请求超时错误`);
      return res.status(408).json({
        error: '请求超时',
        details: 'Fish Audio API 响应超时'
      });
    }
    
    console.error(`[${timestamp}] 服务器内部错误:`, error.stack || error.message);
    res.status(500).json({
      error: '获取模型信息失败',
      details: error.message
    });
  }
});



// 启动服务器
app.listen(PORT, () => {
  console.log(`🎵 TTS 服务器运行在 http://localhost:${PORT}`);
  console.log(`📋 健康检查: http://localhost:${PORT}/api/health`);
  console.log(`🔑 Fish Audio API Key 由前端提供`);
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