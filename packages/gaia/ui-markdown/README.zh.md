---
description: "适用于 DSH 文档的 Gaia Obsidian 风格只读 Markdown 预览。"
kind: "package-reference"
---

# @deepseek-ai/dsh-gaia-ui-markdown

[English](README.md) | 中文

## Summary

此 Gaia 覆盖层插件会将 DSH 内置的 `.md` 和 `.markdown` 文档预览替换为 Gaia 的只读 Obsidian 风格渲染器。它使用 GFM、Gaia remark 插件与 frontmatter 解析器、Gaia 消毒 schema、Prism 高亮，以及由 Gaia 父页面渲染的 Mermaid 图表。Wiki 链接、相对文件链接和图片嵌入均以当前文档为基准解析；文件导航通过 Sidebar 资源操作完成。

## Table of Contents

- [Use this package](#use-this-package)
- [Dev Note](#dev-note)
- [Model Experience](#model-experience)
- [Known Limitations and Deferred Work](#known-limitations-and-deferred-work)

-----

<a id="use-this-package"></a>
## Use this package

在 `packages/gaia/profile-gaia/gaia.patch.yml` 中挂载 `gaia-ui-markdown`。其 `extension` 优先级高于内置文档渲染器，键控的 `sidebar.right.tab.document` 贡献会在 DSH 显示文档预览的所有位置生效。渲染器为只读：GFM 任务列表复选框保持禁用。文档读取仍由宿主负责，图片通过经过认证的文件媒体路由加载。

remark 插件、frontmatter 解析器和 Wiki 链接路径助手均从 Gaia web 查看器复制而来。请保持这些副本与源文件同步。原始 HTML 会先解析，再使用 Gaia schema 消毒后渲染。Mermaid 不打包进插件：其异步分块无法通过客户端模块表加载。查看器向 Gaia 父页面发送 `renderMermaid {reqId, code, dark}`，由 Gaia 以 `securityLevel: 'strict'` 使用自身的 Mermaid 渲染，并回复 `mermaidRendered {reqId, svg | error}`；不在 Gaia 框架中、出错或超时（15 秒）时显示图表源码。客户端构建将 vfile 的 `#minpath`/`#minproc`/`#minurl` 映射到浏览器版本，确保包内不引用 Node 内置模块。

## Dev Note

此包没有服务不变量 companion：definition 和键控 body 由插件 Cordis effects 注册并负责释放。

## Model Experience

### 文档预览

#### 模型所见

没有直接贡献。插件只改变 DSH 文档 Sidebar 中打开文件的浏览器渲染。

#### Token effect

此包不增加请求 token。

#### KV Cache effect

此包不组装模型请求。

## Known Limitations and Deferred Work

- 任务列表编辑和文档编辑仍由 Gaia web 应用负责。
