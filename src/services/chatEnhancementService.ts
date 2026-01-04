// 聊天增强服务 - 处理知识库检索和上下文注入

import { KnowledgeService } from '@/services/knowledgeService';
import type { KnowledgeEntry, KnowledgeBase } from '@/types/knowledge';

const console: Console = { ...globalThis.console, log: (..._args: any[]) => {} };

// WASM Jieba 分词器状态管理
interface WasmJiebaState {
  isLoaded: boolean;
  isLoading: boolean;
  jieba: any;
  error: string | null;
}

const wasmJiebaState: WasmJiebaState = {
  isLoaded: false,
  isLoading: false,
  jieba: null,
  error: null
};

// 异步加载 WASM Jieba
async function loadWasmJieba(): Promise<void> {
  if (wasmJiebaState.isLoaded || wasmJiebaState.isLoading) {
    return;
  }

  wasmJiebaState.isLoading = true;
  wasmJiebaState.error = null;
  
  try {
    console.info('🔄 [WASM分词] 开始加载 browser-wasm-jieba...');
    
    // 动态导入本地的 jieba WASM 模块
    const { default: init, cut } = await import('../wasm/jieba_rs_wasm.js');
    
    // 初始化 WASM 模块，指定 WASM 文件路径
    await init(new URL('../wasm/jieba_rs_wasm_bg.wasm', import.meta.url));
    
    // 保存 cut 函数到状态中
    wasmJiebaState.jieba = { cut };
    wasmJiebaState.isLoaded = true;
    
    console.info('✅ [WASM分词] browser-wasm-jieba 加载并初始化成功');
  } catch (error) {
    wasmJiebaState.error = error instanceof Error ? error.message : String(error);
    console.warn('⚠️ [WASM分词] browser-wasm-jieba 加载失败，将使用备用分词方案:', error);
  } finally {
    wasmJiebaState.isLoading = false;
  }
}

// 预加载 WASM 模块（可选）
if (typeof window !== 'undefined') {
  // 立即预加载，用于测试
  console.log('🚀 [WASM预加载] 开始预加载 WASM 模块...');
  loadWasmJieba().catch(error => {
    console.log('🔄 [WASM预加载] 预加载失败，将在需要时重新加载:', error);
  });
}

// 常用中文词汇和停用词
const COMMON_CHINESE_WORDS = new Set([
  '我们', '你们', '他们', '这个', '那个', '什么', '怎么', '为什么', '因为', '所以',
  '但是', '然后', '如果', '虽然', '不过', '而且', '或者', '比如', '例如', '就是',
  '可以', '应该', '需要', '想要', '希望', '觉得', '认为', '知道', '了解', '学习',
  '工作', '生活', '时间', '地方', '问题', '方法', '结果', '原因', '目标', '计划'
]);

const STOP_WORDS = new Set([
  '的', '了', '在', '是', '我', '有', '和', '就', '不', '人', '都', '一', '一个',
  '上', '也', '很', '到', '说', '要', '去', '你', '会', '着', '没有', '看', '好',
  '自己', '这', '那', '里', '就是', '还是', '比较', '一些', '可能', '已经'
]);

/**
 * 优化的滑动窗口分词函数（浏览器环境专用）
 */
function optimizedChineseSegment(text: string, minLength: number = 2): string[] {
  const words: string[] = [];
  const textLength = text.length;
  const wordSet = new Set<string>(); // 用于去重
  
  // 对于长文本，使用更智能的策略减少分词数量
  const isLongText = textLength > 50;
  const maxWordLength = isLongText ? 3 : 4; // 长文本限制词长
  const step = isLongText ? 2 : 1; // 长文本使用跳跃式窗口
  
  // 使用优化的滑动窗口提取词汇
  for (let i = 0; i < textLength; i += step) {
    // 提取2-3/4字词汇
    for (let len = minLength; len <= Math.min(maxWordLength, textLength - i); len++) {
      const word = text.substring(i, i + len);
      
      // 跳过停用词和重复词
      if (STOP_WORDS.has(word) || wordSet.has(word)) continue;
      
      // 确保词汇包含中文字符且不全是重复字符
      if (/[\u4e00-\u9fa5]/.test(word) && !isRepeatingChars(word)) {
        words.push(word);
        wordSet.add(word);
      }
    }
  }
  
  // 对于长文本，进一步筛选高质量词汇
  if (isLongText && words.length > 100) {
    return filterHighQualityWords(words, text);
  }
  
  return words;
}

