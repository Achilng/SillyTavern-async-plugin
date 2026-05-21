# AGENTS.md

## 需求目的

本仓库用于整理和开发一个 SillyTavern 回复后处理方案：模型 A 正常生成回复后，由独立配置的模型 B 仅读取最后一条回复，并按自定义提示词进行润色或重写，再替换原回复。实现时应优先采用 UI Extension + Server Plugin 的组合，以便隔离聊天上下文并避免在前端暴露模型 B 的 API key。

## 需求原文
需要做一个 SillyTavern 扩展插件，让当前正常聊天流程先照常由“模型 A”生成回复。模型 A 使用 SillyTavern 原本配置的默认 API、模型和预设。

当模型 A 完成一次正常回复后，插件自动触发第二次调用：调用“模型 B”。模型 B 的 `base URL`、`API key`、模型名等参数要能在插件里单独配置，不能依赖 SillyTavern 当前默认连接。

模型 B 只允许看到“最后一条模型 A 刚生成的回复”，再加上用户自定义的改写提示词。它不能拿到完整聊天上下文、角色卡、世界书、历史消息等内容。

模型 B 的任务不是继续对话，而是改写/润色/增强这最后一条回复，比如增强文学风格、改善表达、统一文风。完成后，插件应把原本最后一条回复替换成模型 B 改写后的版本，最好不是新增一条消息。

我接下来会基于你给的 SillyTavern UI Extensions 文档判断这个需求能否实现，以及实现时应该走“纯前端扩展”还是需要额外后端/代理。文档入口我已打开：<https://docs.sillytavern.app/for-contributors/writing-extensions/>

## 参考文档

- SillyTavern UI Extensions：<https://docs.sillytavern.app/for-contributors/writing-extensions/>，用于参考前端扩展结构、事件监听、聊天数据访问和 UI 设置面板写法。
- SillyTavern Server Plugins：<https://docs.sillytavern.app/for-contributors/server-plugins/>，用于参考后端插件结构、Express 路由注册、服务端 API 调用和敏感配置处理。

## 项目文档
- `PLAN.md` 是本地开发实施计划书，不随仓库上传；如果本地存在，应先阅读后再写代码。
- `PROGRESS.md` 是本地开发进度记录，不随仓库上传；如果本地存在，应先阅读并在需要时更新。此文档应当频繁更新。