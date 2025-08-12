# TODO:

- [x] rename_avatar_cache_file: 将avatarCache.ts重命名为imageCache.ts (priority: High)
- [x] refactor_avatar_cache_class: 将AvatarCache类重构为ImageCache类，支持通用图片缓存 (priority: High)
- [x] refactor_avatar_preload_hook: 将useAvatarPreload hook重构为useImagePreload hook (priority: High)
- [x] add_backward_compatibility: 添加向后兼容的别名导出，确保现有代码不受影响 (priority: High)
- [x] add_generic_features: 添加通用功能：图片尺寸检测、格式验证等 (priority: Medium)
- [x] update_avatar_component: 更新Avatar组件使用新的通用图片缓存机制 (priority: Medium)
- [x] test_functionality: 测试重构后的功能确保一切正常工作 (priority: Medium)