/**
 * 检查是否为重复字符组成的词
 */
function isRepeatingChars(word: string): boolean {
  if (word.length <= 2) return false;
  const firstChar = word[0];
  return word.split('').every(char => char === firstChar);
}

/**
 * 筛选高质量词汇
 */
function filterHighQualityWords(words: string[], originalText: string): string[] {
  // 计算词频
  const wordFreq = new Map<string, number>();
  words.forEach(word => {
    wordFreq.set(word, (wordFreq.get(word) || 0) + 1);
  });
  
  // 优先选择：
  // 1. 长度较长的词（3-4字）
  // 2. 出现频率适中的词（不是太频繁也不是只出现一次）
  // 3. 包含常用字的词
  return Array.from(wordFreq.entries())
    .filter(([word, freq]) => {
      // 过滤掉过于频繁的词（可能是无意义的组合）
      if (freq > Math.max(3, originalText.length / 20)) return false;
      // 保留长词和适度重复的词
      return word.length >= 3 || freq >= 2;
    })
    .sort((a, b) => {
      // 按词长和频率排序
      const [wordA, freqA] = a;
      const [wordB, freqB] = b;
      if (wordA.length !== wordB.length) {
        return wordB.length - wordA.length; // 长词优先
      }
      return freqB - freqA; // 频率高的优先
    })
    .slice(0, 50) // 限制最大数量
    .map(([word]) => word);
}

/**
 * 使用 WASM Jieba 进行中文分词
 */
function wasmChineseSegment(text: string): string[] {
  if (!wasmJiebaState.isLoaded || !wasmJiebaState.jieba) {
    console.warn('⚠️ [WASM分词] WASM 模块未加载，回退到滑动窗口分词');
    return optimizedChineseSegment(text);
  }

  try {
    // 使用 WASM jieba 进行分词
    const segments = wasmJiebaState.jieba.cut(text, true);
    
    // 过滤停用词和短词
    return segments
      .filter((word: string) => 
        word.trim().length > 0 && 
        !STOP_WORDS.has(word.trim())
      )
      .map((word: string) => word.trim());
  } catch (error) {
    console.warn('⚠️ [WASM分词] 分词过程出错，回退到滑动窗口分词:', error);
    return optimizedChineseSegment(text);
  }
}

/**
 * 智能中文分词函数
 * 优先使用 WASM Jieba，失败时回退到滑动窗口分词
 */
