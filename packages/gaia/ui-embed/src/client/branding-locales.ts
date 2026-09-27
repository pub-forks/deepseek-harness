import type { LocaleService } from '@deepseek-ai/dsh-client-locale/client'

type LocaleOverrides = Record<string, Partial<Record<'en' | 'zh', Record<string, string>>>>

/** Localized product-name copy used by the full Harness shell. */
export const GAIA_LOCALE_OVERRIDES: LocaleOverrides = {
  'settings.agentPreset': {
    en: {
      sectionIntro: 'Choose the agent’s tools and how it works. Use Standard mode for everyday tasks, or Creator mode to add capabilities to Gaia Harness.',
      presetCordisDescription: 'Customize Gaia Harness through conversation. Let the agent write plugins that add features or UI, or combine tools and prompts to create your own mode.',
      guideCordisExplanation: [
        '### What you can create',
        'Creator mode includes the standard task tools plus runtime inspection, persistent plugin management, and guidance for authoring Cordis plugins and agent presets. It can create a plugin that adds a capability or UI, or a preset that combines tools and prompts for a particular job.',
        '### Plugins and modes',
        'A plugin adds capabilities to Gaia Harness, such as a tool, a service connection, or a UI entry. A mode is an agent preset that selects tools and defines how the agent works in a task. A plugin can be included in a custom preset.',
        '### How the result takes effect',
        'Ask the agent to install and verify the result, not just generate source code. A plugin may load immediately or require a restart, depending on what it changes. A newly created preset is selected when starting a new task.',
      ].join('\n\n'),
      guideCordisUsage: [
        '### Add a UI',
        '> Create a Gaia Harness plugin that adds a project notes entry to the sidebar. Let me browse the Markdown files in this workspace and preview a selected note. Install it and verify that the page opens.',
        'Expected output: an installed plugin with a working entry and preview page, plus any remaining activation steps.',
        '### Add a tool',
        '> Create a plugin with a tool that reads this project’s test report and summarizes the failed tests. Register it and verify it with a sample report.',
        'Expected output: a plugin with a callable tool and a verified sample call.',
        '### Create my own mode',
        '> Create a “Code review” mode based on Standard mode. Have it prioritize potential bugs and test gaps, cite file paths and lines, and ask before modifying files. Save it as a selectable preset.',
        'Expected output: a custom preset for new tasks. These review instructions guide the agent; permission settings determine which actions it can execute.',
      ].join('\n\n'),
    },
    zh: {
      sectionIntro: '选择 Agent 的工具和工作方式。日常任务用「标准模式」，扩展 Gaia Harness 的能力用「创造模式」。',
      presetCordisDescription: '通过对话定制 Gaia Harness：让 Agent 编写插件来添加功能或界面，也可以组合工具和提示词，创建自己的模式。',
      guideCordisExplanation: [
        '### 可以创造什么',
        '创造模式具备标准任务工具，并增加运行时检查、持久化插件管理，以及 Cordis 插件和 Agent 预设的开发指引。可以编写插件来添加功能或界面，也可以组合工具和提示词，创建适合特定任务的模式。',
        '### 插件与模式的关系',
        '插件为 Gaia Harness 增加能力，例如工具、服务连接或界面入口。模式是一份 Agent 预设，用来选择任务可用的工具，并约定 Agent 的工作方式。自定义模式中也可以使用自己开发的插件。',
        '### 怎样让成果生效',
        '可以要求 Agent 完成安装并验证实际效果。插件可能即时加载，也可能需要重启，取决于修改内容；新建的模式在创建新任务时选择。',
      ].join('\n\n'),
      guideCordisUsage: [
        '### 添加一个界面',
        '> 帮我编写一个 Gaia Harness 插件，在侧栏增加「项目笔记」入口，列出当前工作区的 Markdown 文件，点击后能预览内容。完成安装并验证页面能打开。',
        '预期产出：带侧栏入口和预览页的插件，以及仍需完成的生效步骤。',
        '### 添加一个工具',
        '> 写一个插件，提供读取项目测试报告、汇总失败用例的工具。注册工具，并用一份示例报告验证调用结果。',
        '预期产出：可调用的新工具，以及一次示例调用的验证结果。',
        '### 创建自己的模式',
        '> 基于标准模式创建「代码审查」模式，优先检查潜在错误和测试缺口，指出文件与行号，修改文件前先询问我。保存成可选择的预设。',
        '预期产出：可在新任务中选择的自定义预设。审查要求用于指导 Agent，实际可执行的操作仍由权限设置决定。',
      ].join('\n\n'),
    },
  },
  'settings.account': {
    en: {
      onboardingBrand: 'Gaia Harness',
      onboardingIntroduction: 'Gaia Harness works in a local folder and uses tools to read and write files on your computer. It can help you research and organize information, create documents and spreadsheets, write code, troubleshoot issues, and more.',
      onboardingProcessDescription: 'This only changes how progress is shown, not what Gaia Harness can do.',
      backToHarness: 'Back to Gaia Harness',
    },
    zh: {
      onboardingBrand: 'Gaia Harness',
      onboardingIntroduction: 'Gaia Harness 会以本地文件夹作为工作区，通过调用各种工具，读写本机文件，完成搜索整理资料、制作文档表格、编写代码、排查问题等各种任务。',
      onboardingProcessDescription: '这只会影响工作过程的展示方式，不会影响 Gaia Harness 的工作能力。',
      backToHarness: '返回 Gaia Harness',
    },
  },
  'settings.models': {
    en: {
      welcomeBody: 'Gaia Harness 0.1 is being tested with Harness developers. Many areas still need improvement, and we welcome feedback from the developer community. Gaia Harness’s core plugins and foundational APIs will continue to evolve rapidly over the coming months.\n\nWe look forward to exploring the limits of intelligence with developers around the world, building on open-source, open, reusable, and composable infrastructure. We welcome Harness developers everywhere to join the Gaia Harness plugin ecosystem.',
    },
    zh: {
      welcomeBody: 'Gaia Harness 0.1 目前仍面向 Harness 开发者测试。产品还有许多方面需要持续改进，我们欢迎开发者社区提供反馈。未来几个月，Gaia Harness 的核心插件和基础 API 仍将快速迭代。\n\n我们期待与全球开发者携手，在开源、开放、可复用、可组合的基础设施之上，共同探索智能上限。欢迎各地的 Harness 开发者加入 Gaia Harness 插件生态。',
    },
  },
  model: {
    en: {
      'error.sessionInUse': 'This session is already in use, possibly by another Gaia Harness instance (such as another browser session or the desktop app). Quit the other Gaia Harness instance and try again.',
    },
    zh: {
      'error.sessionInUse': '当前会话已被占用，可能是另一个 Gaia Harness 实例正在运行（例如其他浏览器会话或桌面端）。请退出另一个 Gaia Harness 实例后重试。',
    },
  },
  conversation: {
    en: {
      'error.sessionInUse': 'This session is already in use, possibly by another Gaia Harness instance (such as another browser session or the desktop app). Quit the other Gaia Harness instance and try again.',
    },
    zh: {
      'error.sessionInUse': '当前会话已被占用，可能是另一个 Gaia Harness 实例正在运行（例如其他浏览器会话或桌面端）。请退出另一个 Gaia Harness 实例后重试。',
    },
  },
  pluginManager: {
    en: {
      installGuideSafety: 'Install only plugins you trust: they run with your permissions and can damage Gaia Harness or leak your data.',
      reasonIncompatibleVersion: '{plugin} is incompatible with Gaia Harness {runtime} (requires {peers}); running it may cause crashes or data loss. Install a plugin version compatible with this Gaia Harness.',
      reasonIncompatibleVersionUnnamed: 'This plugin is incompatible with the running Gaia Harness version; running it may cause crashes or data loss.',
    },
    zh: {
      installGuideSafety: '请确认插件来源可信。插件会在本机以你的权限运行，来源不明的插件可能损坏 Gaia Harness，或读取和泄露你的数据。',
      reasonIncompatibleVersion: '{plugin} 与 Gaia Harness {runtime} 不兼容（要求 {peers}），运行它可能导致崩溃或数据丢失。请安装与当前 Gaia Harness 兼容的插件版本。',
      reasonIncompatibleVersionUnnamed: '这个插件与当前运行的 Gaia Harness 版本不兼容，运行它可能导致崩溃或数据丢失。',
    },
  },
  sidebarBrowser: {
    en: { 'error.application-origin': 'The embedded browser cannot open the Gaia Harness application itself.' },
    zh: { 'error.application-origin': '不能在嵌入式浏览器中打开 Gaia Harness 应用本身。' },
  },
  sidebarOffice: {
    en: { unavailable: 'Office previews are unavailable. Enable the document preview service on the computer running Gaia Harness.' },
    zh: { unavailable: 'Office 预览不可用。请在运行 Gaia Harness 的主机上启用文档预览服务。' },
  },
}

/** Register all supported product-name overrides and dispose them in reverse order. */
export function registerGaiaLocaleOverrides(locale: LocaleService): () => void {
  if (locale.override === undefined) return () => {}
  const disposers: Array<() => void> = []
  for (const [namespace, dictionaries] of Object.entries(GAIA_LOCALE_OVERRIDES)) {
    for (const [localeId, dictionary] of Object.entries(dictionaries)) {
      disposers.push(locale.override(namespace, localeId, dictionary))
    }
  }
  let disposed = false
  return () => {
    if (disposed) return
    disposed = true
    for (const dispose of disposers.reverse()) dispose()
  }
}
