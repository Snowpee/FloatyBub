module.exports = async (req, res) => {
  const timestamp = new Date().toISOString();
  const clientIP = req.headers['x-forwarded-for'] || req.connection.remoteAddress || 'unknown';
  
  console.log(`[${timestamp}] 健康检查请求 - IP: ${clientIP}, Method: ${req.method}`);
  
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

  // 只允许 GET 请求
  if (req.method !== 'GET') {
    console.warn(`[${timestamp}] 不支持的请求方法: ${req.method}`);
    return res.status(405).json({ error: '只允许 GET 请求' });
  }

  const FISH_AUDIO_API_KEY = process.env.FISH_AUDIO_API_KEY;
  
  console.log(`[${timestamp}] 健康检查成功 - Fish Audio API Key 配置状态: ${!!FISH_AUDIO_API_KEY ? '已配置' : '未配置'}`);

  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    api_key_configured: !!FISH_AUDIO_API_KEY,
    platform: 'vercel'
  });
};