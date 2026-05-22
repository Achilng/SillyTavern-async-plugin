# Reply Polisher 进度

## 当前状态

- 状态：代码实现、自动化验证和本机 SillyTavern 安装目录同步已完成；真实模型 B 自动润色仍需在浏览器刷新后发送消息验证。
- 工作区：当前仓库根目录位于 `D:\Agent\酒馆插件`。
- 本次更新前已有的项目文件：`AGENTS.md`、`PLAN.md`、`PROGRESS.md`。
- Git 状态：当前目录是 Git 仓库，分支 `main` 跟踪 `origin/main`。
- 已定位本机 SillyTavern 安装目录：`D:\酒馆\chu\SillyTavern`。
- 已确认本机 SillyTavern 版本：`1.14.0`。
- 说明：本机 SillyTavern 的 `enableServerPlugins` 当前为 `true`。

## 用户已确认的决定

- 构建一个 SillyTavern 回复后处理插件。
- 使用 `UI Extension + Server Plugin`。
- 模型 A 保持为 SillyTavern 正常的生成模型。
- 模型 B 独立配置。
- 插件应提供一个设置 UI，让用户输入模型 B：
  - `base URL`
  - `API key`
  - `model`
- API key 可以通过前端 UI 输入，但应由服务器插件保存和使用。
- 保存后，真实 API key 不得返回给前端。
- 重写提示词应存储在前端设置中，因为它面向用户。
- 后端模型调用应遵循 SillyTavern 的 `custom` OpenAI 兼容风格。
- 第一版仅面向 OpenAI 兼容的 Chat Completions。
- Anthropic/Gemini 原生格式等非 OpenAI 原生 API 不在第一版范围内。
- 模型 B 重写失败时的行为：保留原始模型 A 回复并显示错误。
- 自动处理应处理普通回复和重新生成/swipe 回复。
- Continue/append 生成不应被处理。
- 已处理过的消息不应再次被自动处理。

## 设计摘要

前端扩展会监听已完成的助手消息，检查该消息是否应被重写，捕获安全快照，然后只将重写提示词和目标文本发送给服务器插件。

服务器插件加载独立的模型 B 配置，并调用 OpenAI 兼容的 `/chat/completions` 端点。它不会读取聊天历史、角色卡、世界信息或 SillyTavern 生成上下文。

后端返回重写文本后，前端会验证用户是否没有切换聊天、编辑目标消息或改变 swipe 状态。只有通过验证后，才会替换原始助手消息、更新当前激活的 swipe、标记消息为已处理、重新渲染并保存聊天。

## 未解决事项

- [x] 定位实际的 SillyTavern 安装目录或目标开发副本：`D:\酒馆\chu\SillyTavern`。
- [x] 确认已安装的 SillyTavern 版本：`1.14.0`。
- [x] 确认当前 SillyTavern 版本的准确前端导入路径：优先使用 `SillyTavern.getContext()`；可用上下文包括 `eventSource`、`eventTypes`/`event_types`、`extensionSettings`、`saveSettingsDebounced`、`updateMessageBlock`、`saveChat`、`getCurrentChatId`。
- [x] 确认当前 SillyTavern 版本的准确服务器插件路由注册模式：`plugins/<id>/index.js` 导出 `init(router)` 和 `info`，路由自动挂载到 `/api/plugins/<id>`。
- [x] 决定最终插件显示名称：`Reply Polisher`。
- [x] 决定最终插件 ID：`reply-polisher`。
- [x] 在实际 SillyTavern 安装中启用 `config.yaml` 的 `enableServerPlugins: true`。当前本机值为 `true`。

## 已确认的 SillyTavern 1.14.0 集成点

- UI 扩展可安装到 `public/scripts/extensions/third-party/reply-polisher`。
- 下载/第三方扩展在 HTTP 下挂载到 `/scripts/extensions/third-party`。
- UI 扩展 manifest 需要 `display_name`、`js`，可选 `css`。
- 设置持久化使用 `SillyTavern.getContext().extensionSettings` 和 `saveSettingsDebounced()`。
- 设置面板模板可使用 `renderExtensionTemplateAsync('third-party/reply-polisher', 'settings')` 后追加到 `#extensions_settings2`。
- `CHARACTER_MESSAGE_RENDERED`、`MESSAGE_SWIPED`、`MESSAGE_RECEIVED`、`GENERATION_ENDED` 等事件存在；本插件优先使用 `CHARACTER_MESSAGE_RENDERED` 和 `MESSAGE_SWIPED`。
- `updateMessageBlock(messageId, message)` 可重渲染消息内容。
- `saveChat` 是 `saveChatConditional` 的上下文别名，可用于保存聊天。
- 服务器插件默认禁用，需要用户自行设置 `enableServerPlugins: true`。
- 服务器插件目录下的 `plugins/package.json` 设置了 `"type": "commonjs"`，因此 `plugins/reply-polisher/index.js` 可使用 CommonJS。
- 服务器插件路由会自动挂载到 `/api/plugins/reply-polisher`。

