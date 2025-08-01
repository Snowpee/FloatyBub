const axios = require('axios');

// Fish Audio API 配置
const FISH_AUDIO_BASE_URL = 'https://api.fish.audio/v1';

module.exports = async (req, res) => {
  // 设置 CORS 头
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-fish-api-key');

  // 处理 OPTIONS 请求
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // 只允许 GET 请求
  if (req.method !== 'GET') {
    return res.status(405).json({ error: '只允许 GET 请求' });
  }

  try {
    // 从请求头获取 Fish Audio API Key
    const fishApiKey = req.headers['x-fish-api-key'];
    if (!fishApiKey) {
      return res.status(400).json({ error: '缺少 Fish Audio API 密钥' });
    }

    const response = await axios({
      method: 'GET',
      url: `${FISH_AUDIO_BASE_URL}/models`,
      headers: {
        'Authorization': `Bearer ${fishApiKey}`
      },
      timeout: 10000 // 10秒超时
    });

    res.json(response.data);
  } catch (error) {
    console.error('获取模型列表错误:', error.message);
    res.status(500).json({
      error: '获取模型列表失败',
      details: error.message
    });
  }
};