async function smartChineseSegment(text: string, minLength: number = 2): Promise<string[]> {
  const startTime = performance.now();
  
  try {
    // 短文本（<20字）直接使用滑动窗口，避免 WASM 加载开销
    if (text.length < 20) {
      console.log('🔪 [分词] 短文本使用优化滑动窗口分词');
      const result = optimizedChineseSegment(text, minLength);
      const endTime = performance.now();
      console.log(`⏱️ [分词] 滑动窗口分词耗时: ${(endTime - startTime).toFixed(2)}ms, 词汇数量: ${result.length}`);
      return result;
    }
    
    // 长文本优先尝试使用 WASM Jieba
    try {
      // 如果 WASM 未加载，尝试加载
      if (!wasmJiebaState.isLoaded && !wasmJiebaState.isLoading) {
        await loadWasmJieba();
      }
      
      // 等待加载完成
      while (wasmJiebaState.isLoading) {
        await new Promise(resolve => setTimeout(resolve, 50));
      }
      
      console.log('🔪 [分词] 长文本尝试使用 WASM Jieba 分词');
      console.log('📝 [分词] 输入文本长度:', text.length, '字符');
      console.log('📝 [分词] 输入文本末尾:', text.slice(-50));
      
      const segments = wasmChineseSegment(text);
      console.log('📝 [分词] WASM 原始分词结果数量:', segments.length);
      console.log('📝 [分词] WASM 原始分词结果末尾:', segments.slice(-10));
      
      // 过滤结果
      const result = segments
        .filter(word => word.length >= minLength)
        .filter(word => !/^[\s\d]+$/.test(word)) // 过滤纯数字和空白
        .slice(0, 100); // 增加限制数量到100个词汇
      
      const endTime = performance.now();
      console.log(`⏱️ [分词] WASM Jieba 分词耗时: ${(endTime - startTime).toFixed(2)}ms, 词汇数量: ${result.length}`);
      return result;
    } catch (wasmError) {
      // WASM Jieba 失败，回退到滑动窗口
      console.log('🔪 [分词] WASM Jieba 不可用，回退到优化滑动窗口分词');
      const result = optimizedChineseSegment(text, minLength);
      const endTime = performance.now();
      console.log(`⏱️ [分词] 回退分词耗时: ${(endTime - startTime).toFixed(2)}ms, 词汇数量: ${result.length}`);
      return result;
    }
    
  } catch (error) {
    console.error('❌ [分词] 分词过程出错，使用备用方案:', error);
    const result = optimizedChineseSegment(text, minLength);
    const endTime = performance.now();
    console.log(`⏱️ [分词] 错误恢复分词耗时: ${(endTime - startTime).toFixed(2)}ms, 词汇数量: ${result.length}`);
    return result;
  }
}

// 关键词提取配置
interface KeywordExtractionConfig {
  minLength: number; // 最小关键词长度
  maxKeywords: number; // 最大关键词数量
  stopWords: string[]; // 停用词列表
}

// 知识检索结果
export interface KnowledgeSearchResult {
  entries: KnowledgeEntry[];
  matchedKeywords: string[];
  relevanceScore: number;
}

// 增强的聊天上下文
export interface EnhancedChatContext {
  originalMessage: string;
  extractedKeywords: string[];
  knowledgeResults: KnowledgeSearchResult[];
}

// 知识库增强配置
export interface KnowledgeEnhancementConfig {
  maxResults?: number;
  minRelevanceScore?: number;
  includeDebugInfo?: boolean;
}

export class ChatEnhancementService {
  // 关键词缓存
  private static keywordsCache = new Map<string, { keywords: string[], timestamp: number }>();
  private static readonly CACHE_EXPIRY = 5 * 60 * 1000; // 5分钟缓存过期
  
  private static readonly DEFAULT_CONFIG: KeywordExtractionConfig = {
    minLength: 2,
    maxKeywords: 10,
    stopWords: [
      // 中文停用词
      '的', '了', '在', '是', '我', '有', '和', '就', '不', '人', '都', '一', '一个', '上', '也', '很', '到', '说', '要', '去', '你', '会', '着', '没有', '看', '好', '自己', '这', '那', '里', '就是', '还是', '把', '比', '或者', '因为', '所以', '但是', '如果', '这样', '那样', '怎么', '什么', '哪里', '为什么', '怎样',
      // 英文停用词
      'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might', 'can', 'this', 'that', 'these', 'those', 'i', 'you', 'he', 'she', 'it', 'we', 'they', 'me', 'him', 'her', 'us', 'them'
    ]
  };

