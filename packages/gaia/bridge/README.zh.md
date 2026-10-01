---
description: "Gaia 用于 Workspace、Session 和运行活动的本机回环主机控制 API。"
kind: "package-reference"
---

# Gaia 控制桥

[English](README.md) | 中文

## 概述

`@deepseek-ai/dsh-gaia-bridge` 在主机 Web 服务器上注册 `/gaia/control/`，供 Gaia 服务器调用。请求必须来自本机回环地址，并携带 `Authorization: Bearer <GAIA_CONTROL_SECRET>`。插件激活时读取一次密钥；密钥缺失或少于 32 个字符时所有请求都返回 503。响应为 JSON，带有 `Cache-Control: no-store`；错误不包含调用栈，请求和响应正文不会写入日志。

## 目录

- [使用本包](#use-this-package)
- [开发备注](#dev-note)
- [模型体验](#model-experience)
- [已知限制与延后工作](#known-limitations-and-deferred-work)

-----

<a id="use-this-package"></a>
## 使用本包

在 Gaia Web 覆盖层中挂载此插件，并在 DSH 子进程环境中提供密钥。Workspace 接口为 `GET workspaces`（包含实时目录状态）、`POST workspaces/ensure { path, title? }` 和 `POST workspaces/rename { workspaceId, title }`；标题会去除首尾空格并限制为 120 个字符。其他接口包括 Session 创建/列表/重命名/归档/取消归档以及 `GET activity`。`GET/PUT config-document` 使用 YAML 验证、SHA-256 前置条件、1 MiB 文件上限和原子替换来编辑当前 profile patch。`GET profile-files` 只列出 `cordis.patch.yml`、`cordis.yml`、`package.json` 和 `pnpm-workspace.yaml`；`GET/PUT profile-files/:name` 读取或更新这些固定名称之一。文件写入使用 SHA-256 前置条件、格式验证和原子替换。现有路由请求体上限为 16 KiB，文档和 profile 文件写入为 1.25 MiB。

控制桥为抽屉和 Gaia Agent 的创建路径挂载工作区模型子插件。已提交的 `model/selection` 事件记录工作区的最新选择；限定于 `sessionController.create` 的装饰器通过公开的 `agents.create` setup 回调，在 API 路由初始化之前写入选择。分支、恢复、子 Agent 和已有显式选择均保留自身模型。目录查询或精确路由/推理力度验证失败时，静默使用正常默认值。自动恢复不会调用 `selectModel` 或保存全局默认值；显式选择保持上游行为。

`$DSH_HOME/gaia-workspace-models.json` 是以 Session 的规范化 cwd 为键的 JSON 对象，值为 `{ provider, model, reasoningEffort?, updatedAt }`（`updatedAt` 为 Unix 毫秒时间戳）。使用临时文件和原子替换，文件权限为 `0600`；缺失、不可读或损坏的文件按空记录处理。只保留最近的 500 个工作区，重载时也执行此限制。仅保存标识符，不记录凭据、正文或错误内容。写入按顺序执行，在 Session flush 和插件卸载时等待完成。

-----

<a id="dev-note"></a>
## 开发备注

无需运行时不变量伴随模块：路由注册和卸载由同一张 `webServer` 路由表管理，工作区偏好只有一个存储所有者。子插件卸载时恢复公开方法并移除观察器。

-----

<a id="model-experience"></a>
## 模型体验

### 主机控制

#### 模型看到的内容

新的普通 Session 使用工作区中仍可用的提供方、模型和推理力度。使用现有的 `model/selection` 日志事件，不增加提示文本。

#### 令牌影响

此包不增加请求令牌。

#### KV 缓存影响

此包选择初始路由；提示组装和缓存行为仍由上游模型选择路由管理。

## 已知限制与延后工作

<a id="known-limitations-and-deferred-work"></a>

- 在子目录打开的 Agent 使用独立的工作区偏好。偏好限定于每个用户的单个 DSH 运行时，不协调多个进程的写入。
- `GET activity` 会统计运行中的 Agent，但 Gateway 不公开实时浏览器事件流连接数。该接口返回 `attachedClients: 0` 和 `approximate: true`；当浏览器客户端可能仍连接时，Gaia 不能只凭该数值关闭运行时。
