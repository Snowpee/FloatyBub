# 设置界面审计（2026-11-25）

依据 Ionic modal 官方 API、已安装的 @rdlabo/ionic-theme-ios27 文档及 Apple HIG Settings。

## 本次修正

- 补入被 scripts/ 忽略规则排除的 settingsIosTheme.ts；此前 Vite 引用了未被 Git 跟踪的本地脚本。

- 删除设置 modal 的 z-index:40 !important，恢复 Ionic overlay 层级。旧设置为兼容 body portal 编辑器而降低整个 overlay，会使应用侧栏/其他弹窗参与覆盖与命中。
- 删除关闭时切换 IonNav key 的做法，避免 dismiss 动画中销毁并重建导航。
- 关闭走 modal.dismiss，并同步受控 isOpen；手势关闭由 didDismiss 同步。保留未保存表单 guard。
- presentingElement 改为整个应用页面，不再绑定侧栏手势会修改 transform 的主内容。
- 补齐标准 Ionic safe-area 变量：当前应用没有 IonApp，官方动画中的 max(30px,var(--ion-safe-area-top)) 不能依赖不存在的变量。
- 主题隔离器允许 ion-modal 规则匹配 modal host 自身；原先只匹配后代。
- 保留 focusTrap=false 为明确的迁移债务：其他未迁移栏目仍通过 body portal 编辑，直接删除会使这些编辑器失去键盘焦点。
- 角色卡采用 IonCard button 的原生结构，移除内部 button、一级删除和日期脚注，改为单列。
- 编辑表单按主题要求使用 IonList(inset) > IonListHeader + IonItemGroup；提示词采用有限高度输入，避免长提示词吞掉整个页面。
- 排序改用 IonReorderGroup/IonReorder，移除每行的三个小按钮；移除项目在多选中完成。
- 删除仅位于自定义角色的编辑页底部，使用 destructive 确认。

## 尚存的旧实现边界

桌面 SettingsModal.Desktop、桌面 RolesModal 和其他未迁移栏目仍包含 DaisyUI / BottomSheet 编辑器。
它们没有在本次被声称完成 Ionic 迁移。focusTrap=false 仍待这些旧 body portal 编辑器逐项迁移后移除；不能再次靠降低整个 modal z-index 处理。

## 验证边界

类型、生产构建、相关 ESLint、角色草稿/排序/保存、设置生命周期和主题声明测试。
原生 Chrome AX 可读取原页面；后续重载出现空白，原生工具随后返回 noWindowsAvailable，浏览器 connector 不可用，不能据此宣称关闭/缩放的视觉验收通过。
