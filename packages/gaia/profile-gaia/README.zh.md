---
description: "Gaia 在内置 web 配置之上应用的补丁覆盖层。"
kind: "package-reference"
---

# Gaia Web 配置覆盖层

[English](README.md) | 中文

## 概述

启动 DSH 的 `web` profile，并启用 Gaia 品牌、浏览器登录和控制桥。补丁将服务绑定到本机回环地址，并让“设置 → 模型”通过用户 profile 修改提供方设置。若没有 pi-ai 路由，控制桥只写入一次使用 OAuth 的 `openai-codex` 路由；当 profile 未启用会话日志上传时，控制桥会将其关闭。

## 目录

- [使用本包](#use-this-package)
- [开发备注](#dev-note)
- [模型体验](#model-experience)
- [已知限制与延后工作](#known-limitations-and-deferred-work)

-----

<a id="use-this-package"></a>
## 使用本包

启动器接收 `--profile web --patch <gaia.patch.yml 的绝对路径> --port 0 --no-open`。`--patch` 是启动器参数，位于 Web 应用参数之前。Gaia 服务器在子进程环境中提供 `DSH_HOME` 和 `GAIA_CONTROL_SECRET`。

-----

现有控制桥同时为抽屉和 Agent 的新 Session 启用[工作区模型记忆](../bridge/README.zh.md#use-this-package)。

<a id="dev-note"></a>
## 开发备注

无需运行时不变量伴随模块：此包导出补丁文件和文件名常量，不提供可变服务。

-----

<a id="model-experience"></a>
## 模型体验

### 配置覆盖层

#### 模型看到的内容

无直接贡献；`gaia.patch.yml` 只选择由其他插件提供的内容。

#### 令牌影响

此包不增加请求令牌。

#### KV 缓存影响

此包不组装或发送模型请求。

## 已知限制与延后工作

<a id="known-limitations-and-deferred-work"></a>

- 此覆盖层只提供主机控制 API；浏览器登录和 Session 嵌入插件由其他包提供。
