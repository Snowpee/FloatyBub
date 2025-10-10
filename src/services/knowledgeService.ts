// 知识库服务 - 处理所有知识库相关的API调用

import { supabase } from '../lib/supabase';
import type {
  KnowledgeBase,
  KnowledgeEntry,
  CreateKnowledgeBaseRequest,
  UpdateKnowledgeBaseRequest,
  CreateKnowledgeEntryRequest,
  UpdateKnowledgeEntryRequest,
  KnowledgeBaseStats,
  ImportKnowledgeEntriesRequest
} from '../types/knowledge';

// 本地存储键名
const LOCAL_STORAGE_KEYS = {
  KNOWLEDGE_BASES: 'knowledge_bases',
  KNOWLEDGE_ENTRIES: 'knowledge_entries'
};

// 生成唯一ID
function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

// 本地存储工具函数
class LocalStorageManager {
  static getKnowledgeBases(): KnowledgeBase[] {
    try {
      const data = localStorage.getItem(LOCAL_STORAGE_KEYS.KNOWLEDGE_BASES);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  }

  static saveKnowledgeBases(bases: KnowledgeBase[]): void {
    localStorage.setItem(LOCAL_STORAGE_KEYS.KNOWLEDGE_BASES, JSON.stringify(bases));
  }

  static getKnowledgeEntries(): KnowledgeEntry[] {
    try {
      const data = localStorage.getItem(LOCAL_STORAGE_KEYS.KNOWLEDGE_ENTRIES);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  }

  static saveKnowledgeEntries(entries: KnowledgeEntry[]): void {
    localStorage.setItem(LOCAL_STORAGE_KEYS.KNOWLEDGE_ENTRIES, JSON.stringify(entries));
  }

  static getRoleKnowledgeMap(): Record<string, string> {
    try {
      const data = localStorage.getItem('role_knowledge_map');
      return data ? JSON.parse(data) : {};
    } catch {
      return {};
    }
  }

  static saveRoleKnowledgeMap(map: Record<string, string>): void {
    localStorage.setItem('role_knowledge_map', JSON.stringify(map));
  }
}

// 检查用户是否已登录
async function isUserLoggedIn(): Promise<{ isLoggedIn: boolean; userId?: string }> {
  try {
    const { data: { user }, error } = await supabase.auth.getUser();
    return { isLoggedIn: !error && !!user, userId: user?.id };
  } catch {
    return { isLoggedIn: false };
  }
}

export class KnowledgeService {
  // 获取用户的所有知识库
  static async getKnowledgeBases(): Promise<KnowledgeBase[]> {
    const { isLoggedIn } = await isUserLoggedIn();
    
    if (isLoggedIn) {
      // 用户已登录，从Supabase获取
      const { data, error } = await supabase
        .from('knowledge_bases')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        throw new Error(`获取知识库失败: ${error.message}`);
      }

      return data || [];
    } else {
      // 用户未登录，从本地存储获取
      return LocalStorageManager.getKnowledgeBases();
    }
  }

  // 获取知识库统计信息
  static async getKnowledgeBaseStats(): Promise<KnowledgeBaseStats[]> {
    const { data, error } = await supabase
      .from('knowledge_bases')
      .select(`
        id,
        name,
        updated_at,
        knowledge_entries(count)
      `);

    if (error) {
      throw new Error(`获取知识库统计失败: ${error.message}`);
    }

    return (data || []).map(kb => ({
      id: kb.id,
      name: kb.name,
      entryCount: kb.knowledge_entries?.[0]?.count || 0,
      lastUpdated: kb.updated_at
    }));
  }

  // 创建知识库
  static async createKnowledgeBase(request: CreateKnowledgeBaseRequest): Promise<KnowledgeBase> {
    const { isLoggedIn, userId } = await isUserLoggedIn();
    
    if (isLoggedIn && userId) {
      // 用户已登录，使用Supabase存储
      const { data, error } = await supabase
        .from('knowledge_bases')
        .insert({
          name: request.name,
          description: request.description,
          user_id: userId
        })
        .select()
        .single();

      if (error) {
        throw new Error(`创建知识库失败: ${error.message}`);
      }

      return data;
    } else {
      // 用户未登录，使用本地存储
      const newKnowledgeBase: KnowledgeBase = {
        id: generateId(),
        name: request.name,
        description: request.description || '',
        user_id: 'local_user',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      const existingBases = LocalStorageManager.getKnowledgeBases();
      existingBases.unshift(newKnowledgeBase);
      LocalStorageManager.saveKnowledgeBases(existingBases);

      return newKnowledgeBase;
    }
  }

  // 更新知识库
  static async updateKnowledgeBase(id: string, request: UpdateKnowledgeBaseRequest): Promise<KnowledgeBase> {
    const { isLoggedIn } = await isUserLoggedIn();
    
    if (isLoggedIn) {
      // 用户已登录，使用Supabase更新
      const updateData: any = {
        updated_at: new Date().toISOString()
      };

      if (request.name !== undefined) updateData.name = request.name;
      if (request.description !== undefined) updateData.description = request.description;

      const { data, error } = await supabase
        .from('knowledge_bases')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();

      if (error) {
        throw new Error(`更新知识库失败: ${error.message}`);
      }

      return data;
    } else {
      // 用户未登录，使用本地存储更新
      const existingBases = LocalStorageManager.getKnowledgeBases();
      const baseIndex = existingBases.findIndex(base => base.id === id);
      
      if (baseIndex === -1) {
        throw new Error('知识库不存在');
      }

      const updatedBase = {
        ...existingBases[baseIndex],
        updated_at: new Date().toISOString()
      };

      if (request.name !== undefined) updatedBase.name = request.name;
      if (request.description !== undefined) updatedBase.description = request.description;

      existingBases[baseIndex] = updatedBase;
      LocalStorageManager.saveKnowledgeBases(existingBases);

      return updatedBase;
    }
  }

  // 删除知识库
  static async deleteKnowledgeBase(id: string): Promise<void> {
    const { isLoggedIn } = await isUserLoggedIn();
    
    if (isLoggedIn) {
      // 用户已登录，使用Supabase删除
      const { error } = await supabase
        .from('knowledge_bases')
        .delete()
        .eq('id', id);

      if (error) {
        throw new Error(`删除知识库失败: ${error.message}`);
      }
    } else {
      // 用户未登录，使用本地存储删除
      const existingBases = LocalStorageManager.getKnowledgeBases();
      const filteredBases = existingBases.filter(base => base.id !== id);
      LocalStorageManager.saveKnowledgeBases(filteredBases);
      
      // 同时删除相关的知识条目
      const existingEntries = LocalStorageManager.getKnowledgeEntries();
      const filteredEntries = existingEntries.filter(entry => entry.knowledge_base_id !== id);
      LocalStorageManager.saveKnowledgeEntries(filteredEntries);
    }
  }

  // 获取知识库的所有条目
  static async getKnowledgeEntries(knowledgeBaseId: string): Promise<KnowledgeEntry[]> {
    const { isLoggedIn } = await isUserLoggedIn();
    
    if (isLoggedIn) {
      // 用户已登录，从Supabase获取
      const { data, error } = await supabase
        .from('knowledge_entries')
        .select('*')
        .eq('knowledge_base_id', knowledgeBaseId)
        .order('created_at', { ascending: false });

      if (error) {
        throw new Error(`获取知识条目失败: ${error.message}`);
      }

      return data || [];
    } else {
      // 用户未登录，从本地存储获取
      const allEntries = LocalStorageManager.getKnowledgeEntries();
      return allEntries.filter(entry => entry.knowledge_base_id === knowledgeBaseId)
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    }
  }

  // 创建知识条目
  static async createKnowledgeEntry(request: CreateKnowledgeEntryRequest): Promise<KnowledgeEntry> {
    const { isLoggedIn } = await isUserLoggedIn();
    
    if (isLoggedIn) {
      // 用户已登录，使用Supabase存储
      const { data, error } = await supabase
        .from('knowledge_entries')
        .insert({
          name: request.name,
          keywords: request.keywords,
          explanation: request.explanation,
          knowledge_base_id: request.knowledge_base_id
        })
        .select()
        .single();

      if (error) {
        throw new Error(`创建知识条目失败: ${error.message}`);
      }

      return data;
    } else {
      // 用户未登录，使用本地存储
      const newEntry: KnowledgeEntry = {
        id: generateId(),
        name: request.name,
        keywords: request.keywords,
        explanation: request.explanation,
        knowledge_base_id: request.knowledge_base_id,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      const existingEntries = LocalStorageManager.getKnowledgeEntries();
      existingEntries.unshift(newEntry);
      LocalStorageManager.saveKnowledgeEntries(existingEntries);

      return newEntry;
    }
  }

  // 更新知识条目
  static async updateKnowledgeEntry(id: string, request: UpdateKnowledgeEntryRequest): Promise<KnowledgeEntry> {
    const { isLoggedIn } = await isUserLoggedIn();
    
    if (isLoggedIn) {
      // 用户已登录，使用Supabase更新
      const updateData: any = {
        updated_at: new Date().toISOString()
      };

      if (request.name !== undefined) updateData.name = request.name;
      if (request.keywords !== undefined) updateData.keywords = request.keywords;
      if (request.explanation !== undefined) updateData.explanation = request.explanation;

      const { data, error } = await supabase
        .from('knowledge_entries')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();

      if (error) {
        throw new Error(`更新知识条目失败: ${error.message}`);
      }

      return data;
    } else {
      // 用户未登录，使用本地存储更新
      const existingEntries = LocalStorageManager.getKnowledgeEntries();
      const entryIndex = existingEntries.findIndex(entry => entry.id === id);
      
      if (entryIndex === -1) {
        throw new Error('知识条目不存在');
      }

      const updatedEntry = {
        ...existingEntries[entryIndex],
        updated_at: new Date().toISOString()
      };

      if (request.name !== undefined) updatedEntry.name = request.name;
      if (request.keywords !== undefined) updatedEntry.keywords = request.keywords;
      if (request.explanation !== undefined) updatedEntry.explanation = request.explanation;

      existingEntries[entryIndex] = updatedEntry;
      LocalStorageManager.saveKnowledgeEntries(existingEntries);

      return updatedEntry;
    }
  }

  // 删除知识条目
  static async deleteKnowledgeEntry(id: string): Promise<void> {
    const { isLoggedIn } = await isUserLoggedIn();
    
    if (isLoggedIn) {
      // 用户已登录，从Supabase删除
      const { error } = await supabase
        .from('knowledge_entries')
        .delete()
        .eq('id', id);

      if (error) {
        throw new Error(`删除知识条目失败: ${error.message}`);
      }
    } else {
      // 用户未登录，从本地存储删除
      const existingEntries = LocalStorageManager.getKnowledgeEntries();
      const filteredEntries = existingEntries.filter(entry => entry.id !== id);
      LocalStorageManager.saveKnowledgeEntries(filteredEntries);
    }
  }

  // 批量导入知识条目
  static async importKnowledgeEntries(request: ImportKnowledgeEntriesRequest): Promise<KnowledgeEntry[]> {
    const { isLoggedIn } = await isUserLoggedIn();
    
    if (isLoggedIn) {
      // 用户已登录，使用Supabase批量导入
      const entries = request.entries.map(entry => ({
        ...entry,
        knowledge_base_id: request.knowledge_base_id
      }));

      const { data, error } = await supabase
        .from('knowledge_entries')
        .insert(entries)
        .select();

      if (error) {
        throw new Error(`批量导入知识条目失败: ${error.message}`);
      }

      return data || [];
    } else {
      // 用户未登录，使用本地存储批量导入
      const newEntries: KnowledgeEntry[] = request.entries.map(entry => ({
        id: generateId(),
        name: entry.name,
        keywords: entry.keywords,
        explanation: entry.explanation,
        knowledge_base_id: request.knowledge_base_id,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }));

      const existingEntries = LocalStorageManager.getKnowledgeEntries();
      const updatedEntries = [...newEntries, ...existingEntries];
      LocalStorageManager.saveKnowledgeEntries(updatedEntries);

      return newEntries;
    }
  }

  // 搜索知识条目（基于关键词）
  static async searchKnowledgeEntries(knowledgeBaseId: string, keywords: string[]): Promise<KnowledgeEntry[]> {
    console.log('🔍 [KnowledgeService] 开始搜索知识条目:', { knowledgeBaseId, keywords });
    
    if (!keywords.length) {
      console.log('⚠️ [KnowledgeService] 没有提供搜索关键词');
      return [];
    }

    const { isLoggedIn } = await isUserLoggedIn();
    
    if (isLoggedIn) {
      console.log('🔐 [KnowledgeService] 用户已登录，使用Supabase搜索');
      
      try {
        // 首先获取该知识库的所有条目
        const { data: allEntries, error: fetchError } = await supabase
          .from('knowledge_entries')
          .select('*')
          .eq('knowledge_base_id', knowledgeBaseId)
          .order('created_at', { ascending: false });

        if (fetchError) {
          console.error('❌ [KnowledgeService] 获取知识条目失败:', fetchError);
          throw new Error(`获取知识条目失败: ${fetchError.message}`);
        }

        console.log('📚 [KnowledgeService] 获取到的所有条目:', allEntries?.length || 0);
        
        if (!allEntries || allEntries.length === 0) {
          console.log('ℹ️ [KnowledgeService] 知识库中没有条目');
          return [];
        }

        // 在客户端进行关键词匹配
        const matchedEntries = allEntries.filter(entry => {
          const matches = keywords.some(keyword => {
            const lowerKeyword = keyword.toLowerCase();
            const nameMatch = entry.name.toLowerCase().includes(lowerKeyword);
            const keywordMatch = entry.keywords.some(k => k.toLowerCase().includes(lowerKeyword));
            const explanationMatch = entry.explanation.toLowerCase().includes(lowerKeyword);
            
            return nameMatch || keywordMatch || explanationMatch;
          });
          
          if (matches) {
            console.log('✅ [KnowledgeService] 匹配条目:', entry.name);
          }
          
          return matches;
        });

        console.log('🎯 [KnowledgeService] 搜索完成，匹配条目数:', matchedEntries.length);
        return matchedEntries;
        
      } catch (error) {
        console.error('❌ [KnowledgeService] Supabase搜索失败:', error);
        throw error;
      }
    } else {
      console.log('💾 [KnowledgeService] 用户未登录，使用本地存储搜索');
      
      // 用户未登录，使用本地存储搜索
      const allEntries = LocalStorageManager.getKnowledgeEntries();
      const baseEntries = allEntries.filter(entry => entry.knowledge_base_id === knowledgeBaseId);
      
      console.log('📚 [KnowledgeService] 本地存储中的条目数:', baseEntries.length);
      
      const matchedEntries = baseEntries.filter(entry => {
        const matches = keywords.some(keyword => {
          const lowerKeyword = keyword.toLowerCase();
          const nameMatch = entry.name.toLowerCase().includes(lowerKeyword);
          const keywordMatch = entry.keywords.some(k => k.toLowerCase().includes(lowerKeyword));
          const explanationMatch = entry.explanation.toLowerCase().includes(lowerKeyword);
          
          return nameMatch || keywordMatch || explanationMatch;
        });
        
        if (matches) {
          console.log('✅ [KnowledgeService] 本地匹配条目:', entry.name);
        }
        
        return matches;
      });

      console.log('🎯 [KnowledgeService] 本地搜索完成，匹配条目数:', matchedEntries.length);
      return matchedEntries.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    }
  }

  // 为角色卡设置知识库
  static async setRoleKnowledgeBase(roleId: string, knowledgeBaseId: string | null): Promise<void> {
    console.log('🔗 [KnowledgeService] 设置角色知识库关联:', { roleId, knowledgeBaseId });
    
    const { isLoggedIn } = await isUserLoggedIn();
    
    if (isLoggedIn) {
      // 用户已登录，使用Supabase更新
      // 添加重试机制，因为新创建的角色可能还没有同步到数据库
      let retryCount = 0;
      const maxRetries = 3;
      const retryDelay = 1000; // 1秒
      
      while (retryCount < maxRetries) {
        try {
          console.log(`🔄 [KnowledgeService] 尝试更新角色知识库关联 (第${retryCount + 1}次):`, { roleId, knowledgeBaseId });
          
          // 首先检查角色是否存在
          const { data: roleExists, error: checkError } = await supabase
            .from('ai_roles')
            .select('id')
            .eq('id', roleId)
            .single();
          
          if (checkError && checkError.code === 'PGRST116') {
            // 角色不存在，等待一段时间后重试
            console.log(`⏳ [KnowledgeService] 角色尚未同步到数据库，等待重试...`);
            if (retryCount < maxRetries - 1) {
              await new Promise(resolve => setTimeout(resolve, retryDelay));
              retryCount++;
              continue;
            } else {
              throw new Error(`角色 ${roleId} 在数据库中不存在，可能同步失败`);
            }
          }
          
          if (checkError) {
            throw new Error(`检查角色存在性失败: ${checkError.message}`);
          }
          
          // 角色存在，执行更新
          const { error: updateError } = await supabase
            .from('ai_roles')
            .update({ knowledge_base_id: knowledgeBaseId })
            .eq('id', roleId);

          if (updateError) {
            throw new Error(`更新角色知识库失败: ${updateError.message}`);
          }
          
          console.log('✅ [KnowledgeService] 角色知识库关联设置成功');
          return; // 成功，退出重试循环
          
        } catch (error) {
          console.error(`❌ [KnowledgeService] 设置角色知识库失败 (第${retryCount + 1}次):`, error);
          
          if (retryCount === maxRetries - 1) {
            // 最后一次重试失败，抛出错误
            throw error;
          }
          
          // 等待后重试
          await new Promise(resolve => setTimeout(resolve, retryDelay));
          retryCount++;
        }
      }
    } else {
      // 用户未登录，使用本地存储更新
      console.log('💾 [KnowledgeService] 用户未登录，使用本地存储更新');
      const roleKnowledgeMap = LocalStorageManager.getRoleKnowledgeMap();
      if (knowledgeBaseId) {
        roleKnowledgeMap[roleId] = knowledgeBaseId;
      } else {
        delete roleKnowledgeMap[roleId];
      }
      LocalStorageManager.saveRoleKnowledgeMap(roleKnowledgeMap);
      console.log('✅ [KnowledgeService] 本地存储更新成功');
    }
  }

  // UUID格式验证函数
  private static isValidUUID(str: string): boolean {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    return uuidRegex.test(str);
  }

  // 获取角色卡的知识库ID
  static async getRoleKnowledgeBaseId(roleId: string): Promise<string | null> {
    const { isLoggedIn } = await isUserLoggedIn();
    
    if (isLoggedIn) {
      // 检查roleId是否为有效UUID格式
      if (!this.isValidUUID(roleId)) {
        console.log('ℹ️ [KnowledgeService] 角色ID不是UUID格式，跳过数据库查询:', { roleId });
        return null;
      }
      
      // 用户已登录，从Supabase获取
      const { data, error } = await supabase
        .from('ai_roles')
        .select('knowledge_base_id')
        .eq('id', roleId)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          // 角色不存在
          return null;
        }
        throw new Error(`获取角色知识库失败: ${error.message}`);
      }

      return data?.knowledge_base_id || null;
    } else {
      // 用户未登录，从本地存储获取
      const roleKnowledgeMap = LocalStorageManager.getRoleKnowledgeMap();
      return roleKnowledgeMap[roleId] || null;
    }
  }

  // 获取角色卡关联的完整知识库对象
  static async getRoleKnowledgeBase(roleId: string): Promise<KnowledgeBase | null> {
    console.log('🔍 [KnowledgeService] 获取角色知识库:', { roleId });
    
    try {
      // 首先获取知识库ID
      const knowledgeBaseId = await this.getRoleKnowledgeBaseId(roleId);
      
      if (!knowledgeBaseId) {
        console.log('ℹ️ [KnowledgeService] 角色未配置知识库:', { roleId });
        return null;
      }
      
      console.log('📚 [KnowledgeService] 找到知识库ID:', { roleId, knowledgeBaseId });
      
      // 获取所有知识库
      const allKnowledgeBases = await this.getKnowledgeBases();
      
      // 查找对应的知识库
      const knowledgeBase = allKnowledgeBases.find(kb => kb.id === knowledgeBaseId);
      
      if (!knowledgeBase) {
        console.warn('⚠️ [KnowledgeService] 知识库不存在:', { roleId, knowledgeBaseId });
        return null;
      }
      
      console.log('✅ [KnowledgeService] 成功获取角色知识库:', {
        roleId,
        knowledgeBaseId: knowledgeBase.id,
        knowledgeBaseName: knowledgeBase.name
      });
      
      return knowledgeBase;
    } catch (error) {
      console.error('❌ [KnowledgeService] 获取角色知识库失败:', { roleId, error });
      return null;
    }
  }
}