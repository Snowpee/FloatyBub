const axios = require('axios');

// Fish Audio API 配置
const FISH_AUDIO_BASE_URL = 'https://api.fish.audio';

module.exports = async (req, res) => {
  const timestamp = new Date().toISOString();
  const clientIP = req.headers['x-forwarded-for'] || req.connection.remoteAddress || 'unknown';
  
  console.log(`[${timestamp}] 模型信息 API 请求 - IP: ${clientIP}, Method: ${req.method}`);
  
  // 设置 CORS 头
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-api-key');

  // 处理 OPTIONS 请求
  if (req.method === 'OPTIONS') {
    console.log(`[${timestamp}] 模型信息 OPTIONS 预检请求处理完成`);
    return res.status(200).end();
  }

  // 只允许 POST 请求
  if (req.method !== 'POST') {
    console.warn(`[${timestamp}] 模型信息 API 不支持的请求方法: ${req.method}`);
    return res.status(405).json({ error: '只允许 POST 请求' });
  }

  // API 密钥验证
  const apiKey = req.headers['x-api-key'];
  const expectedApiKey = process.env.API_SECRET;
  
  if (!expectedApiKey) {
    console.error(`[${timestamp}] 模型信息 API 服务器配置错误：未设置 API_SECRET 环境变量`);
    return res.status(500).json({ error: '服务器未配置 API 密钥' });
  }
  
  if (!apiKey || apiKey !== expectedApiKey) {
    console.warn(`[${timestamp}] 模型信息 API 未授权访问尝试 - IP: ${clientIP}, 提供的密钥: ${apiKey ? '***' : '无'}`);
    return res.status(401).json({ error: '未授权访问：无效的 API 密钥' });
  }

  try {
    // 从请求体获取参数
    const { model_id, fish_audio_key } = req.body;
    
    console.log(`[${timestamp}] 模型信息请求参数:`, {
      model_id: model_id ? model_id.substring(0, 8) + '...' : null,
      hasApiKey: !!fish_audio_key
    });
    
    if (!model_id) {
      console.warn(`[${timestamp}] 模型信息请求失败：缺少 model_id 参数`);
      return res.status(400).json({ error: '缺少必需的 model_id 参数' });
    }

    if (!fish_audio_key) {
      console.warn(`[${timestamp}] 模型信息请求失败：缺少 fish_audio_key 参数`);
      return res.status(400).json({ error: '缺少必需的 fish_audio_key 参数' });
    }

    console.log(`[${timestamp}] 开始获取模型信息: ${model_id.substring(0, 8)}...`);

    const response = await axios({
      method: 'GET',
      url: `${FISH_AUDIO_BASE_URL}/model/${model_id}`,
      headers: {
        'Authorization': `Bearer ${fish_audio_key}`
      },
      timeout: 10000 // 10秒超时
    });

    console.log(`[${timestamp}] 模型信息获取成功:`, {
      model_id: model_id.substring(0, 8) + '...',
      status: response.status,
      title: response.data?.title || '未知'
    });

    res.json(response.data);
  } catch (error) {
    console.error(`[${timestamp}] 获取模型信息错误:`, {
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
      
      if (error.response.status === 404) {
        console.warn(`[${timestamp}] 模型不存在: ${req.body.model_id}`);
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
      console.error(`[${timestamp}] 模型信息请求超时`);
      return res.status(408).json({
        error: '请求超时',
        details: 'Fish Audio API 响应超时'
      });
    }
    
    console.error(`[${timestamp}] 获取模型信息服务器错误:`, error.message);
    res.status(500).json({
      error: '获取模型信息失败',
      details: error.message
    });
  }
};