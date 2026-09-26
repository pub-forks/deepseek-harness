---
description: "Gaia 单会话对话视图的 iframe 嵌入客户端插件。"
kind: "package-reference"
---

# @deepseek-ai/dsh-gaia-ui-embed

[English](README.md) | 中文

## 概述

当页面带有指定单会话嵌入模式的查询参数加载时，此私有客户端插件激活。它隐藏导航与窗口外框，拦截导航快捷键，并管理与宿主父框架的 postMessage 桥接通信。

## 目录

- [使用本包](#use-this-package)
- [开发备注](#dev-note)
- [模型体验](#model-experience)
- [已知限制与延后工作](#known-limitations-and-deferred-work)

-----

<a id="use-this-package"></a>
## 使用

在 Gaia Web 配置文件补丁覆盖层中挂载该插件。仅当浏览器地址包含 `gaia=embed` 且附带有效 `session` 查询参数时激活。

-----

<a id="dev-note"></a>
## 开发备注

无需运行时不变量伴随模块：该插件的注册与清理均由现有的 Cordis 服务或副作用生命周期管理。

-----

<a id="model-experience"></a>
## 模型体验

### Gaia iframe 嵌入

#### 模型能看到什么

没有直接贡献；嵌入展示只调整带有 `data-gaia-embed` 的浏览器视口，不改变发送给模型的提示词。

#### Token 影响

此包不增加请求 Token。

#### KV Cache 影响

此包不组装模型请求。

## 已知限制与延后工作

<a id="known-limitations-and-deferred-work"></a>

- 嵌入模式下保持禁用全屏右侧栏动作，以适配单面板抽屉交互。