  /**
   * 从用户消息中提取关键词
   */
  static async extractKeywords(message: string, config: Partial<KeywordExtractionConfig> = {}): Promise<string[]> {
    console.log('🔤 [ChatEnhancement] 开始提取关键词，原始消息:', message);
    
    const finalConfig = { ...this.DEFAULT_CONFIG, ...config };
    
    // 清理文本
    const cleanMessage = message
      .replace(/[^\u4e00-\u9fa5a-zA-Z0-9\s]/g, ' ') // 保留中文、英文、数字和空格
      .replace(/\s+/g, ' ')
      .trim();
    
    console.log('🧹 [ChatEnhancement] 清理后的文本:', cleanMessage);
    
    if (!cleanMessage) {
      console.log('⚠️ [ChatEnhancement] 清理后文本为空');
      return [];
    }
    
    const words: string[] = [];
    
    // 处理英文单词（按空格分割）
    const englishWords = cleanMessage.match(/[a-zA-Z0-9]+/g) || [];
    console.log('🔤 [ChatEnhancement] 英文匹配结果:', englishWords);
    words.push(...englishWords.map(word => word.toLowerCase()));
    
    // 处理中文（使用智能分词）
    const chineseText = cleanMessage.replace(/[a-zA-Z0-9\s]/g, '');
    console.log('🈳 [ChatEnhancement] 中文文本:', chineseText);
    
    if (chineseText) {
      console.log('🔪 [ChatEnhancement] 使用智能中文分词');
      
      try {
        // 使用异步智能中文分词
        const chineseWords = await smartChineseSegment(chineseText, finalConfig.minLength);
        console.log('🔪 [ChatEnhancement] 中文分词结果:', chineseWords);
        
        // 过滤掉过短的词汇
        const validChineseWords = chineseWords.filter(word => 
          word.trim().length >= finalConfig.minLength
        );
        
        console.log('📝 [ChatEnhancement] 有效中文词汇:', validChineseWords);
        words.push(...validChineseWords);
      } catch (error) {
        console.error('❌ [ChatEnhancement] 中文分词失败:', error);
        // 分词失败时，至少保留英文词汇
      }
    }
    
    console.log('📋 [ChatEnhancement] 分词结果:', words);
    
    // 过滤和去重
    const filteredWords = words
      .filter(word => {
        const shouldKeep = word.length >= finalConfig.minLength &&
          !finalConfig.stopWords.includes(word.toLowerCase());
        if (!shouldKeep) {
          console.log('🚫 [ChatEnhancement] 过滤词:', word);
        }
        return shouldKeep;
      })
      .filter((word, index, arr) => arr.indexOf(word) === index); // 去重
    
    console.log('🔍 [ChatEnhancement] 过滤后结果:', filteredWords);
    
    // 按长度和出现频率排序，返回前N个关键词
    const wordFreq = new Map<string, number>();
    filteredWords.forEach(word => {
      wordFreq.set(word, (wordFreq.get(word) || 0) + 1);
    });
    
    const finalKeywords = Array.from(wordFreq.entries())
      .sort((a, b) => {
        // 优先按频率排序，然后按长度排序
        if (a[1] !== b[1]) return b[1] - a[1];
        return b[0].length - a[0].length;
      })
      .slice(0, finalConfig.maxKeywords)
      .map(([word]) => word);
    
    console.log('✅ [ChatEnhancement] 最终关键词:', finalKeywords);
    
    return finalKeywords;
  }

  /**
   * 获取知识库所有关键词（带缓存）
   */
  static async getKnowledgeBaseKeywords(knowledgeBaseId: string): Promise<string[]> {
    console.log('🔑 [关键词缓存] 获取知识库关键词:', knowledgeBaseId);
    
    // 检查缓存
    const cached = this.keywordsCache.get(knowledgeBaseId);
    const now = Date.now();
    
    if (cached && (now - cached.timestamp) < this.CACHE_EXPIRY) {
      console.log('✅ [关键词缓存] 使用缓存数据:', cached.keywords.length, '个关键词');
      return cached.keywords;
    }
    
    try {
      // 获取知识库所有条目
      const allEntries = await KnowledgeService.getKnowledgeEntries(knowledgeBaseId);
      
      // 提取所有关键词和条目名称
      const allKeywords = new Set<string>();
      
      allEntries.forEach(entry => {
        // 添加条目名称
        if (entry.name.trim()) {
          allKeywords.add(entry.name.trim());
        }
        
        // 添加条目关键词
        entry.keywords.forEach(keyword => {
          if (keyword.trim()) {
            allKeywords.add(keyword.trim());
          }
        });
      });
      
      // 转换为数组并按长度排序（长关键词优先）
      const keywordsArray = Array.from(allKeywords)
        .filter(keyword => keyword.length >= 2) // 过滤过短的关键词
        .sort((a, b) => b.length - a.length);
      
      // 更新缓存
      this.keywordsCache.set(knowledgeBaseId, {
        keywords: keywordsArray,
        timestamp: now
      });
      
      console.log('🔄 [关键词缓存] 更新缓存:', keywordsArray.length, '个关键词');
      return keywordsArray;
      
    } catch (error) {
      console.error('❌ [关键词缓存] 获取失败:', error);
      return [];
    }
  }

