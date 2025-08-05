# 侧边栏分页功能测试指南

## 问题描述
用户反映侧边栏聊天记录滚动后没有加载新数据，仍然只显示20条记录。

## 修复内容
1. ✅ 将 `ITEMS_PER_PAGE` 从 20 更改为 50
2. ✅ 修复了 `hasMore` 状态重置逻辑
3. ✅ 优化了 Intersection Observer 的依赖项
4. ✅ 确保分页逻辑正确工作

## 测试步骤

### 1. 生成测试数据
1. 打开浏览器开发者工具 (F12)
2. 在控制台中运行以下代码生成60个测试会话：
```javascript
// 首先加载测试数据生成器
fetch('/test-data-generator.js')
  .then(response => response.text())
  .then(code => eval(code))
  .then(() => {
    // 生成测试数据
    generateTestChatSessions();
  });
```

### 2. 验证分页功能
1. 打开侧边栏（点击左上角菜单按钮）
2. 确认初始显示50条聊天记录
3. 滚动到侧边栏底部
4. 观察是否出现"加载中..."提示
5. 确认加载完成后显示更多记录
6. 继续滚动直到显示所有记录
7. 确认最后显示"已显示全部 XX 条记录"提示

### 3. 清理测试数据
测试完成后，在控制台运行：
```javascript
clearTestChatSessions();
```

## 技术细节

### 分页逻辑
- **每页显示**: 50条记录
- **加载触发**: 滚动到距离底部100px时
- **加载延迟**: 200ms模拟网络延迟
- **状态管理**: 使用 `currentPage`、`hasMore`、`isLoading` 状态

### Intersection Observer 配置
```javascript
{
  root: scrollContainerRef.current,
  rootMargin: '100px', // 提前100px开始加载
  threshold: 0.1
}
```

### 关键修复点
1. **状态重置**: 当聊天会话数据变化时，重置 `currentPage` 为 1 并设置 `hasMore` 为 true
2. **依赖优化**: 移除不必要的依赖项，避免无限重新创建 Observer
3. **显示逻辑**: 使用 `filteredSessions.slice(0, currentPage * ITEMS_PER_PAGE)` 计算显示的会话

## 预期结果
- ✅ 初始显示50条记录（而不是20条）
- ✅ 滚动到底部时自动加载更多
- ✅ 显示加载状态和完成提示
- ✅ 正确处理所有会话数据

## 故障排除
如果分页功能仍然不工作：
1. 检查浏览器控制台是否有错误
2. 确认测试数据已正确生成
3. 验证 Intersection Observer 是否正确初始化
4. 检查滚动容器的高度和溢出设置