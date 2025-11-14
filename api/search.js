const axios = require('axios');

// Google Custom Search API
const GOOGLE_CSE_ENDPOINT = 'https://www.googleapis.com/customsearch/v1';

// 提取与日期相关的字段名集合（大小写不敏感）
const DATE_META_KEYS = [
  'article:published_time',
  'article:modified_time',
  'og:updated_time',
  'date',
  'datePublished',
  'dateModified',
  'publish_date',
  'pubdate',
  'ptime',
  'utime',
  'sailthru.date',
  'parsely-pub-date'
];

/**
 * 尝试将字符串解析为合法日期，返回 ISO 字符串
 */
function toIsoDate(value) {
  if (!value) return null;
  const str = String(value).trim();
  // 处理 Unix 时间戳（秒/毫秒）
  if (/^\d{10,13}$/.test(str)) {
    const num = Number(str);
    const ts = str.length === 13 ? num : num * 1000;
    const d = new Date(ts);
    return isNaN(d.getTime()) ? null : d.toISOString();
  }
  const d = new Date(str);
  return isNaN(d.getTime()) ? null : d.toISOString();
}

/**
 * 从 Google CSE item 的 pagemap/元标签中提取日期
 * 返回 { date, source, confidence } 或 null
 */
function extractDateFromItem(item) {
  try {
    const pm = item?.pagemap || {};
    // 1) 优先从 metatags 中找常见字段
    const metaArr = Array.isArray(pm.metatags) ? pm.metatags : [];
    for (const meta of metaArr) {
      for (const key of DATE_META_KEYS) {
        // 兼容大小写/不同写法
        const candidate = meta[key] || meta[key.toLowerCase()] || meta[key.toUpperCase()];
        const iso = toIsoDate(candidate);
        if (iso) {
          // 若字段是 published_time，置信度高；否则中等
          const highKeys = ['article:published_time', 'datePublished', 'pubdate', 'parsely-pub-date'];
          const confidence = highKeys.includes(key) ? 'high' : 'medium';
          return { date: iso, source: 'pagemap', confidence };
        }
      }
    }

    // 2) 尝试结构化实体：Article/NewsArticle/BlogPosting
    const tryEntities = ['article', 'newsarticle', 'blogposting', 'webpage'];
    for (const eKey of tryEntities) {
      const arr = Array.isArray(pm[eKey]) ? pm[eKey] : [];
      for (const ent of arr) {
        const isoPub = toIsoDate(ent?.datepublished || ent?.datePublished);
        if (isoPub) return { date: isoPub, source: 'pagemap', confidence: 'high' };
        const isoMod = toIsoDate(ent?.datemodified || ent?.dateModified);
        if (isoMod) return { date: isoMod, source: 'pagemap', confidence: 'medium' };
      }
    }

    // 3) 一些站点会把日期放在 cse_thumbnail/cse_image 的元数据中（极少数），忽略以避免误判
    return null;
  } catch (e) {
    return null;
  }
}

/**
 * 通过 HEAD 请求尝试获取 Last-Modified 作为日期回退
 */
async function getLastModifiedByHead(url) {
  if (!url) return null;
  try {
    const resp = await axios.head(url, {
      timeout: 4000,
      maxRedirects: 4,
      // 某些站点需要 UA 才返回完整头部
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; FloatyBot/1.0)' }
    });
    const lm = resp?.headers?.['last-modified'] || resp?.headers?.['Last-Modified'];
    const iso = toIsoDate(lm);
    return iso || null;
  } catch {
    return null;
  }
}

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
      cx, // 用户前端提供的 Engine ID（可选）
      withDate // 可选：是否尽力返回每条结果的日期信息（包含 Last-Modified 回退）
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

    const rawItems = Array.isArray(response.data.items) ? response.data.items : [];
    const enableHeaderFallback = String(withDate || '').toLowerCase() === '1' || String(withDate || '').toLowerCase() === 'true';

    // 并发处理每条结果的日期提取
    const items = await Promise.all(
      rawItems.map(async (item) => {
        const meta = extractDateFromItem(item) || {};
        let date = meta.date || null;
        let dateSource = meta.source || null;
        let dateConfidence = meta.confidence || null;

        // 若需要且未从元信息获得日期，尝试使用 Last-Modified 回退
        if (!date && enableHeaderFallback) {
          const lm = await getLastModifiedByHead(item.link);
          if (lm) {
            date = lm;
            dateSource = 'http-header';
            dateConfidence = 'low';
          }
        }

        return {
          title: item.title,
          link: item.link,
          snippet: item.snippet,
          source: 'google-cse',
          date,
          dateSource,
          dateConfidence
        };
      })
    );

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