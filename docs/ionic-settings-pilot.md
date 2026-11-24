# Ionic 设置试点与兼容性检查

分支：`feat/ionic-settings-pilot`。检查日期：2026-11-23。

## 结论与边界

桌面 Chrome 和 Chrome 移动设备模拟下，十个设置分区均可打开。
技能、知识库导航错误已修复；H5 的基础导航、关闭重开、深链接切换和横竖屏布局切换已验证。
这不是“全部功能、全部浏览器通过”的结论：尚未覆盖 Safari/WebKit、Android 真机、
iOS 真机键盘/安全区/边缘手势，以及带有效服务和账号的完整增删改、上传、导入导出和云同步。

浏览器检查使用本地 Vite 与无痕访客窗口，没有登录用户账号，没有保存测试表单或执行清空数据。
浏览器连接宿主不可用，改用原生 Chrome UI 完成检查。

## 页面覆盖

| 分区 | 桌面 Web | H5（iPhone 16 模拟，393×852） | 额外交互覆盖 |
| --- | --- | --- | --- |
| 全局设置 | 打开正常 | 打开正常 | 深链接 |
| 模型 | 打开正常 | 打开正常 | 桌面新增弹窗打开/取消，空表单保存禁用 |
| 角色卡 | 打开正常 | 打开正常 | 深链接 |
| 用户角色 | 打开正常 | 打开正常 | 深链接 |
| 全局提示词 | 打开正常 | 打开正常 | 深链接 |
| 技能库 | 打开正常 | 打开正常 | Web/H5 创建详情、返回列表；独立 /settings/skills 页面可见 |
| 知识库 | 打开正常 | 打开正常 | H5 创建弹窗位于设置之上、名称输入正常；独立 /settings/knowledge 页面可见 |
| 语音 | 打开正常 | 打开正常 | 本地代理缺失时仍显示预设配置，请求失败记录如下 |
| 网络搜索 | 打开正常 | 打开正常 | 深链接 |
| 数据 | 打开正常 | 打开正常 | 存储说明更新；未执行导入、导出、清空 |

H5 额外检查：

- 全部十个 #setting/<section> 深链接。
- 弹层已打开时切换 hash，会更新目标分区。
- Esc 关闭清理 hash，重新打开根列表。
- 393×852 与 852×393 互转，设置保持打开，按断点切换移动/桌面容器。
- 图标与文字间距、竖屏列表、横屏桌面布局做了视觉检查。

H5 模拟并非 Mobile Safari；不能据此宣称已验证 Safari、软键盘或 iPhone 实际安全区。

## 本轮修复

1. **清除旧导航依赖**：技能与知识库使用 SettingsNavigationContext；设置代码不再导入
   MobileNav/NavProvider。没有上下文的桌面端和独立页面使用自身的详情状态，
   不再只凭 window.innerWidth 决定是否渲染导航按钮。
2. **清除失效拖拽**：删除 SettingsContext.tsx、两个详情页的 bind 和 touch-none
   标题栏，以及全局样式中无人使用的 .settings-modal 旧转场规则。
3. **详情高度**：删除两个详情页的 100vh 安全区算式，改用 flex/min-h-0 滚动布局。
4. **断点初始化**：Settings 首次渲染即读取 matchMedia，避免 H5 先挂载桌面容器；
   清理断点订阅。
5. **深链接**：集中定义并解析分区 ID，补 skills，避免 #settings 等前缀误匹配。
   #setting 打开根列表，#setting/global 进入全局设置；新增独立 /settings/skills 路由。
6. **生命周期**：处理已打开时 defaultTab 变化；父层关闭、容器卸载后旧 dismissal
   回调不再关闭替换后的容器。
7. **桌面详情检测**：将 document 全局查询收敛到当前设置内容 ref；删除多组未完整清理的
   setTimeout 重试，使用带清理的 MutationObserver。补充返回/关闭按钮标签和 min-w-0。
8. **技能创建**：创建成功后返回列表，避免留在“新建”页再次保存导致重复添加；详情取消接返回。
9. **存储说明**：localStorage 文案更新为实际使用的 IndexedDB；数据大小标明为备份估算。

## 旧实现盘点

已清理的死代码/依赖：设置对 MobileNav、NavProvider、DragContext 的引用，
失效手势标题栏、旧 iOS 转场 CSS、详情视口高度补丁、桌面轮询式超时重试。

