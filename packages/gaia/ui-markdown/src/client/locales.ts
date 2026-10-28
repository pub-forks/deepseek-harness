/** Renderer labels. */
export const zh = {
  label: 'Obsidian', copy: '复制', copied: '已复制', properties: 'Properties', empty: 'empty', footnotes: 'Footnotes', readSection: '朗读', stopSection: '停止朗读',
  tasksLabel: '任务', openTasks: '未完成', doneTasks: '已完成', completedTasks: '已完成任务', untitledTask: '未命名任务',
  invalidTasksFile: '无法解析任务文件，正在显示原始文本。', stepsLabel: '个步骤',
  statusToDebate: '待讨论', statusToPlan: '待规划', statusToImplement: '待实现', statusInProgress: '进行中', statusToReview: '待审核', statusOnHold: '已暂停', statusCanceled: '已取消',
} satisfies Record<string, string>
/** Keys available in the Markdown renderer dictionaries. */
export type MarkdownKey = keyof typeof zh
/** English Markdown renderer labels. */
export const en = {
  label: 'Obsidian', copy: 'Copy', copied: 'Copied', properties: 'Properties', empty: 'empty', footnotes: 'Footnotes', readSection: 'Read aloud', stopSection: 'Stop reading',
  tasksLabel: 'Tasks', openTasks: 'Open', doneTasks: 'Done', completedTasks: 'Completed', untitledTask: 'Untitled task',
  invalidTasksFile: 'Could not parse this tasks file. Showing the raw text.', stepsLabel: 'steps',
  statusToDebate: 'To Debate', statusToPlan: 'To Plan', statusToImplement: 'To Implement', statusInProgress: 'In Progress', statusToReview: 'To Review', statusOnHold: 'On Hold', statusCanceled: 'Canceled',
} satisfies Record<MarkdownKey, string>

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap { gaiaMarkdown: MarkdownKey }
}
