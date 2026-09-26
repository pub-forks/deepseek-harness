---
description: "Gaia 用于 Workspace、Session 和运行活动的本机回环主机控制 API。"
kind: "package-reference"
---

# Gaia 控制桥

[English](README.md) | 中文

## 概述

`@deepseek-ai/dsh-gaia-bridge` 在主机 Web 服务器上注册 `/gaia/control/`，供 Gaia 服务器调用。请求必须来自本机回环地址，并携带 `Authorization: Bearer <GAIA_CONTROL_SECRET>`。插件激活时读取一次密钥；密钥缺失或少于 32 个字符时所有请求都返回 503。响应为 JSON，带有 `Cache-Control: no-store`；错误仅包含简短代码。

## 目录

- [使用本包](#use-this-package)
- [开发备注](#dev-note)
- [模型体验](#model-experience)
- [已知限制与延后工作](#known-limitations-and-deferred-work)

-----

<a id="use-this-package"></a>
## 使用本包

在 Gaia Web 覆盖层中挂载此插件，并在 DSH 子进程环境中提供密钥。`GET health` 返回就绪状态和版本。`POST workspaces/ensure` 对现有目录的绝对路径进行 realpath 解析，并返回持久 Workspace ID。`POST sessions` 在已知 Workspace 中创建 Session，并可设置标题。`GET sessions?workspaceId=` 列出该 Workspace 的 Session。`POST sessions/:id/rename` 修改标题；`POST sessions/:id/archive` 使用注册表的归档操作并停止活动。JSON 请求体上限为 16 KiB。

-----

<a id="dev-note"></a>
## 开发备注

无需运行时不变量伴随模块：路由注册和卸载由同一张 `webServer` 路由表管理。

-----

<a id="model-experience"></a>
## 模型体验

### 主机控制

#### 模型看到的内容

无直接贡献；`/gaia/control/` 路由不向模型请求写入内容。

#### 令牌影响

此包不增加请求令牌。

#### KV 缓存影响

此包不组装或发送模型请求。

## 已知限制与延后工作

<a id="known-limitations-and-deferred-work"></a>

- `GET activity` 会统计运行中的 Agent，但 Gateway 不公开实时浏览器事件流连接数。该接口返回 `attachedClients: 0` 和 `approximate: true`；当浏览器客户端可能仍连接时，Gaia 不能只凭该数值关闭运行时。

