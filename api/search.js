const axios = require('axios');

// Google Custom Search API
const GOOGLE_CSE_ENDPOINT = 'https://www.googleapis.com/customsearch/v1';

module.exports = async (req, res) => {
  const timestamp = new Date().toISOString();
  const clientIP = req.headers['x-forwarded-for'] || req.connection?.remoteAddress || 'unknown';

  console.log(`[${timestamp}] 搜索 API 请求 - IP: ${clientIP}, Method: ${req.method}`);

  // CORS 头设置
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-api-key');
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');

  // 处理预检请求
  if (req.method === 'OPTIONS') {
    console.log(`[${timestamp}] 搜索 OPTIONS 预检请求处理完成`);
    return res.status(200).end();
  }

  // API 密钥验证（与现有接口保持一致）
  const apiKeyHeader = req.headers['x-api-key'];
  const expectedApiKey = process.env.API_SECRET;

  if (!expectedApiKey) {
    console.error(`[${timestamp}] 搜索服务器配置错误：未设置 API_SECRET 环境变量`);
    return res.status(500).json({ error: '服务器未配置 API 密钥' });
  }

  if (!apiKeyHeader || apiKeyHeader !== expectedApiKey) {
    console.warn(`[${timestamp}] 搜索未授权访问尝试 - IP: ${clientIP}, 提供的密钥: ${apiKeyHeader ? '***' : '无'}`);
    return res.status(401).json({ error: '未授权访问：无效的 API 密钥' });
  }

  // 只允许 GET 请求
  if (req.method !== 'GET') {
    console.warn(`[${timestamp}] 搜索不支持的请求方法: ${req.method}`);
    return res.status(405).json({ error: '只允许 GET 请求' });
  }

  try {
    const {
      q,
      num = '5',
      lang,
      country,
      safe = 'off', // 'on' | 'off' 或 'active' | 'off'
      provider = 'google-cse',
      key, // 用户前端提供的 Google API Key（可选）
      cx // 用户前端提供的 Engine ID（可选）
    } = req.query;

    if (!q || !q.trim()) {
      console.warn(`[${timestamp}] 搜索请求失败：缺少 q 参数`);
      return res.status(400).json({ error: '缺少必需的 q 参数' });
    }

    // 目前仅支持 Google CSE
    if (provider && provider !== 'google-cse') {
      console.warn(`[${timestamp}] 不支持的搜索提供商: ${provider}`);
      return res.status(400).json({ error: '不支持的提供商', provider });
    }

    // 密钥与 Engine 优先级：前端提供 > 服务端环境变量
    const serverKey = process.env.GOOGLE_SEARCH_API_KEY;
    const serverCx = process.env.GOOGLE_SEARCH_CX;
    const googleKey = (key && String(key).trim()) || serverKey;
    const engineId = (cx && String(cx).trim()) || serverCx;

    if (!googleKey || !engineId) {
      console.warn(`[${timestamp}] 搜索请求失败：缺少 Google API Key 或 Engine ID`);
      return res.status(400).json({ error: '未配置搜索密钥或 Engine ID' });
    }

    // 归一化参数
    const limit = Math.max(1, Math.min(parseInt(num, 10) || 5, 10));
    const safeMode = ['on', 'active'].includes(String(safe).toLowerCase()) ? 'active' : 'off';

    const params = {
      key: googleKey,
      cx: engineId,
      q: q,
      num: limit,
      safe: safeMode
    };

    if (lang) params.hl = lang; // 语言偏好
    if (country) params.gl = country; // 地域偏好

    console.log(`[${timestamp}] 调用 Google CSE`, {
      q: q.length > 80 ? q.substring(0, 80) + '...' : q,
      num: limit,
      lang: lang || null,
      country: country || null,
      safe: safeMode,
      provider: 'google-cse'
    });

    const startTime = Date.now();
    const response = await axios.get(GOOGLE_CSE_ENDPOINT, {
      params,
      timeout: 10000
    });
    const duration = (Date.now() - startTime) / 1000;

    const items = (response.data.items || []).map((item) => ({
      title: item.title,
      link: item.link,
      snippet: item.snippet,
      source: 'google-cse'
    }));

    const totalResults = parseInt(response.data?.searchInformation?.totalResults || '0', 10);
    const time = typeof response.data?.searchInformation?.searchTime === 'number'
      ? response.data.searchInformation.searchTime
      : duration;

    console.log(`[${timestamp}] 搜索成功 - 返回 ${items.length} 条，耗时 ${time}s`);

    return res.status(200).json({
      items,
      query: q,
      provider: 'google-cse',
      searchInformation: { totalResults, time }
    });

  } catch (error) {
    console.error(`[${timestamp}] 搜索处理错误:`, {
      message: error.message,
      code: error.code,
      stack: error.stack?.split('\n')[0]
    });

    if (error.response) {
      const status = error.response.status;
      const details = error.response.data?.error?.message || error.response.statusText;
      console.warn(`[${timestamp}] Google CSE 响应错误 - 状态码: ${status}, 详情: ${details}`);
      return res.status(status).json({ error: 'Google CSE 错误', details });
    }

    if (error.code === 'ECONNABORTED') {
      console.error(`[${timestamp}] 搜索请求超时`);
      return res.status(408).json({ error: '请求超时', details: 'Google CSE 响应超时' });
    }

    console.error(`[${timestamp}] 服务器内部错误: ${error.message}`);
    return res.status(500).json({ error: '服务器内部错误', details: error.message });
  }
};