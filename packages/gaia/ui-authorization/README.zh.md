---
description: "Gaia 通用的浏览器登录设置页面。"
kind: "package-reference"
---

# @deepseek-ai/dsh-gaia-ui-authorization

[English](README.md) | 中文

## 摘要

这个私有客户端插件在设置中注册本地化的登录页面。它通过 Gaia Remote 展示所有已注册授权流程的通知、设备码、问题、取消和确认退出。秘密答案只保存在输入状态，并仅经 `answer` 发送。

## 目录

- [使用本包](#use-this-package)
- [开发备注](#dev-note)
- [模型体验](#model-experience)
- [已知限制与延后工作](#known-limitations-and-deferred-work)

-----

<a id="use-this-package"></a>
## 使用

在 Gaia 覆盖层中与 Host 授权控制器一起安装。`dsh.client` 让浏览器自动加载插件。提供设备码方式时优先使用；Codex 的方式选择题默认选中设备码，同时保留手动粘贴回调的文本输入。

-----

<a id="dev-note"></a>
## 开发备注

无需运行时不变量伴随模块：插件注册和清理由现有 Cordis 服务或槽位生命周期管理。

-----

<a id="model-experience"></a>
## 模型体验

### Gaia 登录

#### 模型能看到什么

没有直接贡献；登录会改变 LLM 提供方在后续请求中使用的凭据。

#### Token 影响

此包不增加请求 Token。

#### KV Cache 影响

此包不组装模型请求。

<a id="known-limitations-and-deferred-work"></a>
## 已知限制与延后工作

凭据服务没有账户或过期时间元数据，因此行只显示记录是否存在。
