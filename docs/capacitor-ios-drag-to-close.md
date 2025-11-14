# Capacitor iOS 原生拖动关闭功能实现

## 概述
已将 HistoryModal 组件的 H5 拖动关闭功能替换为 Capacitor iOS 优化的触摸拖动关闭功能。修复了拖动到阈值时窗口直接消失的问题，现在窗口会平滑地划出画面，并且支持从下向上弹出和从上向下消失的动画效果。特别修复了拖动松手后窗口回弹到顶部再划出动画的问题，现在拖动结束时保持当前位置，根据滑动距离决定平滑回弹或继续划出。**关键修复：使用专门的 dragOffsetY 状态来保持拖动位置，避免状态更新时导致的瞬间回弹问题**。

## 主要更改

### 1. 移除 H5 拖动关闭实现
- 移除了 `useDragToClose` Hook 的使用
- 删除了相关的复杂拖动状态管理和动画逻辑
- 移除了第三方手势识别库依赖

### 2. 添加 iOS 原生触摸事件支持
- 使用原生触摸事件处理（touchstart, touchmove, touchend）
- 实现了简化的向下滑动检测
- 添加了平滑的拖动动画效果

### 3. 修改 HistoryModal 组件
- 添加了 Capacitor 平台检测
- 在 iOS 上启用原生触摸拖动关闭功能
- 修复了拖动到阈值时窗口直接消失的问题
- 添加了平滑的划出动画效果
- 实现了从下向上弹出和从上向下消失的动画
- 优化了触摸事件处理逻辑和视觉反馈
- **特别修复**：拖动松手后窗口回弹到顶部再划出动画的问题，现在拖动结束时保持当前位置，根据滑动距离决定平滑回弹或继续划出
- **关键修复**：使用专门的 `dragOffsetY` 状态来保持拖动位置，避免状态更新时导致的瞬间回弹问题，确保拖动结束时窗口保持在当前位置

## 文件结构

```
src/
└── components/
    └── HistoryModal.tsx                 # 修改后的模态框组件
```

## 核心实现

### 触摸事件处理
```typescript
// iOS 原生触摸事件处理
const handleTouchStart = useCallback((e: React.TouchEvent) => {
  if (isCapacitorIOS) {
    setTouchStartY(e.touches[0].clientY);
    setCurrentTouchY(e.touches[0].clientY);
    setIsDragging(false);
  }
}, [isCapacitorIOS]);

const handleTouchMove = useCallback((e: React.TouchEvent) => {
  if (isCapacitorIOS && touchStartY > 0) {
    const currentY = e.touches[0].clientY;
    const deltaY = currentY - touchStartY;
    
    // 只处理向下滑动
    if (deltaY > 0) {
      setIsDragging(true);
      setCurrentTouchY(currentY);
      
      // 如果滑动距离超过阈值，关闭模态框
      if (deltaY > 100) {
        onClose();
      }
    }
  }
}, [isCapacitorIOS, touchStartY, onClose]);
```

### 拖动动画效果 - 关键修复
```typescript
// 关键修复：使用专门的 dragOffsetY 状态来避免瞬间回弹
const [dragOffsetY, setDragOffsetY] = useState(0); // 专门存储拖动偏移量

// 触摸事件处理 - 存储偏移量而非实时计算
const handleTouchMove = useCallback((e: React.TouchEvent) => {
  if (isCapacitorIOS && touchStartY > 0 && !isAnimatingOut) {
    const currentY = e.touches[0].clientY;
    const deltaY = currentY - touchStartY;
    
    if (deltaY > 0) {
      e.preventDefault();
      setIsDragging(true);
      setCurrentTouchY(currentY);
      setDragOffsetY(deltaY); // 直接存储偏移量
    }
  }
}, [isCapacitorIOS, touchStartY, isAnimatingOut]);

// 关键修复：样式中使用专门的偏移量，避免状态更新导致的瞬间回弹
style={{
  transform: (() => {
    if (isAnimatingOut) {
      return 'translateY(100%)'; // 划出动画
    } else if (isCapacitorIOS && (isDragging || dragOffsetY > 0)) {
      return `translateY(${Math.max(0, dragOffsetY)}px)`; // 使用专门偏移量
    } else if (!isVisible) {
      return 'translateY(100%)'; // 初始状态
    } else {
      return 'translateY(0)'; // 正常显示
    }
  })(),
  transition: (() => {
    if (isDragging) return 'none'; // 拖动时无动画
    else if (isAnimatingOut || (!isDragging && dragOffsetY > 0)) {
      return 'transform 0.2s ease-out'; // 划出或回弹动画
    }
    return 'transform 0.2s ease-out'; // 正常动画
  })(),
}}
```

## 优势

1. **性能优化**：使用原生触摸事件，性能更好
2. **用户体验**：符合 iOS 用户习惯的交互方式
3. **动画效果**：平滑的弹出、划出和消失动画
4. **代码简化**：移除了复杂的第三方依赖
5. **平台适配**：自动检测平台，保持跨平台一致性
6. **原生感觉**：提供与原生 iOS 应用相似的拖动体验

## 动画效果

### 弹出动画
- 窗口从屏幕下方（translateY(100%)）向上滑动到正常位置（translateY(0)）
- 使用 `transform 0.2s ease-out` 过渡效果
- 背景遮罩同步淡入

### 拖动关闭动画
- 实时跟随手指移动
- 拖动时无过渡效果，提供即时响应
- 拖动结束时保持当前位置，不会回弹到顶部
- 超过阈值后从当前位置平滑划出到屏幕下方
- 未达到阈值时从当前位置平滑回弹到原位

### 关闭动画
- 正常关闭：从上向下滑出到屏幕下方
- 拖动关闭：从当前位置平滑划出到屏幕下方
- 背景遮罩同步淡出

## 技术特点

- **轻量级**：不依赖外部手势识别库
- **响应式**：实时响应触摸事件
- **可配置**：滑动阈值可调整
- **兼容性**：支持 iOS 13+ 设备

## 注意事项

- 仅适用于 Capacitor iOS 环境
- Web 和 Android 平台保持原有行为
- 需要在真实的 iOS 设备上测试触摸体验
- 滑动阈值为 100px，可根据需要调整