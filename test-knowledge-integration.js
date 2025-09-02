// 知识库集成端到端测试脚本
// 这个脚本用于测试知识库检索和提示词注入功能

import { KnowledgeService } from './src/services/knowledgeService.js';
import { ChatEnhancementService } from './src/services/chatEnhancementService.js';

// 测试数据
const testKnowledgeBase = {
  name: '测试知识库',
  description: '用于测试知识库检索功能的测试数据'
};

const testKnowledgeEntries = [
  {
    title: 'JavaScript基础',
    content: 'JavaScript是一种动态编程语言，主要用于网页开发。它支持面向对象、函数式和过程式编程范式。',
    tags: ['javascript', '编程', '前端']
  },
  {
    title: 'React框架',
    content: 'React是Facebook开发的用于构建用户界面的JavaScript库。它采用组件化架构，使用虚拟DOM提高性能。',
    tags: ['react', 'javascript', '前端', '框架']
  },
  {
    title: '数据库设计',
    content: '数据库设计是指根据业务需求设计数据库结构的过程。包括实体关系建模、表结构设计、索引优化等。',
    tags: ['数据库', '设计', '后端']
  }
];

const testRoleId = 'code-expert'; // 使用默认的编程专家角色
const testUserMessage = 'React组件如何优化性能？';

async function runTest() {
  console.log('🧪 开始知识库集成测试...');
  
  try {
    // 1. 创建测试知识库
    console.log('\n📚 步骤1: 创建测试知识库');
    const knowledgeBase = await KnowledgeService.createKnowledgeBase(testKnowledgeBase);
    console.log('✅ 知识库创建成功:', knowledgeBase.id);
    
    // 2. 添加知识条目
    console.log('\n📝 步骤2: 添加知识条目');
    const entries = [];
    for (const entryData of testKnowledgeEntries) {
      const entry = await KnowledgeService.createKnowledgeEntry({
        ...entryData,
        knowledgeBaseId: knowledgeBase.id
      });
      entries.push(entry);
      console.log(`✅ 知识条目创建成功: ${entry.title}`);
    }
    
    // 3. 将知识库关联到角色
    console.log('\n🔗 步骤3: 关联知识库到角色');
    await KnowledgeService.setRoleKnowledgeBase(testRoleId, knowledgeBase.id);
    console.log(`✅ 角色 ${testRoleId} 已关联知识库 ${knowledgeBase.id}`);
    
    // 4. 验证角色知识库关联
    console.log('\n🔍 步骤4: 验证角色知识库关联');
    const associatedKnowledgeBase = await KnowledgeService.getRoleKnowledgeBase(testRoleId);
    if (associatedKnowledgeBase && associatedKnowledgeBase.id === knowledgeBase.id) {
      console.log('✅ 角色知识库关联验证成功');
    } else {
      console.error('❌ 角色知识库关联验证失败');
      return;
    }
    
    // 5. 测试知识库增强功能
    console.log('\n🚀 步骤5: 测试知识库增强功能');
    const enhancedContext = await ChatEnhancementService.enhanceChatContext(
      testUserMessage,
      knowledgeBase.id,
      {
        maxResults: 3,
        minScore: 0.1,
        enableDebug: true
      }
    );
    
    console.log('📊 增强结果:');
    console.log('- 提取的关键词:', enhancedContext.extractedKeywords);
    console.log('- 检索到的知识条目数量:', enhancedContext.relevantEntries.length);
    console.log('- 知识上下文长度:', enhancedContext.knowledgeContext.length);
    
    if (enhancedContext.relevantEntries.length > 0) {
      console.log('\n📋 相关知识条目:');
      enhancedContext.relevantEntries.forEach((entry, index) => {
        console.log(`  ${index + 1}. ${entry.title} (相关度: ${entry.score?.toFixed(3) || 'N/A'})`);
      });
    }
    
    // 6. 测试提示词注入
    console.log('\n💉 步骤6: 测试提示词注入');
    const baseSystemPrompt = '你是一个专业的编程专家。';
    const enhancedPrompt = ChatEnhancementService.injectKnowledgeContext(
      baseSystemPrompt,
      enhancedContext
    );
    
    console.log('\n📝 原始系统提示词:');
    console.log(baseSystemPrompt);
    console.log('\n📝 增强后的系统提示词:');
    console.log(enhancedPrompt);
    
    // 7. 获取调试信息
    console.log('\n🔧 步骤7: 获取调试信息');
    const debugInfo = ChatEnhancementService.getDebugInfo();
    console.log('调试信息:', debugInfo);
    
    console.log('\n🎉 知识库集成测试完成！');
    
    // 清理测试数据
    console.log('\n🧹 清理测试数据...');
    await KnowledgeService.setRoleKnowledgeBase(testRoleId, null);
    await KnowledgeService.deleteKnowledgeBase(knowledgeBase.id);
    console.log('✅ 测试数据清理完成');
    
  } catch (error) {
    console.error('❌ 测试失败:', error);
    console.error('错误详情:', error.stack);
  }
}

// 运行测试
if (typeof window !== 'undefined') {
  // 在浏览器环境中，将测试函数暴露到全局
  window.testKnowledgeIntegration = runTest;
  console.log('🔧 测试函数已暴露到全局: window.testKnowledgeIntegration()');
} else {
  // 在Node.js环境中直接运行
  runTest();
}

export { runTest as testKnowledgeIntegration };