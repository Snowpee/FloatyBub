const axios = require('axios');
const msgpack = require('msgpack5')();

// Fish Audio API 配置
const FISH_AUDIO_BASE_URL = 'https://api.fish.audio/v1';

// 支持的模型列表
const SUPPORTED_MODELS = ['speech-1.5', 'speech-1.6', 's1'];
const DEFAULT_MODEL = 'speech-1.6';

module.exports = async (req, res) => {
  const timestamp = new Date().toISOString();
  const clientIP = req.headers['x-forwarded-for'] || req.connection.remoteAddress || 'unknown';
  
  console.log(`[${timestamp}] TTS API 请求 - IP: ${clientIP}, Method: ${req.method}`);
  
  // 设置 CORS 头
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-api-key, x-fish-api-key');
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin'); // 添加 ORB 头部

  // 处理 OPTIONS 请求
  if (req.method === 'OPTIONS') {
    console.log(`[${timestamp}] TTS OPTIONS 预检请求处理完成`);
    return res.status(200).end();
  }

  // API 密钥验证 - 支持从请求头或 query 参数获取
  const apiKey = req.headers['x-api-key'] || req.query.x_api_key;
  const expectedApiKey = process.env.API_SECRET;
  
  if (!expectedApiKey) {
    console.error(`[${timestamp}] TTS 服务器配置错误：未设置 API_SECRET 环境变量`);
    return res.status(500).json({ error: '服务器未配置 API 密钥' });
  }
  
  if (!apiKey || apiKey !== expectedApiKey) {
    console.warn(`[${timestamp}] TTS 未授权访问尝试 - IP: ${clientIP}, 提供的密钥: ${apiKey ? '***' : '无'}`);
    return res.status(401).json({ error: '未授权访问：无效的 API 密钥' });
  }

  // 处理 GET 请求 - 流式播放或返回模型列表
  if (req.method === 'GET') {
    // 检查是否是流式播放请求
    if (req.query.stream === 'true' || req.query.text) {
      // 流式播放逻辑
      try {
        const {
          text,
          format = 'mp3',
          mp3_bitrate = 128,
          reference_id = null,
          normalize = 'true',
          latency = 'normal',
          chunk_length = 100,
          model = 'speech-1.6',
          fish_audio_key
        } = req.query;

        console.log(`[${timestamp}] TTS 流式播放请求参数解析:`, {
          textLength: text ? text.length : 0,
          format,
          mp3_bitrate,
          reference_id: reference_id ? reference_id.substring(0, 8) + '...' : null,
          normalize,
          latency,
          chunk_length,
          model
        });

        if (!text) {
          console.warn(`[${timestamp}] TTS 流式播放请求失败：缺少文本参数`);
          return res.status(400).json({ error: '缺少必需的 text 参数' });
        }

        if (!fish_audio_key) {
          console.warn(`[${timestamp}] TTS 流式播放请求失败：缺少 Fish Audio API Key`);
          return res.status(400).json({ error: '缺少必需的 fish_audio_key 参数' });
        }

        // 验证模型参数
        const selectedModel = SUPPORTED_MODELS.includes(model) ? model : DEFAULT_MODEL;
        if (selectedModel !== model) {
          console.warn(`[${timestamp}] 模型参数无效，使用默认模型: ${model} -> ${selectedModel}`);
        }

        // 构建请求数据
        const requestData = {
          text,
          chunk_length: parseInt(chunk_length),
          format,
          mp3_bitrate: parseInt(mp3_bitrate),
          references: [],
          reference_id,
          normalize: normalize === 'true',
          latency
        };

        console.log(`[${timestamp}] 开始 TTS 流式播放处理:`, {
          text: text.substring(0, 100) + (text.length > 100 ? '...' : ''),
          format,
          reference_id: reference_id ? reference_id.substring(0, 8) + '...' : null,
          model: selectedModel,
          hasApiKey: !!fish_audio_key
        });

        // 使用 msgpack 编码请求数据
        const encodedData = msgpack.encode(requestData);
        console.log(`[${timestamp}] 请求数据编码完成，大小: ${encodedData.length} 字节`);

        // 调用 Fish Audio API
        console.log(`[${timestamp}] 调用 Fish Audio API: ${FISH_AUDIO_BASE_URL}/tts`);
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
          timeout: 30000 // 30秒超时（Vercel 限制）
        });

        console.log(`[${timestamp}] Fish Audio API 响应成功，状态码: ${response.status}`);

        // 设置流式播放响应头（不包含 Content-Disposition: attachment）
        res.setHeader('Content-Type', `audio/${format}`);
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');

        console.log(`[${timestamp}] 开始流式传输音频数据，格式: ${format}`);
        // 流式传输音频数据
        response.data.pipe(res);
        
        // 监听流传输完成
        response.data.on('end', () => {
          console.log(`[${timestamp}] 音频数据传输完成`);
        });
        
        response.data.on('error', (streamError) => {
          console.error(`[${timestamp}] 音频流传输错误:`, streamError.message);
        });

        return; // 重要：直接返回，不执行后续代码

      } catch (error) {
        console.error(`[${timestamp}] TTS 流式播放处理错误:`, {
          message: error.message,
          code: error.code,
          stack: error.stack?.split('\n')[0]
        });
        
        if (error.response) {
          console.error(`[${timestamp}] Fish Audio API 响应错误:`, {
            status: error.response.status,
            statusText: error.response.statusText,
            data: error.response.data
          });
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
        
        console.error(`[${timestamp}] 服务器内部错误:`, error.message);
        return res.status(500).json({
          error: '服务器内部错误',
          details: error.message
        });
      }
    } else {
      // 返回支持的模型列表
      console.log(`[${timestamp}] 获取支持的模型列表 - 返回 ${SUPPORTED_MODELS.length} 个模型`);
      return res.status(200).json({
        success: true,
        models: SUPPORTED_MODELS,
        default: DEFAULT_MODEL
      });
    }
  }

  // 只允许 POST 请求进行 TTS
  if (req.method !== 'POST') {
    console.warn(`[${timestamp}] TTS 不支持的请求方法: ${req.method}`);
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

    console.log(`[${timestamp}] TTS 请求参数解析:`, {
      textLength: text ? text.length : 0,
      format,
      mp3_bitrate,
      reference_id: reference_id ? reference_id.substring(0, 8) + '...' : null,
      normalize,
      latency,
      chunk_length,
      model
    });

    if (!text) {
      console.warn(`[${timestamp}] TTS 请求失败：缺少文本参数`);
      return res.status(400).json({ error: '缺少必需的 text 参数' });
    }

    // 从请求体获取 Fish Audio API Key
    const { fish_audio_key } = req.body;
    if (!fish_audio_key) {
      console.warn(`[${timestamp}] TTS 请求失败：缺少 Fish Audio API Key`);
      return res.status(400).json({ error: '缺少必需的 fish_audio_key 参数' });
    }

    // 验证模型参数
    const selectedModel = SUPPORTED_MODELS.includes(model) ? model : DEFAULT_MODEL;
    if (selectedModel !== model) {
      console.warn(`[${timestamp}] 模型参数无效，使用默认模型: ${model} -> ${selectedModel}`);
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

    console.log(`[${timestamp}] 开始 TTS 处理:`, {
      text: text.substring(0, 100) + (text.length > 100 ? '...' : ''),
      format,
      reference_id: reference_id ? reference_id.substring(0, 8) + '...' : null,
      model: selectedModel,
      hasApiKey: !!fish_audio_key
    });

    // 使用 msgpack 编码请求数据
    const encodedData = msgpack.encode(requestData);
    console.log(`[${timestamp}] 请求数据编码完成，大小: ${encodedData.length} 字节`);

    // 调用 Fish Audio API
    console.log(`[${timestamp}] 调用 Fish Audio API: ${FISH_AUDIO_BASE_URL}/tts`);
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
      timeout: 30000 // 30秒超时（Vercel 限制）
    });

    console.log(`[${timestamp}] Fish Audio API 响应成功，状态码: ${response.status}`);

    // 设置响应头（去掉 Content-Disposition: attachment 以支持流式播放）
    res.setHeader('Content-Type', `audio/${format}`);
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    console.log(`[${timestamp}] 开始流式传输音频数据，格式: ${format}`);
    // 流式传输音频数据
    response.data.pipe(res);
    
    // 监听流传输完成
    response.data.on('end', () => {
      console.log(`[${timestamp}] 音频数据传输完成`);
    });
    
    response.data.on('error', (streamError) => {
      console.error(`[${timestamp}] 音频流传输错误:`, streamError.message);
    });

  } catch (error) {
    console.error(`[${timestamp}] TTS 处理错误:`, {
      message: error.message,
      code: error.code,
      stack: error.stack?.split('\n')[0]
    });
    
    if (error.response) {
      console.error(`[${timestamp}] Fish Audio API 响应错误:`, {
        status: error.response.status,
        statusText: error.response.statusText,
        data: error.response.data
      });
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
    
    console.error(`[${timestamp}] 服务器内部错误:`, error.message);
    res.status(500).json({
      error: '服务器内部错误',
      details: error.message
    });
  }
};