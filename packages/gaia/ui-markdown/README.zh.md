---
description: "适用于 DSH 文档的 Gaia Markdown 和可编辑 .tasks 预览。"
kind: "package-reference"
---

# @deepseek-ai/dsh-gaia-ui-markdown

[English](README.md) | 中文

## 概述

使用 Gaia 的 Obsidian 风格渲染器预览 Markdown 文件，支持 GFM、Wiki 链接、frontmatter、语法高亮和 Mermaid 图表。`.tasks` 文件会显示并允许编辑任务状态、日期、步骤、备注和标签。这些渲染器只在 Gaia 覆盖层替换 DSH 内置 Markdown 预览；文件读取和任务写入通过 DSH Host Remote 处理，图片使用文件媒体路由，导航通过 Sidebar 资源操作完成。

## 目录

- [Use this package](#use-this-package)
- [Dev Note](#dev-note)
- [Model Experience](#model-experience)
- [Known Limitations and Deferred Work](#known-limitations-and-deferred-work)

-----

<a id="use-this-package"></a>
## Use this package

在 `packages/gaia/profile-gaia/gaia.patch.yml` 中挂载 `gaia-ui-markdown`。其 `extension` 优先级高于内置文档渲染器，键控的 `sidebar.right.tab.document` 贡献会在 DSH 显示文档预览的所有位置渲染 Markdown 和 `.tasks` 文件。Markdown 保持只读；`.tasks` 编辑通过带版本检查的 `gaiaTasks` Host Remote 完成，并保留预览未显示的字段。`.tasks` 备注以纯文本显示，图片通过经过认证的文件媒体路由加载。

remark 插件、frontmatter 解析器和 Wiki 链接路径助手均从 Gaia web 查看器复制而来。请保持这些副本与源文件同步。原始 HTML 会先解析，再使用 Gaia schema 消毒后渲染。Mermaid 不打包进插件：其异步分块无法通过客户端模块表加载。查看器向 Gaia 父页面发送 `renderMermaid {reqId, code, dark}`，由 Gaia 以 `securityLevel: 'strict'` 使用自身的 Mermaid 渲染，并回复 `mermaidRendered {reqId, svg | error}`；不在 Gaia 框架中、出错或超时（15 秒）时显示图表源码。客户端构建将 vfile 的 `#minpath`/`#minproc`/`#minurl` 映射到浏览器版本，确保包内不引用 Node 内置模块。

<a id="dev-note"></a>
## 开发备注

此包没有服务不变量 companion：definition 和键控 body 由插件 Cordis effects 注册并负责释放。

## Model Experience

### 文档预览

#### 模型所见

没有直接贡献。插件会渲染通过 `dsh-resource://file/...` 地址打开的 Markdown，不会添加 prompt 上下文。

#### Token effect

此包不增加请求 token。

#### KV Cache effect

此包不组装模型请求。

## Known Limitations and Deferred Work

- Markdown 编辑仍由 Gaia web 应用负责。
- `.tasks` 预览加载完整文件，超过文档预览完整读取上限的文件无法打开；截止日期、标签和备注在预览中只读，步骤只能勾选；编辑仍由 Gaia web 应用负责。
