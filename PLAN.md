# Reply Polisher 实施计划

> **给未来的代理：** 这是 SillyTavern 回复后处理插件的工作实施计划。完成工作后请勾选对应步骤，并在做出决策或实现状态发生变化时更新 `PROGRESS.md`。

**目标：** 构建一个 SillyTavern UI 扩展 + 服务器插件，通过一个独立配置的 OpenAI 兼容模型 B 重写最新的模型回复，然后原地替换原始回复。

**架构：** UI 扩展负责面向用户的行为、事件监听、提示词设置和消息替换。服务器插件负责敏感的模型 B 连接设置，并执行实际的 OpenAI 兼容 API 调用，以确保 API key 不存储在前端设置中。

**兼容目标：** 匹配 SillyTavern 的 `custom` OpenAI 兼容连接方式：`base URL`、`API key`、`model`、Chat Completions 请求格式。

---

## 已确认设计

- 使用 `UI Extension + Server Plugin`。
- 模型 A 保持 SillyTavern 正常配置的生成流程。
- 模型 B 在此插件内独立配置。
- 前端设置面板可以接受模型 B 连接字段，但 API key 会提交给服务器插件，并且不会返回给前端。
- 重写提示词存储在前端扩展设置中，因为它面向用户，应便于编辑和导出。
- 服务器插件在重写调用时只接收 `prompt` 和 `text`。
- 模型 B 不得接收聊天历史、角色卡、世界信息或其他 SillyTavern 上下文。
- 重写失败时保留原始模型 A 回复，并显示错误通知。
- 继续/追加生成不在自动处理范围内。

## 触发规则

处理：
- 普通助手回复。
- 重新生成 / swipe 回复。
- 手动重写当前最新助手回复。

不处理：
- 用户消息。
- 系统/小型系统消息。
- 继续/追加生成。
- 已被此插件标记为处理过的消息。

## 计划文件布局

实际安装路径应在开始实现时遵循 SillyTavern 的扩展和服务器插件约定。

- `public/scripts/extensions/third-party/reply-polisher/manifest.json`
  - UI 扩展元数据。
- `public/scripts/extensions/third-party/reply-polisher/index.js`
  - 扩展入口点、设置加载、事件订阅、重写编排。
- `public/scripts/extensions/third-party/reply-polisher/settings.html`
  - 设置面板标记。
- `public/scripts/extensions/third-party/reply-polisher/style.css`
  - 最小化设置面板样式。
- `plugins/reply-polisher/index.js`
  - 服务器插件入口点和 Express 路由注册。
- `plugins/reply-polisher/config.json`
  - 服务器端模型 B 设置。不得提交真实密钥。
- `plugins/reply-polisher/config.example.json`
  - 不包含密钥的示例配置。
- `plugins/reply-polisher/README.md`
  - 安装、启用、配置和故障排除说明。

## 任务

### 任务 1：验证 SillyTavern 集成点

- [x] 检查已安装的 SillyTavern 版本和扩展文件夹结构。
- [x] 确认 UI 扩展的导入路径：
  - `eventSource`
  - `event_types`
  - `getContext`
  - `saveSettingsDebounced`
  - `updateMessageBlock`
  - 聊天保存辅助函数，可能是 `saveChatConditional` 或当前等价函数。
- [x] 确认服务器插件启用要求：`enableServerPlugins`。
- [x] 确认服务器插件路由基础路径：`/api/plugins/reply-polisher`。
- [x] 在 `PROGRESS.md` 中记录任何版本特定差异。

### 任务 2：搭建 UI 扩展骨架

- [x] 创建 UI 扩展文件夹和 manifest。
- [x] 创建包含两个部分的 `settings.html`：
  - 模型 B 连接。
  - 重写行为。
- [x] 创建 `style.css`，使用克制且兼容 SillyTavern 的样式。
- [x] 创建 `index.js` 入口点。
- [x] 加载默认前端设置：
  - `enabled`
  - `autoRewrite`
  - `rewritePrompt`
  - `timeoutMs`
  - `temperature`
  - `maxTokens`
- [x] 使用 SillyTavern 扩展设置持久化前端设置。
- [x] 验证设置面板会显示，并且重新加载后数值仍然保留。

### 任务 3：搭建服务器插件骨架

- [x] 创建服务器插件文件夹和入口点。
- [x] 在 `/api/plugins/reply-polisher` 下注册 Express 路由。
- [x] 添加配置加载/保存辅助函数。
- [x] 存储以下后端设置：
  - `baseUrl`
  - `apiKey`
  - `model`
- [x] 确保 `GET /settings` 只返回：
  - `baseUrl`
  - `model`
  - `hasApiKey`
- [x] 确保真实 API key 永远不会返回给前端。
- [x] 验证 SillyTavern 启动后路由已注册。

