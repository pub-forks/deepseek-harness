---
description: "归档由计划任务创建的已完成会话。"
kind: "package-reference"
---

# @deepseek-ai/dsh-gaia-schedule-archive

[English](README.md) | 中文

## 概述

当新目标计划任务投递所创建的 Agent 空闲且投递回合安全完成后，归档该新会话。失败、存在待处理交互、被用户接管或已固定的会话会保留。

## 目录

- [行为](#behavior)
- [开发备注](#dev-note)
- [模型体验](#model-experience)
- [已知限制与延后工作](#known-limitations-and-deferred-work)

-----

<a id="behavior"></a>
## 行为

插件会读取 Scheduler 回执和会话历史，然后更新 Workspace 归档注册表。只有计划任务回合已完成且没有未解决的审批或问题时才会归档；根据配置，失败回合会保留，会话固定后也不会归档。

<a id="dev-note"></a>
## 开发备注

控制器拥有 Schedule 和 Agent 监听器，并会在插件卸载时释放两者。

<a id="model-experience"></a>
## 模型体验

### 计划任务投递归档

#### 模型能看到什么

此插件不会添加模型可见的工具、提示词文本或会话事件。

#### Token 影响

此包不增加请求 Token。

#### KV Cache 影响

此包不组装模型请求。

<a id="known-limitations-and-deferred-work"></a>
## 已知限制与延后工作

- 重启扫描最多检查 100 个任务，以及每个任务最近 20 条、且在最近七天内的回执；回执保留期限和这些上限可能导致较早的会话继续显示。