  /**
   * 反向搜索：用知识库关键词匹配用户输入
   */
  static async reverseSearchKnowledgeBase(
    knowledgeBaseId: string,
    userInput: string
  ): Promise<KnowledgeSearchResult> {
    console.log('🔄 [反向搜索] 开始反向搜索:', { knowledgeBaseId, userInput });
    
    if (!userInput.trim()) {
      return {
        entries: [],
        matchedKeywords: [],
        relevanceScore: 0
      };
    }
    
    try {
      // 获取知识库所有关键词
      const knowledgeKeywords = await this.getKnowledgeBaseKeywords(knowledgeBaseId);
      
      if (knowledgeKeywords.length === 0) {
        console.log('⚠️ [反向搜索] 知识库无关键词');
        return {
          entries: [],
          matchedKeywords: [],
          relevanceScore: 0
        };
      }
      
      // 查找匹配的关键词
      const matchedKeywords: string[] = [];
      const userInputLower = userInput.toLowerCase();
      
      knowledgeKeywords.forEach(keyword => {
        const keywordLower = keyword.toLowerCase();
        
        // 完全匹配或包含匹配
        if (userInputLower.includes(keywordLower) || keywordLower.includes(userInputLower)) {
          matchedKeywords.push(keyword);
        }
      });
      
      console.log('🎯 [反向搜索] 匹配的关键词:', matchedKeywords);
      
      if (matchedKeywords.length === 0) {
        return {
          entries: [],
          matchedKeywords: [],
          relevanceScore: 0
        };
      }
      
      // 使用匹配的关键词搜索知识条目
      const entries = await KnowledgeService.searchKnowledgeEntries(knowledgeBaseId, matchedKeywords);
      
      // 计算相关性分数
      const relevanceScore = matchedKeywords.length / Math.max(knowledgeKeywords.length * 0.1, 1);
      
      console.log('✅ [反向搜索] 搜索完成:', {
        matchedKeywords: matchedKeywords.length,
        entries: entries.length,
        relevanceScore
      });
      
      return {
        entries,
        matchedKeywords,
        relevanceScore: Math.min(relevanceScore, 1)
      };
      
    } catch (error) {
      console.error('❌ [反向搜索] 搜索失败:', error);
      return {
        entries: [],
        matchedKeywords: [],
        relevanceScore: 0
      };
    }
  }

