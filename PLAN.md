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

- [ ] 检查已安装的 SillyTavern 版本和扩展文件夹结构。
- [ ] 确认 UI 扩展的导入路径：
  - `eventSource`
  - `event_types`
  - `getContext`
  - `saveSettingsDebounced`
  - `updateMessageBlock`
  - 聊天保存辅助函数，可能是 `saveChatConditional` 或当前等价函数。
- [ ] 确认服务器插件启用要求：`enableServerPlugins`。
- [ ] 确认服务器插件路由基础路径：`/api/plugins/reply-polisher`。
- [ ] 在 `PROGRESS.md` 中记录任何版本特定差异。

### 任务 2：搭建 UI 扩展骨架

- [ ] 创建 UI 扩展文件夹和 manifest。
- [ ] 创建包含两个部分的 `settings.html`：
  - 模型 B 连接。
  - 重写行为。
- [ ] 创建 `style.css`，使用克制且兼容 SillyTavern 的样式。
- [ ] 创建 `index.js` 入口点。
- [ ] 加载默认前端设置：
  - `enabled`
  - `autoRewrite`
  - `rewritePrompt`
  - `timeoutMs`
  - `temperature`
  - `maxTokens`
- [ ] 使用 SillyTavern 扩展设置持久化前端设置。
- [ ] 验证设置面板会显示，并且重新加载后数值仍然保留。

### 任务 3：搭建服务器插件骨架

- [ ] 创建服务器插件文件夹和入口点。
- [ ] 在 `/api/plugins/reply-polisher` 下注册 Express 路由。
- [ ] 添加配置加载/保存辅助函数。
- [ ] 存储以下后端设置：
  - `baseUrl`
  - `apiKey`
  - `model`
- [ ] 确保 `GET /settings` 只返回：
  - `baseUrl`
  - `model`
  - `hasApiKey`
- [ ] 确保真实 API key 永远不会返回给前端。
- [ ] 验证 SillyTavern 启动后路由已注册。

### 任务 4：实现后端模型 B 调用

- [ ] 规范化 `baseUrl`，使请求指向 `{baseUrl}/chat/completions`，且不会出现重复斜杠。
- [ ] 实现 OpenAI 兼容的 Chat Completions 请求：

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