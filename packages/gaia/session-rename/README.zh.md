---
description: "使用 /rename 或明确的用户请求重命名当前 Gaia Harness 会话。"
kind: "package-reference"
---

# @deepseek-ai/dsh-gaia-session-rename

[English](README.md) | 中文

## 概述

此 Gaia Host 插件注册 `/rename [title]` 命令和 `rename_session` 模型工具。两者都通过 `SessionTitleService` 写入用户来源的标题；模型工具只能操作调用它的 agent 当前会话，并且要求当前轮次有直接的人类输入。

## 目录

- [使用本包](#use-this-package)
- [开发备注](#dev-note)
- [模型体验](#model-experience)
- [已知限制与延期工作](#known-limitations-and-deferred-work)

<a id="use-this-package"></a>
## 使用本包

Gaia overlay 将此 Host 插件与命令和工具服务一起挂载。插件没有配置项。`/rename [title]` 接受自由格式标题。提供标题时会先规范化，然后立即应用；输入为空时会要求 agent 根据对话提出简洁标题，并使用 `rename_session` 应用。附件会被拒绝。

`rename_session` 工具只接受 `title`。标题服务会规范化有效文本，并拒绝不含可见字符的标题。工具调用要求当前活动的顶层 agent 在本轮收到用户来源的消息，因此自主续接轮次和子 agent 不能重命名会话。工具使用注册表的独占执行模式，不添加权限覆盖。

<a id="dev-note"></a>
## 开发备注

[`src/index.ts`](src/index.ts) 注册 Host 命令和模型工具。服务依赖列在 [`tests/cordis.yml`](tests/cordis.yml) 中。此包不拥有可变状态或独立派生的观测值，因此不发布运行时不变式入口。

<a id="model-experience"></a>
## 模型体验

### 明确重命名会话

#### 模型看到的内容

工具说明限制 `rename_session` 只能响应用户的明确请求或确认，参数 schema 只接受标题。

##### 工具输入

```markdown
Use `rename_session` only when the user explicitly asks to rename or title this session, or confirms a proposed title. The tool accepts one required string field, `title`, and no session identifier.
```

##### 空命令 follow-up

```markdown
Propose a concise title for this session based on our conversation, then apply it with `rename_session`.
```

#### Token 影响

工具不会添加模型可见消息。标题服务会记录 `session/title` 事件。空命令会添加一条用户 follow-up；直接执行 `/rename title` 不会添加消息。

#### KV Cache 影响

重命名不会改变系统提示词或此前的对话消息。follow-up 形式会追加到普通历史中。

## 已知限制与延期工作

<a id="known-limitations-and-deferred-work"></a>

- `/rename [title]` 是直接的用户命令，不需要模型轮次。模型工具仍受当前轮次的明确人类授权限制。
