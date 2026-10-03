---
description: "Gaia 的 /starred 命令，用于按顺序处理项目中的重要任务。"
kind: "package-reference"
---

# @deepseek-ai/dsh-gaia-command-starred

[English](README.md) | 中文

## 概述

`/starred` 向调用它的 agent（智能体）发送一条用户 follow-up，要求处理尚未完成的重要任务。插件不执行文件、shell 或网络操作。

## 目录

- [使用本包](#use-this-package)
- [开发备注](#dev-note)
- [模型体验](#model-experience)
- [已知限制与延期工作](#known-limitations-and-deferred-work)

<a id="use-this-package"></a>
## 使用本包

Gaia overlay 将此 Host 插件与命令服务一起挂载。插件没有配置字段。用法：`/starred [inline|subagent] [model] [--release]`。

输入按空白字符分词。任何位置完全匹配的 `--release` 都会启用发布请求。余下的第一个词不区分大小写地选择 `inline` 或 `subagent`；否则模式为 `subagent`。其余词以单个空格连接成模型名称。Inline 模式忽略模型名称。附件会被拒绝。

提示词通过 `.gaia/settings.json` 中的 `tasks.default` 定位任务文件，缺失时使用 `.ai/ToDo.tasks`。它只要求处理尚未完成的 `important: true` 任务，允许把相关任务分组，并要求在继续之前提交。Subagent 模式要求按顺序委派、审查和提交。每次提交后，它要求设置完成字段，并在写入前重新读取文件，保留其他所有任务和字段。`--release` 要求在所有星标任务提交后按照项目自身规则发布版本。

确认文本为 `starred: inline` 或 `starred: subagent [model] · sequential`，请求发布时追加 ` · release after`。意外的 follow-up 失败会传递给命令分发器。

<a id="dev-note"></a>
## 开发备注

[`src/index.ts`](src/index.ts) 导出解析器、提示词构建器、确认文本格式化函数和 Cordis 插件。插件卸载时注销命令。此插件没有可变状态或独立派生的观测值，因此不发布运行时不变式伴生入口。

<a id="model-experience"></a>
## 模型体验

### 星标任务 follow-up

#### 模型看到的内容

一条普通用户消息承载工作流程指令。Subagent 模式包含原文指令 `DO NOT RUN SUBAGENTS IN PARALLEL. WAIT FOR ONE TO FINISH -> REVIEW -> COMMIT -> NEXT TASK.`。斜杠输入和直接确认保留在命令 UI 中；follow-up 通过 agent 进入正常会话历史。

#### Token 影响

每条接受的命令增加一条文本消息，包含工作流程和可选的模型名称。被拒绝的附件不增加消息。

#### KV Cache 影响

follow-up 追加到正常对话历史中，不改变系统提示词或此前的消息。

## 已知限制与延期工作

<a id="known-limitations-and-deferred-work"></a>

- 命令提供指令；实际执行取决于 agent 可用的工具和权限。它不挂载 subagent provider，也不验证任务文件编辑、提交或发布。模型名称仅为提示词文本，不通过注册表验证。