## 实施进度

- [x] 已理解需求。
- [x] 已选择架构。
- [x] 已决定设置归属。
- [x] 已决定失败行为。
- [x] 已决定触发行为。
- [x] 已选择 OpenAI 兼容后端格式。
- [x] 已创建根实施计划。
- [x] 已创建根进度跟踪器。
- [x] 已定位本机 SillyTavern 1.14.0 集成点。
- [x] 已补全根实施计划的后续任务。
- [x] UI 扩展已搭建骨架。
- [x] 服务器插件已搭建骨架。
- [x] 后端设置 API 已实现。
- [x] 后端重写 API 已实现。
- [x] 前端设置 UI 已实现。
- [x] 自动重写流程已实现。
- [x] 手动重写按钮已实现。
- [x] 自动重写改为后台执行，避免阻塞 SillyTavern 正常发送流程。
- [x] 自动/手动润色增加运行中和完成提示。
- [x] 已修复旧 `reply_polisher.processed` 标记被 SillyTavern 复制到新 swipe 后导致自动/手动润色误判为无可处理回复的问题。
- [x] 已修复 SillyTavern reasoning/其他后台处理在润色期间改动 `message.mes` 时被误判为用户编辑的问题：现在会基于最新内容重试一次，仅在聊天/消息/swipe 目标变化时中止。
- [x] 已修复设置面板按钮中文标签因 SillyTavern 全局 `.menu_button { width: min-content; }` 导致竖排的问题。
- [x] 已增加“获取模型列表”功能：服务端代理请求模型 B 的 OpenAI 兼容 `/models`，前端可拉取列表并选择模型名。
- [x] 自动化端到端验证已完成（SillyTavern plugin-loader + 浏览器 harness）。真实安装后的手动验证仍需用户启用 server plugins 并配置模型 B。
- [x] 已修复自动润色触发时机：从直接监听消息渲染/swipe 事件改为 `MESSAGE_RECEIVED` + `CHARACTER_MESSAGE_RENDERED` 双门槛处理，并使用生成开始前的最新助手回复身份避免失败生成误处理旧消息。
- [x] 已移除自动润色的二次模型 B 调用重试；每次生成完成只尝试一次，失败或目标内容变化时保留原文并返回。
- [x] 已将修复后的 UI 扩展文件同步到本机 SillyTavern 安装目录：`D:\酒馆\chu\SillyTavern\public\scripts\extensions\third-party\reply-polisher`。
- [x] 已确认 `GENERATION_ENDED` 在 SillyTavern 1.14.0 中由 `hideStopButton()` 触发，swipe 开始时也可能出现，因此不再用它发起自动润色。
- [x] 已增加全局运行锁 `window.__replyPolisherRuntime`，避免同一页面中重复加载的扩展实例同时调用模型 B。
- [x] 已为每次真实润色请求增加编号提示：`正在润色N`、`成功N`、`失败N`。
- [x] 已在服务器 `/rewrite` 路由增加同内容并发请求合并，避免重复前端实例把同一文本同时送到模型 B。
- [x] UI 扩展版本提升到 `0.1.1`，并给 manifest 的 JS 路径增加查询版本，降低浏览器继续加载旧 `index.js` 的概率。
- [x] 已定位无编号弹窗来源：本机 SillyTavern 用户扩展目录存在旧副本 `data\default-user\extensions\SillyTavern-Rewrite-Extension`，其 manifest 同名 `Reply Polisher`，版本 `0.1.0`，仍监听 `CHARACTER_MESSAGE_RENDERED` 和 `MESSAGE_SWIPED`。
- [x] 已将旧副本移出 SillyTavern 扩展目录并备份到 `D:\Agent\Agent_temp\removed-SillyTavern-Rewrite-Extension-20260522-191604`，当前 SillyTavern 只剩 `public\scripts\extensions\third-party\reply-polisher` 这一份 `Reply Polisher`。
- [x] 已将 UI 扩展文件复制到仓库根目录，使 GitHub URL 安装时能直接找到 `manifest.json`。
- [x] 已将前端模板路径改为从 `import.meta.url` 动态解析，兼容 URL 安装后的目录名 `SillyTavern-async-plugin`。
- [x] 已在仓库根目录增加 `README.md`，说明 URL 安装地址和服务器插件安装限制。

## 验证记录