  /**
   * 混合搜索策略：结合传统搜索和反向搜索
   */
  static async hybridSearchKnowledgeBase(
    knowledgeBaseId: string,
    userInput: string,
    extractedKeywords: string[]
  ): Promise<KnowledgeSearchResult> {
    console.log('🔀 [混合搜索] 开始混合搜索:', {
      knowledgeBaseId,
      userInput: userInput.substring(0, 50) + '...',
      extractedKeywords
    });
    
    try {
      // 并行执行传统搜索和反向搜索
      const [traditionalResult, reverseResult] = await Promise.all([
        this.searchKnowledgeBase(knowledgeBaseId, extractedKeywords),
        this.reverseSearchKnowledgeBase(knowledgeBaseId, userInput)
      ]);
      
      console.log('📊 [混合搜索] 搜索结果:', {
        traditional: {
          entries: traditionalResult.entries.length,
          keywords: traditionalResult.matchedKeywords.length,
          score: traditionalResult.relevanceScore
        },
        reverse: {
          entries: reverseResult.entries.length,
          keywords: reverseResult.matchedKeywords.length,
          score: reverseResult.relevanceScore
        }
      });
      
      // 合并结果
      const allEntries = [...traditionalResult.entries, ...reverseResult.entries];
      const allMatchedKeywords = [...traditionalResult.matchedKeywords, ...reverseResult.matchedKeywords];
      
      // 去重条目（基于ID）
      const uniqueEntries = allEntries.filter((entry, index, arr) => 
        arr.findIndex(e => e.id === entry.id) === index
      );
      
      // 去重关键词
      const uniqueMatchedKeywords = Array.from(new Set(allMatchedKeywords));
      
      // 计算综合相关性分数（取两种方法的最大值）
      const combinedRelevanceScore = Math.max(
        traditionalResult.relevanceScore,
        reverseResult.relevanceScore
      );
      
      // 按相关性排序条目（优先显示在两种搜索中都出现的条目）
      const sortedEntries = uniqueEntries.sort((a, b) => {
        const aInBoth = traditionalResult.entries.some(e => e.id === a.id) && 
                       reverseResult.entries.some(e => e.id === a.id);
        const bInBoth = traditionalResult.entries.some(e => e.id === b.id) && 
                       reverseResult.entries.some(e => e.id === b.id);
        
        if (aInBoth && !bInBoth) return -1;
        if (!aInBoth && bInBoth) return 1;
        
        // 如果都在两种搜索中出现或都只在一种中出现，按名称排序
        return a.name.localeCompare(b.name);
      });
      
      const result = {
        entries: sortedEntries,
        matchedKeywords: uniqueMatchedKeywords,
        relevanceScore: combinedRelevanceScore
      };
      
      console.log('✅ [混合搜索] 搜索完成:', {
        totalEntries: result.entries.length,
        totalKeywords: result.matchedKeywords.length,
        finalScore: result.relevanceScore
      });
      
      return result;
      
    } catch (error) {
      console.error('❌ [混合搜索] 搜索失败:', error);
      
      // 降级到传统搜索
      console.log('🔄 [混合搜索] 降级到传统搜索');
      return await this.searchKnowledgeBase(knowledgeBaseId, extractedKeywords);
    }
  }

  /**
   * 在知识库中搜索相关条目（传统方法）
   */
  static async searchKnowledgeBase(
    knowledgeBaseId: string,
    keywords: string[]
  ): Promise<KnowledgeSearchResult> {
    if (!keywords.length) {
      return {
        entries: [],
        matchedKeywords: [],
        relevanceScore: 0
      };
    }

    try {
      const entries = await KnowledgeService.searchKnowledgeEntries(knowledgeBaseId, keywords);
      
      // 计算匹配的关键词和相关性分数
      const matchedKeywords: string[] = [];
      let totalMatches = 0;
      
      entries.forEach(entry => {
        entry.keywords.forEach(entryKeyword => {
          keywords.forEach(searchKeyword => {
            if (entryKeyword.toLowerCase().includes(searchKeyword.toLowerCase()) ||
                searchKeyword.toLowerCase().includes(entryKeyword.toLowerCase())) {
              if (!matchedKeywords.includes(entryKeyword)) {
                matchedKeywords.push(entryKeyword);
              }
              totalMatches++;
            }
          });
        });
      });
      
      // 计算相关性分数（0-1之间）
      const relevanceScore = entries.length > 0 ? 
        Math.min(totalMatches / (keywords.length * entries.length), 1) : 0;
      
      return {
        entries,
        matchedKeywords,
        relevanceScore
      };
    } catch (error) {
      console.error('知识库搜索失败:', error);
      return {
        entries: [],
        matchedKeywords: [],
        relevanceScore: 0
      };
    }
  }

