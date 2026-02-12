const axios = require('axios');
const cheerio = require('cheerio');
const puppeteer = require('puppeteer-core');
const chromium = require('@sparticuz/chromium-min');

// 配置 Vercel Serverless Function 的最大执行时间 (秒)
// 需要在 Vercel 项目设置或 vercel.json 中配合配置，这里仅作为代码层面的注释
// export const maxDuration = 60; 

module.exports = async (req, res) => {
  const timestamp = new Date().toISOString();
  const clientIP = req.headers['x-forwarded-for'] || req.connection?.remoteAddress || 'unknown';

  console.log(`[${timestamp}] 访问页面 API 请求 - IP: ${clientIP}, Method: ${req.method}`);

  // CORS 头设置
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-api-key');
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');

  // 处理预检请求
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // API 密钥验证
  const apiKeyHeader = req.headers['x-api-key'];
  const expectedApiKey = process.env.API_SECRET;

  if (!expectedApiKey) {
    console.error(`[${timestamp}] 服务器配置错误：未设置 API_SECRET 环境变量`);
    return res.status(500).json({ error: '服务器未配置 API 密钥' });
  }

  if (!apiKeyHeader || apiKeyHeader !== expectedApiKey) {
    console.warn(`[${timestamp}] 未授权访问尝试 - IP: ${clientIP}, 提供的密钥: ${apiKeyHeader ? '***' : '无'}`);
    return res.status(401).json({ error: '未授权访问：无效的 API 密钥' });
  }

  // 只允许 GET 请求
  if (req.method !== 'GET') {
    return res.status(405).json({ error: '只允许 GET 请求' });
  }

  try {
    const { url } = req.query;

    if (!url || !url.trim()) {
      return res.status(400).json({ error: '缺少必需的 url 参数' });
    }

    console.log(`[${timestamp}] 正在访问 URL: ${url}`);

    let html;
    let usedPuppeteer = false;

    // 1. 尝试使用 Axios 获取静态内容
    try {
      const response = await axios.get(url, {
        timeout: 10000, // 10秒超时
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; FloatyBot/1.0; +http://your-site.com)'
        },
        maxRedirects: 5
      });
      html = response.data;
    } catch (e) {
      console.warn(`[${timestamp}] Axios 抓取失败: ${e.message}`);
      // 如果 Axios 失败，通常意味着需要更强的抓取能力，但在 Vercel 简易环境下可能无法恢复
      if (!html) throw e; 
    }

    // 2. 检查内容质量，决定是否需要 JS 渲染 (同步 local-server 的判断逻辑)
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

    // 3. 尝试运行 Puppeteer (Vercel 环境使用 puppeteer-core + @sparticuz/chromium-min)
    if (shouldRunPuppeteer) {
      console.log(`[${timestamp}] 启用 Puppeteer (Core) 进行 JS 渲染...`);
      
      let browser = null;
      try {
        // 配置 Chromium
        chromium.setHeadlessMode = true; // 新版必须显式设置
        chromium.setGraphicsMode = false;

        browser = await puppeteer.launch({
          args: [...chromium.args, '--hide-scrollbars', '--disable-web-security'],
          defaultViewport: chromium.defaultViewport,
          executablePath: await chromium.executablePath(),
          headless: chromium.headless,
          ignoreHTTPSErrors: true,
        });

        const page = await browser.newPage();
        
        // 设置 User-Agent 模拟真实浏览器
        await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
        
        // 访问页面
        await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
        html = await page.content();
        usedPuppeteer = true;
        
      } catch (e) {
        console.error(`[${timestamp}] Puppeteer 渲染失败:`, e.message);
        // 如果渲染失败，且之前没有 HTML，则抛出异常
        // 如果之前有静态 HTML (质量差)，则降级使用静态 HTML
        if (!html) throw e;
      } finally {
        if (browser) {
          await browser.close();
        }
      }
    }

    const $ = cheerio.load(html || '');

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
};