- [x] `node --test tests\reply-polisher-server.test.mjs tests\reply-polisher-ui-core.test.mjs`：11 项通过。
- [x] `node --test tests\reply-polisher-assets.test.mjs tests\reply-polisher-ui-core.test.mjs tests\reply-polisher-server.test.mjs`：15 项通过。
- [x] `node --test tests\reply-polisher-ui-core.test.mjs`：8 项通过，覆盖旧处理标记、新 swipe、手动重新润色。
- [x] `node --test tests\reply-polisher-assets.test.mjs tests\reply-polisher-ui-core.test.mjs`：12 项通过，覆盖后台内容变化后的重试提示和目标身份检查。
- [x] `node --test tests\reply-polisher-assets.test.mjs tests\reply-polisher-ui-core.test.mjs tests\reply-polisher-server.test.mjs`：19 项通过，覆盖设置按钮横向排版。
- [x] `node --test tests\reply-polisher-assets.test.mjs tests\reply-polisher-server.test.mjs tests\reply-polisher-ui-core.test.mjs`：22 项通过，覆盖模型列表 URL、模型 ID 提取、后端路由和前端设置入口。
- [x] `node --check plugins\reply-polisher\index.js`：通过。
- [x] `node --check public\scripts\extensions\third-party\reply-polisher\index.js`：通过。
- [x] `node --check public\scripts\extensions\third-party\reply-polisher\core.js`：通过。
- [x] SillyTavern 1.14.0 `src/plugin-loader.js` 真实加载验证：当前仓库 `plugins/reply-polisher` 被挂载到 `/api/plugins/reply-polisher`，包含 `GET /settings`、`POST /settings`、`POST /rewrite`。
- [x] 临时浏览器 harness 验证：设置面板能挂载，`hasApiKey` 状态显示为 `API key saved`，手动重写只发送 `prompt`、`text`、`temperature`、`maxTokens`、`timeoutMs`，并原地更新消息和触发保存。
- [x] 本机 SillyTavern HTTP 路由验证：`/scripts/extensions/third-party/reply-polisher/index.js` 已包含运行提示文案，`/api/plugins/reply-polisher/settings` 返回 200 且 `hasApiKey: true`。
- [x] 本机当前“花音”聊天文件验证：旧 `reply_polisher.processed` 标记不再阻止当前 active swipe 自动润色，手动查找可定位最新助手回复。
- [x] 本机 SillyTavern 源码确认：`reasoning.js` 会在 `MESSAGE_RECEIVED`/`MESSAGE_UPDATED` 后解析 reasoning 并改写 `message.mes`，这是“未手动编辑但快照变化”的可能来源。
- [x] 本机 SillyTavern HTTP 路由验证：`/scripts/extensions/third-party/reply-polisher/style.css` 已包含按钮 `fit-content` 和 `nowrap` 覆盖。
- [x] 本机 SillyTavern 安装目录已同步模型列表功能，并已重启 SillyTavern 使新增 `/api/plugins/reply-polisher/models` 路由生效。
- [x] `node --test tests\reply-polisher-assets.test.mjs tests\reply-polisher-ui-core.test.mjs tests\reply-polisher-server.test.mjs`：26 项通过，覆盖编号提示、全局锁、收到并渲染同一条生成消息后触发、移除 `GENERATION_ENDED`/`MESSAGE_SWIPED` 自动触发、移除二次重试和后端并发合并。
- [x] `node --check public\scripts\extensions\third-party\reply-polisher\index.js`：通过。
- [x] `node --check public\scripts\extensions\third-party\reply-polisher\core.js`：通过。
- [x] `node --check plugins\reply-polisher\index.js`：通过。
- [x] `node --test tests\reply-polisher-assets.test.mjs tests\reply-polisher-ui-core.test.mjs tests\reply-polisher-server.test.mjs`：27 项通过，新增覆盖仓库根目录可作为 SillyTavern URL 扩展安装。
- [x] `node --check index.js`：通过。
- [x] `node --check core.js`：通过。
- [x] `node --check server\index.js`：通过。
- [ ] 真实 SillyTavern 浏览器 UI 中的设置面板显示、配置保存、自动重写和手动重写验证：仍需浏览器刷新后发送一次消息验证真实模型 B 调用。

## 后续工作注意事项

- 不要自动更新 Node.js。
- 不要将临时任务文件存储在 `D:\Agent\Agent_temp` 之外。
- 避免向 C 盘写入不必要的文件。
- 如果实现需要许多临时文件，请将它们放在 `D:\Agent\Agent_temp` 下。
- 如果需要删除两个以上文件，请先询问用户。
- 对于任何会修改文件的任务，最终回复中需要列出已更改的文件。
