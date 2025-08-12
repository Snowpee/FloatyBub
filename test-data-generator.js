// 测试数据生成器 - 用于创建大量聊天会话来测试分页功能
// 使用方法：在浏览器控制台中运行 generateTestChatSessions() 或 clearTestChatSessions()

// 在浏览器控制台中运行此代码来生成测试数据
function generateTestChatSessions(count = 60) {
  // 检查是否在开发环境中且store已暴露
  if (typeof window === 'undefined' || !window.useAppStore) {
    console.error('❌ 无法找到 useAppStore');
    console.log('💡 请确保：');
    console.log('   1. 在开发环境中运行 (npm run dev)');
    console.log('   2. 页面已完全加载');
    console.log('   3. 在浏览器控制台中运行此代码');
    return;
  }
  
  const useAppStore = window.useAppStore;

  const store = useAppStore.getState();
  const { aiRoles, llmConfigs } = store;
  
  if (!aiRoles.length || !llmConfigs.length) {
    console.error('❌ 需要先配置AI角色和模型');
    return;
  }

  const roleId = aiRoles[0].id;
  const modelId = llmConfigs[0].id;
  
  console.log('🚀 开始生成测试数据...');
  console.log('📋 使用角色:', aiRoles[0].name);
  console.log('🤖 使用模型:', llmConfigs[0].name);
  
  // 生成指定数量的测试会话
  const testSessions = [];
  for (let i = 1; i <= count; i++) {
    const sessionId = `test-session-${i}-${Date.now()}`;
    const session = {
      id: sessionId,
      title: `测试对话 ${i}`,
      roleId: roleId,
      modelId: modelId,
      messages: [
        {
          id: `msg-${i}-1`,
          role: 'user',
          content: `这是第${i}个测试对话的用户消息`,
          timestamp: new Date(Date.now() - (count - i) * 60000) // 按时间倒序
        },
        {
          id: `msg-${i}-2`,
          role: 'assistant',
          content: `这是第${i}个测试对话的AI回复`,
          timestamp: new Date(Date.now() - (count - i) * 60000 + 1000)
        }
      ],
      createdAt: new Date(Date.now() - (count - i) * 60000),
      updatedAt: new Date(Date.now() - (count - i) * 60000 + 2000)
    };
    testSessions.push(session);
  }
  
  // 批量添加到store
  useAppStore.setState((state) => ({
    chatSessions: [...testSessions, ...state.chatSessions]
  }));
  
  console.log(`✅ 成功生成${count}个测试会话`);
  console.log('📊 当前总会话数:', useAppStore.getState().chatSessions.length);
}

// 清理测试数据的函数
function clearTestChatSessions() {
  // 检查是否在开发环境中且store已暴露
  if (typeof window === 'undefined' || !window.useAppStore) {
    console.error('❌ 无法找到 useAppStore');
    console.log('💡 请确保在开发环境中运行且页面已完全加载');
    return;
  }
  
  const useAppStore = window.useAppStore;
  
  useAppStore.setState((state) => ({
    chatSessions: state.chatSessions.filter(session => !session.id.startsWith('test-session-'))
  }));
  
  console.log('🧹 已清理所有测试数据');
  console.log('📊 当前总会话数:', useAppStore.getState().chatSessions.length);
}

console.log('📝 测试数据生成器已加载');
console.log('🔧 使用方法:');
console.log('  1. 确保在开发环境中运行 (npm run dev)');
console.log('  2. 打开浏览器开发者工具的控制台');
console.log('  3. 运行以下命令:');
console.log('     - generateTestChatSessions()     // 生成60个测试会话（默认）');
console.log('     - generateTestChatSessions(100) // 生成100个测试会话');
console.log('     - clearTestChatSessions()    // 清理所有测试数据');
console.log('  4. 测试侧边栏的分页加载功能');

// 导出函数到全局作用域
if (typeof window !== 'undefined') {
  window.generateTestChatSessions = generateTestChatSessions;
  window.clearTestChatSessions = clearTestChatSessions;
}