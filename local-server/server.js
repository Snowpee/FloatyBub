const express = require('express');
const cors = require('cors');
const axios = require('axios');
const cheerio = require('cheerio');
const puppeteer = require('puppeteer');
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

console.log('本地代理服务启动，Fish Audio API Key 将由前端提供');

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

// Google Custom Search API
const GOOGLE_CSE_ENDPOINT = 'https://www.googleapis.com/customsearch/v1';

// 联网搜索（Google CSE）
app.get('/api/search', apiKeyAuth, async (req, res) => {
  const timestamp = new Date().toISOString();
  const clientIP = req.ip || req.connection?.remoteAddress || req.headers['x-forwarded-for'] || 'unknown';

  try {
    // CORS 头设置（额外保障，尽管已使用 cors()）
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-api-key');
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');

    const {
      q,
      num = '5',
      lang,
      country,
      safe = 'off', // 'active' | 'off'
      provider = 'google-cse',
      key, // 用户前端提供的 Google API Key（可选）
      cx   // 用户前端提供的 Engine ID（可选）
    } = req.query;

    if (!q || !String(q).trim()) {
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
      q: String(q), // 保持原始字符串，避免重复编码
      num: limit,
      safe: safeMode
    };

    if (lang) params.hl = lang; // 语言偏好
    if (country) params.gl = country; // 地域偏好

    console.log(`[${timestamp}] 调用 Google CSE`, {
      q: String(q).length > 80 ? String(q).substring(0, 80) + '...' : String(q),
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
});

// 访问页面并提取内容
app.get('/api/visit-page', apiKeyAuth, async (req, res) => {
  const timestamp = new Date().toISOString();
  const clientIP = req.ip || req.connection?.remoteAddress || req.headers['x-forwarded-for'] || 'unknown';

  try {
    const { url } = req.query;

    if (!url || !url.trim()) {
      return res.status(400).json({ error: '缺少必需的 url 参数' });
    }

    console.log(`[${timestamp}] 正在访问 URL: ${url} (IP: ${clientIP})`);

    // CORS 头设置
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-api-key');
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');

    let html;
    let usedPuppeteer = false;

    // 1. 尝试使用 Axios 获取静态内容
    try {
      const response = await axios.get(url, {
        timeout: 5000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; FloatyBot/1.0; +http://your-site.com)'
        },
        maxRedirects: 5
      });
      html = response.data;
    } catch (e) {
      console.warn(`[${timestamp}] Axios 抓取失败，尝试 Puppeteer: ${e.message}`);
    }

    // 2. 检查内容质量，决定是否使用 Puppeteer
    let shouldRunPuppeteer = false;
    
    if (!html) {
      shouldRunPuppeteer = true;
    } else {
       // 检查原始 HTML 长度
       if (html.length < 1000) shouldRunPuppeteer = true;
       // 检查关键字
       else if (html.includes('enable JavaScript') || html.includes('You need to enable JavaScript')) shouldRunPuppeteer = true;
       else {
         // 检查提取后的文本长度（针对 SPA）
         const $temp = cheerio.load(html);
         $temp('script, style, noscript, iframe, svg, header, footer, nav').remove();
         const tempText = $temp('body').text().replace(/\s+/g, ' ').trim();
         if (tempText.length < 200) {
           console.log(`[${timestamp}] 静态内容提取文本过短 (${tempText.length} chars)，判定为需要 JS 渲染`);
           shouldRunPuppeteer = true;
         }
       }
    }

    if (shouldRunPuppeteer) {
      console.log(`[${timestamp}] 启用 Puppeteer 进行 JS 渲染...`);
      const browser = await puppeteer.launch({
        headless: "new",
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      });
      const page = await browser.newPage();
      
      // 设置 User-Agent 模拟真实浏览器
      await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
      
      try {
        await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
        html = await page.content();
        usedPuppeteer = true;
      } catch (e) {
        console.error(`[${timestamp}] Puppeteer 渲染失败:`, e.message);
        if (!html) throw e; // 如果之前也没有内容，则抛出错误
      } finally {
        await browser.close();
      }
    }

    const $ = cheerio.load(html);

    // 移除无关元素
    $('script').remove();
    $('style').remove();
    $('noscript').remove();
    $('iframe').remove();
    $('svg').remove();
    $('header').remove();
    $('footer').remove();
    $('nav').remove();
    $('.nav').remove();
    $('.menu').remove();
    $('.ads').remove();
    $('.sidebar').remove();

    const title = $('title').text().trim();
    
    // 提取主要文本
    let text = $('body').text();
    
    // 清理文本
    text = text.replace(/\s+/g, ' ').trim();
    
    // 简单的长度限制
    const maxLength = 20000;
    if (text.length > maxLength) {
      text = text.substring(0, maxLength) + '... (content truncated)';
    }

    console.log(`[${timestamp}] 页面访问成功: ${title}, 长度: ${text.length} (Puppeteer: ${usedPuppeteer})`);

    return res.status(200).json({
      url,
      title,
      content: text || '无法提取到有效内容',
      length: text.length,
      usedPuppeteer
    });

  } catch (error) {
    console.error(`[${timestamp}] 页面访问失败:`, error.message);
    
    const status = error.response ? error.response.status : 500;
    const message = error.response ? error.response.statusText : error.message;

    return res.status(status).json({
      error: '访问页面失败',
      details: message,
      url: req.query.url
    });
  }
});

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
  console.log(`🚀 本地代理服务运行在 http://localhost:${PORT}`);
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
