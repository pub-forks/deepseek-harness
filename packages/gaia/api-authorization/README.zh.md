---
description: "Gaia 已认证的浏览器登录流程 Remote。"
kind: "package-reference"
---

# @deepseek-ai/dsh-gaia-api-authorization

[English](README.md) | 中文

## 摘要

这个私有 Host 插件通过已有 Cookie 保护的 API Gateway 暴露 `ctx.authorization` 流程。`listFlows` 只返回名称、方法、进行中状态和凭据记录是否存在；不会读取凭据载荷或记录答案。

## 目录

- [使用本包](#use-this-package)
- [开发备注](#dev-note)
- [模型体验](#model-experience)
- [已知限制与延后工作](#known-limitations-and-deferred-work)

-----

<a id="use-this-package"></a>
## 使用

在 Gaia 覆盖层中安装此插件。客户端安装生成的 `./remote` 贡献。`start` 输出通知、问题、撤回及最终结果；每项包含供 `answer` 和 `cancel` 使用的 `attemptId`。关闭流会取消尝试，同一 key 的第二次尝试收到 `busy`。`signOut` 只接受已注册流程的 key 并删除对应记录。

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

通用凭据记录服务没有账户或过期时间元数据，因此 `listFlows` 不返回这两个可选字段；此处不能检查不透明的授权载荷。