### 任务 4：实现后端模型 B 调用

- [x] 规范化 `baseUrl`，使请求指向 `{baseUrl}/chat/completions`，且不会出现重复斜杠。
- [x] 实现 OpenAI 兼容的 Chat Completions 请求：

```json
{
  "model": "configured-model",
  "messages": [
    {
      "role": "system",
      "content": "You rewrite only the provided text. Do not continue the conversation. Do not add explanations."
    },
    {
      "role": "user",
      "content": "Rewrite instructions:\\n{prompt}\\n\\nText to rewrite:\\n{text}"
    }
  ],
  "temperature": 0.7,
  "max_tokens": 1024
}
```

- [x] 设置请求超时，并把超时作为可配置项传入后端。
- [x] 校验 `prompt` 和 `text` 都是非空字符串。
- [x] 校验后端配置完整：`baseUrl`、`apiKey`、`model`。
- [x] 解析 `choices[0].message.content` 作为重写文本。
- [x] 当响应非 2xx、返回结构异常或重写文本为空时返回明确错误。
- [x] 确保错误响应不包含 API key。
- [x] 合并并发的相同 `/rewrite` 请求，避免重复前端实例同时调用模型 B。

### 任务 5：实现前端设置 UI 和后端设置联动

- [x] 在设置面板中显示：
  - 启用插件。
  - 自动重写。
  - 模型 B `base URL`。
  - 模型 B `model`。
  - 模型 B `API key` 输入框。
  - 重写提示词。
  - `timeoutMs`、`temperature`、`maxTokens`。
- [x] 读取后端 `/settings`，只显示 `hasApiKey` 状态，不回显密钥。
- [x] 保存模型 B 连接设置时调用后端 `/settings`。
- [x] 保存前端行为设置时调用 `saveSettingsDebounced()`。
- [x] 提供“测试连接/手动重写最新回复”按钮。

### 任务 6：实现前端重写编排

- [x] 监听 `GENERATION_STARTED` 捕获生成开始前的最新助手回复身份。
- [x] 监听 `MESSAGE_RECEIVED` 标记本次模型 A 已实际收到的目标回复。
- [x] 监听 `CHARACTER_MESSAGE_RENDERED`，仅当同一条消息已先收到 `MESSAGE_RECEIVED` 时触发自动润色。
- [x] 不再用 `GENERATION_ENDED` 或 `MESSAGE_SWIPED` 发起自动润色，避免 swipe 按钮状态切换导致提前处理和重复调用模型 B。
- [x] 跳过用户消息、系统消息、小型系统消息、空消息和已处理消息。
- [x] 跳过 `continue` 类型事件，避免处理追加生成。
- [x] 捕获目标消息快照：
  - 当前聊天 ID。
  - 消息 ID。
  - 原始 `mes`。
  - 当前 `swipe_id`。
- [x] 调用后端 `/rewrite` 时只发送 `prompt`、`text`、`temperature`、`maxTokens`、`timeoutMs`。
- [x] 后端成功返回后再次校验快照，防止用户切换聊天、编辑消息或改变 swipe。
- [x] 原地替换 `message.mes`，并同步当前 `swipes[swipe_id]` 和 `swipe_info[swipe_id].extra`。
- [x] 在 `message.extra.reply_polisher` 中记录处理标记，避免重复自动处理。
- [x] 使用全局运行锁避免同一页面重复扩展实例并发调用同一条回复。
- [x] 为润色尝试编号，提示显示 `正在润色N`、`成功N`、`失败N`，便于排查重复触发来源。
- [x] 调用 `updateMessageBlock()` 重新渲染，并调用 `saveChat()` 保存聊天。
- [x] 失败时保留原文并显示 `toastr.error`。

### 任务 7：测试和静态验证

- [x] 为后端配置脱敏、URL 规范化、请求体、错误处理编写 Node 测试。
- [x] 为前端核心消息筛选、快照校验、消息替换逻辑编写可在 Node 中运行的纯函数测试。
- [x] 运行所有测试。
- [x] 运行 JavaScript 语法检查。
- [x] 手动核对关键文件路径与 SillyTavern 1.14.0 结构一致。

### 任务 8：文档和安装说明

- [x] 编写 `plugins/reply-polisher/README.md`。
- [x] 编写 `plugins/reply-polisher/config.example.json`。
- [x] 编写不含真实密钥的 `plugins/reply-polisher/config.json` 初始文件。
- [x] 在 README 中说明需要在 SillyTavern `config.yaml` 中启用 `enableServerPlugins: true`。
- [x] 在 README 中说明 UI 扩展和服务器插件的安装路径。
- [x] 更新 `PROGRESS.md` 的实施进度和版本特定差异。