仍在使用，不能当作死代码删除：

- 九个文件使用 BottomSheetModal：ConfigModal、RolesModal、UserRolesModal、GlobalPromptsModal、
  KnowledgeBaseModal、KnowledgeEntryModal、KnowledgeBulkImportModal、VoiceModelModal、SkillDetailView。
- 桌面设置和编辑器使用 HTML dialog / DaisyUI。
- 桌面技能、知识库详情保留 data-back-button / data-is-detail-view 元数据，桌面容器仍消费它们。
- 项目其他 debug 页面仍使用 MobileNav；本次没有删除公共组件或调试页面。
- RolesModal 的 cursor-move 对应角色内容排序，不是已失效的设置弹层拖拽。

过渡期兼容：设置 IonModal 层级为 40，使 body 上 z-50 的旧编辑弹窗位于其上方；
暂时关闭 Ionic focusTrap，允许外部编辑弹窗接收输入。键盘焦点隔离仍有局限，
编辑器全部迁移为 Ionic overlays 后应恢复 focusTrap、移除层级覆盖。

## 自动验证与复现

```sh
node tests/mobile/settings-navigation.test.cjs
node tests/sync/settings-sync.test.mjs
npm run build
```

交互生命周期回归使用独立测试依赖，不修改应用依赖：

```sh
npm install --prefix /private/tmp/floaty-settings-tests --no-audit --no-fund react@18.3.1 react-test-renderer@18.3.1
SETTINGS_TEST_MODULES=/private/tmp/floaty-settings-tests node tests/mobile/settings-navigation.test.cjs
SETTINGS_TEST_MODULES=/private/tmp/floaty-settings-tests node tests/mobile/settings-lifecycle.test.cjs
```

结果：

- 实际技能/知识库组件：320、375、393、767、768、820、1024、1440px，
  有无 Ionic 导航上下文、空数据/有数据状态均通过渲染检查；数据与网络依赖隔离。
- 设置容器：十个实时深链接、返回/重开、重复导航、七个宽度的容器切换、
  旧 dismissal 回调、父层关闭、订阅清理，以及桌面详情标题/返回/observer 清理通过。
  此测试模拟 Ionic 原生组件，不验证 Ionic 自身动画、布局和手势。
- 技能实际新增/更新分派、创建成功返回、详情取消和返回按钮的交互检查通过；表单与存储调用隔离。
- 原有 settings-sync 回归通过。
- 生产构建通过，包含 TypeScript 检查。
- 设置容器、导航上下文与路由解析文件的 ESLint 通过。
- 设置目录与 Layout 的完整 ESLint **未通过**：原 HEAD 为 114 个错误，当前为 109 个错误、
  3 个警告，主要为未使用变量、显式 any 等存量问题，不应声称全模块 lint 干净。

## 未解决或未验证的事项

- 本地 local-server 未启动：语音页 /api/tts 获取模型列表失败，页面退回预设版本，未验证实际 TTS、
  搜索、模型连通性；浏览器还记录本地 Vercel analytics 脚本 404。
- 构建仍提示 mime-types 依赖 Node path；StorageService 在 file.type 为空时使用该库推断类型，
  浏览器上传存在潜在兼容风险，本轮没有上传文件来验证。
- 四种主题逐一切换、长列表/大量数据、离线重连、附件上传、导入导出、云端 CRUD 与同步未完整验收。
- iOS/Android 真机、Mobile Safari、Chrome Android、桌面 Safari/Firefox 未验收。
- 切换桌面/移动容器会重建局部表单状态，未提供跨容器保留未保存草稿的能力。

未同步 dist 到 iOS 工程，未提交、合并或推送分支。


## 移动版全局设置改造（桌面隔离）

`GlobalSettings.tsx` 按设置容器提供的导航上下文分发，而非在内页再次猜测窗口宽度：

- `GlobalSettings.Desktop.tsx` 原样保存原版文件，卡片、四个下拉控件、复选框及业务行为不变。
- `GlobalSettings.Mobile.tsx` 用 iOS 模式的 Ionic 控件：分组列表、列表行开关。显示方式也通过二级单选页切换对话/文档。
- 显示方式、主题、辅助模型、默认角色、发送快捷键各自进入二级单选列表。主题有色样、说明与选中勾；
  点击即时生效，留在选择页预览，返回时父页摘要同步。模型仅列出启用项；空列表、失效选项有提示；
  默认角色可以明确选“不指定”。
