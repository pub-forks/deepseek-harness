---
description: "Gaia 在内置 web 配置之上应用的补丁覆盖层。"
kind: "package-reference"
---

# Gaia Web 配置覆盖层

[English](README.md) | 中文

## 概述

Gaia 使用指向 `gaia.patch.yml` 的 `--patch` 启动内置 `web` 配置。覆盖层将主机绑定到本机回环地址，打印带令牌的 URL 而不打开浏览器，关闭 HMR 和产品遥测，并挂载 Gaia 控制桥、授权 Remote 和浏览器登录页面。基础组合包已经将 Session JSONL 存在 `$DSH_HOME/sessions` 下。覆盖层不修改 `llm-pi-ai` 行，因为覆盖层的优先级高于“设置 → 模型”所编辑的配置补丁；控制桥改为在配置未声明任何 pi-ai 提供方时，将使用已存 OAuth 凭据的 `openai-codex` 路由写入配置一次。若用户尚未设置 `enabled`，控制桥也会在用户 profile 中将会话日志上传设为关闭。要重新启用上传，请在 `$DSH_HOME/profiles/<name>/cordis.patch.yml` 的 `session-log-deepseek` 行设置 `enabled: true`；Plugins 页面不提供此行的配置。

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
