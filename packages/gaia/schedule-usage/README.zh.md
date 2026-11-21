---
description: "计划任务用量与模型成本仪表板的 Host 插件。"
kind: "package-bundle"
---

# @deepseek-ai/dsh-gaia-schedule-usage

[English](README.md) | 中文

## 概述

读取 Scheduler 保留的投递回执，查找每条已投递消息所属的会话回合，并展示提供方报告的 Token 用量及估算美元成本。此包包含 Client 仪表板。

## 目录

- [数据与定价](#data-and-pricing)
- [仪表板](#dashboard)
- [开发备注](#dev-note)
- [模型体验](#model-experience)
- [已知限制与延后工作](#known-limitations-and-deferred-work)

-----

<a id="data-and-pricing"></a>
## 数据与定价

Scheduler 仍是任务与投递历史的唯一来源。此插件不存储重复的任务、运行或会话数据，也不会返回已保存的任务提示词或无关会话内容。目标会话相同且消息 ID 相同的多条投递会作为一个共享批次展示，不会重复计入各个任务。

模型价格来自 OpenRouter 公开的 `https://openrouter.ai/api/v1/models` 目录。Host 会缓存成功获取的目录六小时，并报告其时间戳。成本使用当前目录价格，而非历史价格。模型先按精确 OpenRouter ID 匹配，再按 `provider/model` 匹配；对于裸模型名称，仅当 OpenRouter 中恰有一个 ID 的模型部分与之相同时才匹配。若多个供应商以不同价格提供该名称，则不标价。缺少价格时成本保持未标价；无法读取会话历史时用量保持未知。Token 数由提供方报告且彼此独立：未缓存输入按提示词价格计费，缓存读取和写入按 OpenRouter 缓存价格计费（未列出时使用提示词价格）。展示的 Token 总数包含缓存读取与写入。

Dashboard Remote 接受一个包含起止时间（`from`、`to`，均必填）的闭区间以及可选任务 ID；页面默认显示最近 30 个本地日历日和所有任务。Host 最多读取 50 个任务的回执（每个任务最多 1,000 条，按时间从新到旧，读取到范围起点为止），以保留与未选任务共享的批次；最多返回 500 个目录任务供筛选，每次刷新最多报告 250 条唯一投递。Scheduler 的历史保留策略仍然有效。若历史或响应上限导致数据省略，界面会提示。已结束回合的 Token 数会缓存在内存中（最多 2,000 条投递），因此后续刷新只会读取有新投递或仍在运行投递的会话。

<a id="dashboard"></a>
## 仪表板

Client 仪表板按本地闭区间日期范围和任务筛选投递，并展示提供方报告的 Token 数及估算美元成本。共享批次在任务总数中只计一次。

<a id="dev-note"></a>
## 开发备注

Host 和 Client 贡献通过此包的 Cordis 服务注册，并随各自插件生命周期释放。

<a id="model-experience"></a>
## 模型体验

### 计划任务用量

#### 模型能看到什么

此包不会添加模型可见的工具、提示词文本或会话事件。它只读取 Scheduler 回执和持久化会话用量，供用户仪表板显示。

#### Token 影响

此包不增加请求 Token。

#### KV Cache 影响

此包不组装模型请求。

<a id="known-limitations-and-deferred-work"></a>
## 已知限制与延后工作

- 投递用量归属于包含其计划任务消息的回合。成本使用当前 OpenRouter 价格，可能与提供方的实际账单不同。会话压缩或会话数据删除可能导致保留回执对应的用量不可用。