- 标准 Ionic 二级页与旧详情页采用不同的布局包装，顶部安全区由 IonHeader 处理，避免旧包装重复留白。
- Ionic 初始化和 core.css 从 main.tsx 移至移动容器的延迟加载模块。桌面首屏不初始化 Ionic；
  移动版自定义 CSS 全部限定在 `.ionic-settings-modal` 下，不引入全局 normalize/structure/typography。

设计参考 Apple HIG（具体控件选择为结合此页面作出的设计判断）：

- [Lists and tables](https://developer.apple.com/design/human-interface-guidelines/lists-and-tables)：设置层级用列表与 disclosure，选项用勾选反馈。
- [Toggles](https://developer.apple.com/design/human-interface-guidelines/toggles)：iOS 开关置于列表行内。

新增回归：

```sh
SETTINGS_TEST_MODULES=/private/tmp/floaty-settings-tests node tests/mobile/global-settings.test.cjs
```

覆盖桌面源文件基线快照、桌面四个原生 select、容器隔离、显示方式二级单选/开关、四种主题更新、
主题二级页返回与摘要同步、模型筛选/跟随/空数据/失效选择、角色空值、快捷键和非法事件防护。
自动检查隔离了 store 与 Ionic 内部实现，不替代浏览器/真机验收。

浏览器补测：Chrome iPhone 模拟下，实际验证主题页打开、选中暗色、即时生效与返回摘要、
切换文档模式、关闭标题开关、辅助模型空列表；转成横屏桌面布局后，确认原卡片、下拉框和复选框仍在，
共享设置值保持同步。桌面源码基线快照、新控件回归、已有导航/生命周期回归和生产构建均通过。
仍需 iOS 真机复测安全区、滑动返回及动态字体。


## 二级选择页与控件样式修复

- 将设置根列表的 64px 最小行高限制到 `.ionic-settings-root-list`，避免覆盖全局设置和二级选项。
- 移除 radio/toggle 宿主额外上下 padding；Ionic 自带的内部标签间距已负责行高，重复添加会撑高行。
- 开关保留真实 `IonToggle mode="ios"`，使用官方 `color="success"`，移除自定义轨道颜色和尺寸干预。
- 通过 `::part(label)` 放开标签换行并允许收缩；色卡固定 36px，文字区域 `min-width:0`，长文本可断行。
- 新规则均限定 `.ionic-settings-modal`，未添加通用 `.label`、`.toggle` 或 `.radio` 类。
  主要冲突来自试点自身过宽的规则与重复尺寸，不能笼统归因于 DaisyUI；Ionic 控件内部由 Shadow DOM 隔离。

本轮 Chrome iPhone 16（393×852）检查：显示方式进入二级页、切换文档并返回同步摘要；
选项两行排版和选中勾正常；主题四个色卡、标题与说明未溢出；主页面显示 Ionic iOS 绿色开关。
尝试 320px 补测时原生自动化返回 `noWindowsAvailable`，未完成该宽度视觉验收。
TypeScript、生产构建、针对修改文件的 ESLint 与全局设置/导航/生命周期回归通过。
iOS 真机仍需复测，未同步到 iOS 工程。


## 对齐 iOS 27 演示（取代上轮默认 iOS 外观结论）

差异并非只有 CSS 污染：之前仅加载 Ionic 9 默认 ios 模式，未加载官方博客展示的独立社区主题。
已安装固定版本 `@rdlabo/ionic-theme-ios27@2.2.0`，采用上游 class 样式及 `ios27ThemeConfig`。
参考：
- https://ionic.io/blog/introducing-ionic-theme-ios27
- https://webview-native-ui.com/projects/ionic-theme-ios27/docs/setup
- https://webview-native-ui.com/projects/ionic-theme-ios27/docs/using-ion-item-group

| 项目 | 之前 | 本次 |
| --- | --- | --- |
| 分组圆角 | Ionic 默认旧版形状 | 上游主题 28px；应用主题不设置控件圆角 |
| 开关 | 默认 51×31px 轨道、圆形滑块 | 上游 63×28px 轨道、37×24px 滑块、玻璃按压及减弱动画支持 |
| 行高 | 根入口额外 64px，内页混合默认与自定义 | 删除根入口覆盖，标准行按上游 52px，两行内容按需增高 |
| 分组结构 | 列表直接放 item，标题在外 | 标题在 inset list 内，item-group 或 radio-group 为直接子分组 |
| 说明间距 | 手写 paragraph 外边距 | 使用 list 直属 IonNote，遵循上游间距 |
| 标题左缩进 | Tailwind 的通配 padding 清零覆盖 Shadow DOM 宿主默认 | 在移动容器局部恢复 Ionic 原生 16px + safe-area |

不从 DaisyUI 导入圆角和边框宽度。移除了色卡自身的手写圆角/边线。
应用主题仍提供背景、文字与强调色，因此不会与演示的默认配色完全相同。
暗色 palette 仅施加于移动 modal，应用色彩映射保留足够优先级，避免内容和列表都成为纯黑而失去层次。

为防止 CSS 延迟加载后污染桌面，Vite 的 `settingsIosTheme` 适配器仅调整上游选择器作用域，
把 :root 和 dark palette 变量放在 modal 上，全部控件选择器限制在 modal 内。
不改上游尺寸、线宽、圆角或动效声明。新增回归验证 907 个选择器均限定作用域、全部声明原样保留。
桌面文件基线快照、全局设置交互及容器生命周期回归通过。

浏览器：打开上游在线 demo，观察同尺寸 iPhone 16 下的列表、开关和明暗外观；
本地 393×852 验证新版分组、扁长开关、主题选择页、色卡文本及暗色对比层次。
尚未完成本轮窄屏、滑动返回、iOS 真机和 UIKit 一致性验收。
此处仍是 Web 主题；未启动 Native UI 桥接、未将 IonToggle 替换成 UIKit UISwitch。
主题的原生插件 peer dependency 会安装，但仅安装并不会启用原生控件。未执行 cap sync。


## 返回按钮与导航结构修复

- 移动版设置内页、全局设置二级单选页统一使用 `IonBackButton`，`text=""`，保留无障碍标签。
  设置 defaultHref 以保证深链接内页的按钮可见；正常返回由组件查找最近 IonNav 并 pop，未叠加 React 点击处理。
- 移除内页右侧关闭按钮；仅设置首页保留关闭入口。桌面容器不变。
- React IonNav delegate 本身创建 `.ion-page`，删除页面返回的重复 IonPage 包装。
  标准页的 IonHeader/IonContent 直接交给 delegate 包装；旧编辑器继续使用独立详情布局。
  此举避免嵌套页干扰 `.can-go-back > ion-header` 规则与转场的页头识别。
- Chrome 393×852 实测：深链接进入全局设置后返回设置首页；再次进入全局设置、打开主题页并返回全局设置。
  截图确认纯箭头及内页无右侧关闭按钮。浏览器自动化中间有窗口/元素失效，重新读取状态后已完成实测。
- mock 回归增加内页关闭入口缺失、原生返回组件参数、delegate 页头直接子级检查。
  mock 不执行 Ionic 内部 pop，实际返回行为由上述浏览器补测确认。iOS 真机仍待验证。


## 返回过程中下层页面空白修复

根因：试点 CSS 给 IonNav delegate 的 `.ion-page` 及其 IonHeader 加了不透明背景。
iOS 27 上游在非 translucent 页头布局下分别移动 IonContent 和 toolbar，外层页容器不移动；
静止的背景层覆盖了已显示的下层页面，直到 pop 完成后才随退出页消失。
IonNav 已访问的前序页面仍保留在栈中；无需新增数据缓存、定时器或改为无动画返回。

修复：标准页面外层透明，整体底色放到 IonNav；删除 header 外层底色覆盖。
旧详情的内部包装作为整体被动画移动，继续保留其底色。所有改动仍限定移动设置容器。

验证：Chrome iPhone 16 393×852，DevTools 动画速度设为 10%，捕获“全局设置 → 设置列表”
返回中途画面：退出的全局设置仍在右侧，下层完整设置列表已在左侧显示并随转场移动，无白板遮挡。
返回结束后设置列表正常，已将 DevTools 速度恢复为 100%。该截图验证动画中途，而非仅验证结束状态。
iOS 真机、交互式侧滑取消与其他设备仍需复测。

## 移动模型设置正式改造

`ConfigSettings.tsx` 使用 SettingsNavigationContext 分发：桌面及独立路由走原列表/原编辑弹窗，
移动设置容器走全页 Ionic 模型列表。桌面 `ConfigSettings.Desktop.tsx` 与原文件逐字一致，
`ConfigModal.tsx` 未改；两者均有 SHA-256 回归校验。移动端不再使用旧模型卡片、dropdown、
BottomSheet、checkbox toggle 或 1024px 的内部布局判断。

页面结构：模型列表（右上 +）→ 添加/编辑模型 → 提供商单选、模型搜索/选择/手动输入、
服务地址、生成参数；DeepSeek 的思考模式/强度进入单选页。沿用 iOS 27 主题、标准 IonNav
页结构和纯图标返回；不新增页面外层底色覆盖，不引入桌面圆角/边宽变量。

编辑器采用独立、仅在导航会话内存活的草稿。子页共享同一草稿，只有保存才调用现有
addLLMConfig/updateLLMConfig。字段失焦后显示错误，保存按钮随完整校验启用；温度 0
正确保存，输出上限校验为正整数，地址仅接受不带账号、query/hash 的 HTTP(S) URL。
连续保存受到保护；导航 push 使用 skipIfBusy 避免转场中重复入栈。

未保存返回由 IonButtons capture 拦截并询问是否放弃；取消保持草稿。
有修改时禁用整个设置导航的侧滑，以防手势静默丢失数据，子页仍可点返回。
modal canDismiss 复用同一确认；保存/删除期间阻止退出。页面被外部路由卸载时不再因异步删除结果 pop 其他页面。
旋转切换桌面容器、外部强制变更 hash 等仍可能丢失未保存草稿，不提供跨容器草稿恢复。

连接与模型发现为移动端独立 helper，不改变桌面既有请求行为：
- 服务根地址与 /v1 地址避免重复拼接；代理地址优先。
- Gemini 使用所选模型、contents 请求体与 header API key；Claude 使用 Messages 请求。
- OpenAI 兼容提供商支持获取模型列表，结果去重排序，刷新保留原选择；Claude/Gemini 保留手动模型 ID 输入。
- 连接测试展示 pending/成功/失败，阻止重复；10 秒超时，参数改变或卸载取消请求，旧响应不覆盖新配置。
- 错误反馈按状态分类，不显示原始响应、密钥或请求 URL。
- 删除确认后沿用已有 store 删除及失败回滚，并在页面显示失败提示；未重写持久化/同步机制。

设计参考：
- https://developer.apple.com/design/human-interface-guidelines/lists-and-tables
- https://developer.apple.com/design/human-interface-guidelines/entering-data
- https://developer.apple.com/design/human-interface-guidelines/sheets

验证：新模型回归覆盖桌面隔离、草稿不写库、保存去重、0 值、非法数字/地址、取消放弃、
提供商切换、模型搜索/手动输入、刷新保留选择、请求取消/过期结果、删除失败，以及提供商请求形状。
全局设置、设置生命周期、技能/知识库导航与上游样式隔离回归通过。
针对修改文件的 ESLint、TypeScript 和生产构建通过（原有构建警告仍在）。
Chrome iPhone 16 393×852：打开模型空状态、右上新增、输入名称、提供商二级选择并返回保留名称、
模型搜索与手动输入入口、未保存返回确认和取消继续编辑均观察到。
本轮自动化中窗口/元素多次失效，未据此认定完整保存/放弃/删除、窄屏或旋转流程已通过浏览器验收。
未使用真实密钥，未向真实模型服务发请求，未验证云端删除/同步；iOS 真机与虚拟键盘/侧滑仍待验收。
未执行 cap sync，未提交或推送。

### 模型输入行改为左右布局

移除之前显式设置的 `labelPlacement="stacked"`，共用 Field 与手动模型 ID 输入统一使用
`start`：左标签、右侧输入值。局部设置 native input 右对齐，标签允许换行且最多占行宽 45%，
避免长标签挤出可编辑区域；不修改桌面原表单。HIG 并未禁止上下布局，此次为设置分组行作出布局修正。
参考 https://ionicframework.com/docs/api/input 与 Apple HIG Text fields。
TypeScript、修改文件 ESLint、模型交互回归通过。独立 Chrome iPhone 16 393×852 预览确认
地址页“基础 URL / 代理 URL”与输入在同一行、输入右对齐，未更改原测试标签页的草稿。
