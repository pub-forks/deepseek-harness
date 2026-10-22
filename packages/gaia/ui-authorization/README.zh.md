---
description: "Gaia 通用的浏览器登录设置页面。"
kind: "package-reference"
---

# @deepseek-ai/dsh-gaia-ui-authorization

[English](README.md) | 中文

## 概述

通过本地化的设置页面管理 OAuth 登录。页面列出已注册的 OAuth 流程，将秘密答案保存在输入状态，并支持设备码、问题、取消和确认退出。用户可为已安装的 OAuth 提供方创建独立账户路由；每条路由保留自己的凭据和 profile。

## 目录

- [使用本包](#use-this-package)
- [开发备注](#dev-note)
- [模型体验](#model-experience)
- [已知限制与延后工作](#known-limitations-and-deferred-work)

-----

<a id="use-this-package"></a>
## 使用

在 Gaia 覆盖层中与 Host 授权控制器一起安装。`dsh.client` 让浏览器自动加载插件。此页面仅列出 OAuth 流程；API 密钥提供方请在模型中配置。OpenAI Codex 的方式选择题默认选中设备码，同时保留手动粘贴回调的文本输入。

-----

<a id="dev-note"></a>
## 开发备注

无需运行时不变量伴随模块：插件注册和清理由现有 Cordis 服务或槽位生命周期管理。

-----

<a id="model-experience"></a>
## 模型体验

### Gaia 登录

#### 模型能看到什么

没有直接贡献；登录会改变 LLM 提供方在后续请求中使用的 `ctx.authorization` 凭据。

#### Token 影响

此包不增加请求 Token。

#### KV Cache 影响

此包不组装模型请求。

## 已知限制与延后工作

<a id="known-limitations-and-deferred-work"></a>

- 凭据服务没有账户或过期时间元数据，因此行只显示记录是否存在。
