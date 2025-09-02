// 聊天增强服务 - 处理知识库检索和上下文注入

import { KnowledgeService } from './knowledgeService';
import type { KnowledgeEntry, KnowledgeBase } from '../types/knowledge';
import Segment from 'segment';

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
  static extractKeywords(message: string, config: Partial<KeywordExtractionConfig> = {}): string[] {
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
    
    // 处理中文（使用jieba分词）
    const chineseText = cleanMessage.replace(/[a-zA-Z0-9\s]/g, '');
    console.log('🈳 [ChatEnhancement] 中文文本:', chineseText);
    
    if (chineseText) {
      try {
        // 初始化segment分词器
        const segment = new Segment();
        segment.useDefault(); // 使用默认的识别模块和字典
        
        // 使用segment进行中文分词
        const chineseWords = segment.doSegment(chineseText, {
          simple: true // 返回简单的字符串数组
        });
        console.log('🔪 [ChatEnhancement] segment分词结果:', chineseWords);
        
        // 过滤掉单字和空字符串
        const validChineseWords = chineseWords.filter((word: string) => 
          word.trim().length >= finalConfig.minLength && 
          /[\u4e00-\u9fa5]/.test(word) // 确保包含中文字符
        );
        
        console.log('📝 [ChatEnhancement] 有效中文词汇:', validChineseWords);
        words.push(...validChineseWords);
      } catch (error) {
        console.error('❌ [ChatEnhancement] segment分词失败，回退到滑动窗口:', error);
        
        // 回退到原来的滑动窗口方法
        for (let i = 0; i < chineseText.length; i++) {
          // 提取2字词
          if (i + 1 < chineseText.length) {
            const word2 = chineseText.substring(i, i + 2);
            words.push(word2);
          }
          // 提取3字词
          if (i + 2 < chineseText.length) {
            const word3 = chineseText.substring(i, i + 3);
            words.push(word3);
          }
          // 提取4字词
          if (i + 3 < chineseText.length) {
            const word4 = chineseText.substring(i, i + 4);
            words.push(word4);
          }
        }
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
   * 在知识库中搜索相关条目
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
    const extractedKeywords = this.extractKeywords(userMessage);
    console.log('🔍 [知识库增强] 提取的关键词:', extractedKeywords);
    
    let knowledgeResults: KnowledgeSearchResult[] = [];
    
    // 如果有知识库且提取到关键词，进行搜索
    if (knowledgeBaseId && extractedKeywords.length > 0) {
      try {
        const searchResult = await this.searchKnowledgeBase(knowledgeBaseId, extractedKeywords);
        
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
      console.log('ℹ️ [知识库增强] 跳过搜索:', {
        hasKnowledgeBase: !!knowledgeBaseId,
        hasKeywords: extractedKeywords.length > 0
      });
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
}