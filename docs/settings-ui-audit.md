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

## 增删列表与选择器（后续整改）

依据 Apple HIG Lists and tables 与 Ionic Select 文档：

- 附加提示词/技能采用添加行 + 显式编辑状态；编辑状态显示移除和排序手柄。
- IonReorderGroup 完成时使用 complete(false)，让 React 唯一负责数组对应的 DOM 顺序。
- 添加选项排除已选项；移除只解除当前角色关联，不删除提示词/技能资源。
- 知识库、回复方式、语音模型均使用 IonSelect interface=popover。
- popover 通过 cssClass 应用同一 iOS 27 主题，并补全主题适配器对 popover host 的匹配。
- 工具栏关闭图标使用标准 IonIcon icon-only slot；关闭抛错时解除请求锁以允许重试。
- 未能确认实际点击遮挡来源：本轮原生连接启动失败、浏览器访问主机不可用。不得把组件测试作为命中测试通过的依据。

## 按钮中央失效：已实测定位并修复

此节取代前文“点击遮挡来源未确认”的状态。

用户授权使用 Puppeteer 隔离 Chrome 后，实测 390×844 视口：

- 关闭按钮 rect=(17,56,44,44)。标题 computed padding=0，内部 .toolbar-title 横跨 390px，垂直范围 65.25–90.75。
- 中央 (39,78) 命中 ION-TITLE/.toolbar-title，真实鼠标点击后弹层仍打开。
- 上缘 (39,62.6) 命中 ION-BUTTON，真实点击可关闭。
- 根因：Tailwind Preflight 的文档级 `* { padding: 0 }` 优先于 Ionic shadow :host 的左右 90px padding；标题内部明确使用 pointer-events:auto，所以中央一条区域拦截了按钮。
- 修复：仅为 settings 中 iOS title-default 恢复 Ionic 原生 padding-inline:90px；不提高按钮 z-index，不禁用标题事件，不影响 large/small 标题。
- 角色编辑页及其加载页的返回控件改为 chevronBack icon-only，并保留无障碍名称和草稿退出保护。

真实 Chromium 回归：先临时施加 padding=0 重现中央失效，再验证修复状态。关闭按钮 15%/50%/85% 三处真实点击均关闭弹层且清除 hash；编辑页返回按钮同三处真实点击均返回角色卡列表。
测试在独立 profile 中创建临时角色，隔离知识库后端；未使用现有账户。
