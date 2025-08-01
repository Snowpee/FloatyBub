const axios = require('axios');

module.exports = async (req, res) => {
  const timestamp = new Date().toISOString();
  const clientIP = req.headers['x-forwarded-for'] || req.connection.remoteAddress || 'unknown';
  
  console.log(`[${timestamp}] 密钥验证请求 - IP: ${clientIP}, Method: ${req.method}`);
  
  // 设置 CORS 头
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-api-key');

  // 处理 OPTIONS 请求
  if (req.method === 'OPTIONS') {
    console.log(`[${timestamp}] OPTIONS 预检请求处理完成`);
    return res.status(200).end();
  }

  // API 密钥验证
  const apiKey = req.headers['x-api-key'];
  const expectedApiKey = process.env.API_SECRET;
  
  if (!expectedApiKey) {
    console.error(`[${timestamp}] 服务器配置错误：未设置 API_SECRET 环境变量`);
    return res.status(500).json({ error: '服务器未配置 API 密钥' });
  }
  
  if (!apiKey || apiKey !== expectedApiKey) {
    console.warn(`[${timestamp}] 未授权访问尝试 - IP: ${clientIP}, 提供的密钥: ${apiKey ? '***' : '无'}`);
    return res.status(401).json({ error: '未授权访问：无效的 API 密钥' });
  }

  // 只允许 POST 请求
  if (req.method !== 'POST') {
    console.warn(`[${timestamp}] 不支持的请求方法: ${req.method}`);
    return res.status(405).json({ error: '只允许 POST 请求' });
  }

  try {
    const { apiKey: fishApiKey, apiUrl } = req.body;
    
    if (!fishApiKey || !fishApiKey.trim()) {
      console.warn(`[${timestamp}] 密钥验证失败 - 未提供 Fish Audio API 密钥`);
      return res.json({ valid: false, error: '未提供 Fish Audio API 密钥' });
    }

    // 使用提供的 API 地址或默认地址
    const baseUrl = apiUrl || 'https://api.fish.audio';
    
    // 通过调用 Fish Audio API 来验证密钥
    const response = await axios.get(`${baseUrl}/model`, {
      headers: {
        'Authorization': `Bearer ${fishApiKey.trim()}`,
        'Content-Type': 'application/json'
      },
      timeout: 10000 // 10秒超时
    });

    if (response.status === 200) {
      console.log(`[${timestamp}] Fish Audio API 密钥验证成功 - IP: ${clientIP}`);
      return res.json({ valid: true });
    } else {
      console.warn(`[${timestamp}] Fish Audio API 密钥验证失败 - 状态码: ${response.status}`);
      return res.json({ valid: false, error: 'API 密钥无效' });
    }
    
  } catch (error) {
    console.error(`[${timestamp}] Fish Audio API 密钥验证错误:`, error.message);
    
    if (error.response) {
      const status = error.response.status;
      if (status === 401 || status === 403) {
        console.warn(`[${timestamp}] Fish Audio API 密钥验证失败 - 未授权访问`);
        return res.json({ valid: false, error: 'API 密钥无效或已过期' });
      } else if (status === 429) {
        console.warn(`[${timestamp}] Fish Audio API 密钥验证失败 - 请求频率限制`);
        return res.json({ valid: false, error: '请求过于频繁，请稍后再试' });
      }
    }
    
    if (error.code === 'ECONNABORTED') {
      console.error(`[${timestamp}] Fish Audio API 密钥验证超时`);
      return res.json({ valid: false, error: '验证超时，请检查网络连接' });
    }
    
    if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
      console.error(`[${timestamp}] Fish Audio API 连接失败`);
      return res.json({ valid: false, error: '无法连接到 Fish Audio API' });
    }
    
    return res.json({ valid: false, error: '验证过程中发生错误' });
  }
};