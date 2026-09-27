---
description: "Gaia 单会话对话视图的 iframe 嵌入客户端插件。"
kind: "package-reference"
---

# @deepseek-ai/dsh-gaia-ui-embed

[English](README.md) | 中文

## 概述

此私有客户端插件支持两种 Gaia iframe 模式。两种模式都会通过经过验证的 postMessage 桥接接收 Gaia 主题、调色板和视觉样式。嵌入模式还会将单个会话显示为抽屉聊天并隐藏外框；完整模式保留 DSH 的全部外框，包括导航和设置。

## 目录

- [使用本包](#use-this-package)
- [开发备注](#dev-note)
- [模型体验](#model-experience)
- [已知限制与延后工作](#known-limitations-and-deferred-work)

-----

<a id="use-this-package"></a>
## 使用

在 Gaia Web 配置文件补丁覆盖层中挂载该插件。iframe 地址为 `gaia=embed`（并带有效 `session` 才启用聊天行为）或 `gaia=full`（完整外框）时插件激活；顶层窗口中不会激活。两种模式都会发送一次 `ready` 并接受经过验证的同源主题消息；只有嵌入模式会打开并固定会话、隐藏导航外框，并启用抽屉专用命令和控件。

-----

<a id="dev-note"></a>
## 开发备注

无需运行时不变量伴随模块：该插件的注册与清理均由现有的 Cordis 服务或副作用生命周期管理。

-----

<a id="model-experience"></a>
## 模型体验

### Gaia iframe 模式

#### 模型能看到什么

没有直接贡献。两种模式都会应用 Gaia 视觉样式；嵌入模式还会调整带有 `data-gaia-embed` 的视口，不改变发送给模型的提示词。

#### Token 影响

此包不增加请求 Token。

#### KV Cache 影响

此包不组装模型请求。

## 已知限制与延后工作

<a id="known-limitations-and-deferred-work"></a>

- 嵌入模式下保持禁用全屏右侧栏动作，以适配单面板抽屉交互。