  /**
   * 增强聊天上下文
   */
  static async enhanceChatContext(
    userMessage: string,
    knowledgeBaseId: string,
    config: KnowledgeEnhancementConfig = {}
  ): Promise<EnhancedChatContext> {
    console.log('📚 [知识库增强] 开始处理用户消息:', {
      messageLength: userMessage.length,
      knowledgeBaseId,
      config
    });
    
    // 提取关键词
    const extractedKeywords = await this.extractKeywords(userMessage);
    console.log('🔍 [知识库增强] 提取的关键词:', extractedKeywords);
    
    let knowledgeResults: KnowledgeSearchResult[] = [];
    
    // 如果有知识库，进行混合搜索（即使没有提取到关键词也尝试反向搜索）
    if (knowledgeBaseId) {
      try {
        const searchResult = await this.hybridSearchKnowledgeBase(knowledgeBaseId, userMessage, extractedKeywords);
        
        // 根据配置过滤结果
        if (config.minRelevanceScore && searchResult.relevanceScore < config.minRelevanceScore) {
          console.log('⚠️ [知识库增强] 相关性分数过低，跳过结果:', searchResult.relevanceScore);
        } else {
          // 限制结果数量
          if (config.maxResults && searchResult.entries.length > config.maxResults) {
            searchResult.entries = searchResult.entries.slice(0, config.maxResults);
          }
          knowledgeResults = [searchResult];
          
          console.log('✅ [知识库增强] 搜索成功:', {
            entriesFound: searchResult.entries.length,
            matchedKeywords: searchResult.matchedKeywords,
            relevanceScore: searchResult.relevanceScore
          });
        }
      } catch (error) {
        console.error('❌ [知识库增强] 搜索失败:', error);
      }
    } else {
        console.log('ℹ️ [知识库增强] 跳过搜索: 没有知识库ID');
      }
    
    const result = {
      originalMessage: userMessage,
      extractedKeywords,
      knowledgeResults
    };
    
    if (config.includeDebugInfo) {
      console.log('🔍 [知识库增强] 调试信息:', this.getDebugInfo(result));
    }
    
    return result;
  }

  /**
   * 构建知识上下文
   */
  private static buildKnowledgeContext(entries: KnowledgeEntry[]): string {
    if (entries.length === 0) return '';
    
    const knowledgeItems = entries.map(entry => {
      const keywords = entry.keywords.join('、');
      return `【${entry.name}】\n关键词：${keywords}\n解释：${entry.explanation}`;
    }).join('\n\n');
    
    return `\n\n[相关知识库信息]\n${knowledgeItems}\n[/相关知识库信息]`;
  }

  /**
   * 将知识上下文注入系统提示词
   */
  static injectKnowledgeContext(systemPrompt: string, enhancedContext: EnhancedChatContext): string {
    if (!enhancedContext.knowledgeResults.length) {
      console.log('ℹ️ [知识库增强] 没有知识库结果，返回原始提示词');
      return systemPrompt;
    }
    
    // 收集所有知识条目
    const allEntries = enhancedContext.knowledgeResults.flatMap(result => result.entries);
    
    if (!allEntries.length) {
      console.log('ℹ️ [知识库增强] 没有找到知识条目，返回原始提示词');
      return systemPrompt;
    }
    
    // 构建知识上下文
    const knowledgeContext = this.buildKnowledgeContext(allEntries);
    
    // 在系统提示词末尾添加知识上下文
    const enhancedPrompt = systemPrompt + knowledgeContext + 
      '\n\n请根据上述相关知识库信息来回答用户的问题。如果知识库中的信息与用户问题相关，请优先使用这些信息。如果知识库信息不够充分，可以结合你的通用知识来补充回答。';
    
    console.log('✨ [知识库增强] 成功注入知识上下文:', {
      originalPromptLength: systemPrompt.length,
      enhancedPromptLength: enhancedPrompt.length,
      knowledgeEntriesCount: allEntries.length
    });
    
    return enhancedPrompt;
  }

  /**
   * 清理过期的关键词缓存
   */
  static clearExpiredCache(): void {
    const now = Date.now();
    const expiredKeys: string[] = [];
    
    this.keywordsCache.forEach((value, key) => {
      if (now - value.timestamp >= this.CACHE_EXPIRY) {
        expiredKeys.push(key);
      }
    });
    
    expiredKeys.forEach(key => {
      this.keywordsCache.delete(key);
    });
    
    if (expiredKeys.length > 0) {
      console.log('🧹 [缓存清理] 清理过期缓存:', expiredKeys.length, '个条目');
    }
  }

