---
description: "Gaia 通用的浏览器登录设置页面。"
kind: "package-reference"
---

# @deepseek-ai/dsh-gaia-ui-authorization

[English](README.md) | 中文

## 概述

这个私有客户端插件在设置中注册本地化的登录页面。它仅展示提供 OAuth 的已注册流程；API 密钥提供方请在模型中配置。OAuth 登录支持通知、设备码、问题、取消和确认退出。秘密答案只保存在输入状态，并仅经 `answer` 发送。

此页面可以使用已安装的 OAuth 提供方、显示名称和安全路由标识创建独立账户路由。每个别名都会显示为单独的登录卡片；退出只删除对应凭据，删除账户则会同时移除其别名 profile。账户创建和删除控件提供英文和中文界面。

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