  /**
   * 手动清空所有缓存
   */
  static clearAllCache(): void {
    this.keywordsCache.clear();
    console.log('🧹 [缓存清理] 清空所有缓存');
  }

  /**
   * 获取缓存统计信息
   */
  static getCacheStats(): { size: number; entries: Array<{ knowledgeBaseId: string; keywordCount: number; age: number }> } {
    const now = Date.now();
    const entries = Array.from(this.keywordsCache.entries()).map(([knowledgeBaseId, data]) => ({
      knowledgeBaseId,
      keywordCount: data.keywords.length,
      age: now - data.timestamp
    }));
    
    return {
      size: this.keywordsCache.size,
      entries
    };
  }

  /**
   * 获取调试信息
   */
  static getDebugInfo(context: EnhancedChatContext): string {
    const debugInfo = {
      extractedKeywords: context.extractedKeywords,
      knowledgeResultsCount: context.knowledgeResults.length,
      totalEntriesFound: context.knowledgeResults.reduce((sum, result) => sum + result.entries.length, 0),
      matchedKeywords: context.knowledgeResults.flatMap(result => result.matchedKeywords),
      averageRelevanceScore: context.knowledgeResults.length > 0 ? 
        context.knowledgeResults.reduce((sum, result) => sum + result.relevanceScore, 0) / context.knowledgeResults.length : 0
    };
    
    return JSON.stringify(debugInfo, null, 2);
  }

  /**
   * 获取 WASM Jieba 状态信息
   */
  static getWasmJiebaStatus(): {
    isLoaded: boolean;
    isLoading: boolean;
    error: string | null;
    hasJieba: boolean;
  } {
    return {
      isLoaded: wasmJiebaState.isLoaded,
      isLoading: wasmJiebaState.isLoading,
      error: wasmJiebaState.error,
      hasJieba: wasmJiebaState.jieba !== null
    };
  }

  /**
   * 手动重新加载 WASM Jieba
   */
  static async reloadWasmJieba(): Promise<boolean> {
    // 重置状态
    wasmJiebaState.isLoaded = false;
    wasmJiebaState.isLoading = false;
    wasmJiebaState.jieba = null;
    wasmJiebaState.error = null;
    
    console.log('🔄 [WASM分词] 手动重新加载 WASM Jieba');
    await loadWasmJieba();
    return wasmJiebaState.isLoaded;
  }
}

// 导出测试函数到全局作用域（仅在开发环境）
if (typeof window !== 'undefined' && import.meta.env.DEV) {
  // @ts-ignore
  window.testWasmSegment = async (text: string) => {
    console.log('🧪 [测试] 开始测试 WASM 分词:', text);
    const result = await wasmChineseSegment(text);
    console.log('🧪 [测试] 分词结果:', result);
    return result;
  };
  
  // @ts-ignore
  window.testOptimizedSegment = (text: string) => {
    console.log('🧪 [测试] 开始测试优化分词:', text);
    const result = optimizedChineseSegment(text);
    console.log('🧪 [测试] 分词结果:', result);
    return result;
  };
  
  // @ts-ignore
  window.getWasmStatus = () => {
    const status = ChatEnhancementService.getWasmJiebaStatus();
    console.log('🧪 [测试] WASM 状态:', status);
    return status;
  };
  
  // @ts-ignore
  window.reloadWasm = () => {
    return ChatEnhancementService.reloadWasmJieba();
  };
  
  console.log('🧪 [测试] 分词测试函数已导出到全局作用域:');
  console.log('  - window.testWasmSegment(text) - 测试 WASM 分词');
  console.log('  - window.testOptimizedSegment(text) - 测试优化分词');
  console.log('  - window.getWasmStatus() - 获取 WASM 状态');
  console.log('  - window.reloadWasm() - 重新加载 WASM');
}