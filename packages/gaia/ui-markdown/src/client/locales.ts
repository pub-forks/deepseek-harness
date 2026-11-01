/** Renderer labels. */
export const zh = {
  label: 'Obsidian', copy: '复制', copied: '已复制', properties: 'Properties', empty: 'empty', footnotes: 'Footnotes', readSection: '朗读', stopSection: '停止朗读',
  tasksLabel: '任务', openTasks: '未完成', tasksRemaining: '个任务待完成', taskRemaining: '个任务待完成', completedTasks: '已完成任务', untitledTask: '未命名任务',
  invalidTasksFile: '无法解析任务文件，正在显示原始文本。', tasksFileIncomplete: '任务文件尚未完整加载，正在显示原始文本。', stepsLabel: '个步骤',
  completeTask: '标记完成', reopenTask: '重新打开任务', toggleImportant: '切换重要标记', important: '重要', changeStatus: '更改状态',
  toggleStep: '切换步骤状态', editTitle: '编辑任务标题', addTask: '添加任务', deleteTask: '删除任务',
  saveFailed: '无法保存任务。请重新加载文件后再试。', staleInvalidFile: '文件已更改且当前内容无效，无法合并编辑。',
  statusTodo: '待办', statusDone: '已完成', statusToDebate: '待讨论', statusToPlan: '待规划', statusToImplement: '待实现', statusInProgress: '进行中', statusToReview: '待审核', statusOnHold: '已暂停', statusCanceled: '已取消',
} satisfies Record<string, string>
/** Keys available in the Markdown renderer dictionaries. */
export type MarkdownKey = keyof typeof zh
/** English Markdown renderer labels. */
export const en = {
  label: 'Obsidian', copy: 'Copy', copied: 'Copied', properties: 'Properties', empty: 'empty', footnotes: 'Footnotes', readSection: 'Read aloud', stopSection: 'Stop reading',
  tasksLabel: 'Tasks', openTasks: 'Open', tasksRemaining: 'tasks remaining', taskRemaining: 'task remaining', completedTasks: 'Completed', untitledTask: 'Untitled task',
  invalidTasksFile: 'Could not parse this tasks file. Showing the raw text.', tasksFileIncomplete: 'This tasks file is not fully loaded yet. Showing the raw text.', stepsLabel: 'steps',
  completeTask: 'Mark complete', reopenTask: 'Reopen task', toggleImportant: 'Toggle important', important: 'Important', changeStatus: 'Change status',
  toggleStep: 'Toggle step', editTitle: 'Edit task title', addTask: 'Add task', deleteTask: 'Delete task',
  saveFailed: 'Could not save task. Reload the file and try again.', staleInvalidFile: 'The file changed and its current content is invalid, so the edit could not be merged.',
  statusTodo: 'To Do', statusDone: 'Done', statusToDebate: 'To Debate', statusToPlan: 'To Plan', statusToImplement: 'To Implement', statusInProgress: 'In Progress', statusToReview: 'To Review', statusOnHold: 'On Hold', statusCanceled: 'Canceled',
} satisfies Record<MarkdownKey, string>
/** Japanese Markdown renderer labels. */
export const ja = {
  label: 'Obsidian', copy: 'コピー', copied: 'コピーしました', properties: 'Properties', empty: 'empty',
  footnotes: 'Footnotes', readSection: '読み上げる', stopSection: '読み上げを停止', tasksLabel: 'タスク', openTasks: '未完了',
  tasksRemaining: '件のタスクが残っています', taskRemaining: '件のタスクが残っています', completedTasks: '完了', untitledTask: '無題のタスク', invalidTasksFile: 'このタスクファイルを解析できませんでした。生のテキストを表示しています。',
  tasksFileIncomplete: 'このタスクファイルはまだ完全に読み込まれていません。生のテキストを表示しています。', stepsLabel: 'ステップ', completeTask: '完了にする', reopenTask: 'タスクを再開', toggleImportant: '重要を切り替え',
  important: '重要', changeStatus: 'ステータスを変更', toggleStep: 'ステップを切り替え', editTitle: 'タスク名を編集', addTask: 'タスクを追加',
  deleteTask: 'タスクを削除', saveFailed: 'タスクを保存できませんでした。ファイルを再読み込みしてもう一度お試しください。', staleInvalidFile: 'ファイルが変更され、現在の内容が無効なため、編集をマージできませんでした。', statusTodo: '未着手', statusDone: '完了',
  statusToDebate: '要議論', statusToPlan: '要計画', statusToImplement: '要実装', statusInProgress: '進行中', statusToReview: '要レビュー',
  statusOnHold: '保留', statusCanceled: 'キャンセル',
} satisfies Record<MarkdownKey, string>
/** Spanish Markdown renderer labels. */
export const es = {
  label: 'Obsidian', copy: 'Copiar', copied: 'Copiado', properties: 'Properties', empty: 'empty',
  footnotes: 'Footnotes', readSection: 'Leer en voz alta', stopSection: 'Detener lectura', tasksLabel: 'Tareas', openTasks: 'Abiertas',
  tasksRemaining: 'tareas pendientes', taskRemaining: 'tarea pendiente', completedTasks: 'Completadas', untitledTask: 'Tarea sin título', invalidTasksFile: 'No se pudo analizar este archivo de tareas. Se muestra el texto sin procesar.',
  tasksFileIncomplete: 'Este archivo de tareas aún no se ha cargado por completo. Se muestra el texto sin procesar.', stepsLabel: 'pasos', completeTask: 'Marcar como completada', reopenTask: 'Reabrir tarea', toggleImportant: 'Alternar importante',
  important: 'Importante', changeStatus: 'Cambiar estado', toggleStep: 'Alternar paso', editTitle: 'Editar título de la tarea', addTask: 'Añadir tarea',
  deleteTask: 'Eliminar tarea', saveFailed: 'No se pudo guardar la tarea. Recarga el archivo e inténtalo de nuevo.', staleInvalidFile: 'El archivo cambió y su contenido actual no es válido, por lo que no se pudo combinar la edición.', statusTodo: 'Por hacer', statusDone: 'Hecha',
  statusToDebate: 'Por debatir', statusToPlan: 'Por planificar', statusToImplement: 'Por implementar', statusInProgress: 'En curso', statusToReview: 'Por revisar',
  statusOnHold: 'En espera', statusCanceled: 'Cancelada',
} satisfies Record<MarkdownKey, string>
/** French Markdown renderer labels. */
export const fr = {
  label: 'Obsidian', copy: 'Copier', copied: 'Copié', properties: 'Properties', empty: 'empty',
  footnotes: 'Footnotes', readSection: 'Lire à voix haute', stopSection: 'Arrêter la lecture', tasksLabel: 'Tâches', openTasks: 'Ouvertes',
  tasksRemaining: 'tâches restantes', taskRemaining: 'tâche restante', completedTasks: 'Terminées', untitledTask: 'Tâche sans titre', invalidTasksFile: 'Impossible d’analyser ce fichier de tâches. Affichage du texte brut.',
  tasksFileIncomplete: 'Ce fichier de tâches n’est pas encore entièrement chargé. Affichage du texte brut.', stepsLabel: 'étapes', completeTask: 'Marquer comme terminée', reopenTask: 'Rouvrir la tâche', toggleImportant: 'Basculer important',
  important: 'Important', changeStatus: 'Changer le statut', toggleStep: 'Basculer l’étape', editTitle: 'Modifier le titre de la tâche', addTask: 'Ajouter une tâche',
  deleteTask: 'Supprimer la tâche', saveFailed: 'Impossible d’enregistrer la tâche. Rechargez le fichier et réessayez.', staleInvalidFile: 'Le fichier a changé et son contenu actuel est invalide ; la modification n’a pas pu être fusionnée.', statusTodo: 'À faire', statusDone: 'Terminée',
  statusToDebate: 'À débattre', statusToPlan: 'À planifier', statusToImplement: 'À implémenter', statusInProgress: 'En cours', statusToReview: 'À relire',
  statusOnHold: 'En attente', statusCanceled: 'Annulée',
} satisfies Record<MarkdownKey, string>
/** German Markdown renderer labels. */
export const de = {
  label: 'Obsidian', copy: 'Kopieren', copied: 'Kopiert', properties: 'Properties', empty: 'empty',
  footnotes: 'Footnotes', readSection: 'Vorlesen', stopSection: 'Vorlesen beenden', tasksLabel: 'Aufgaben', openTasks: 'Offen',
  tasksRemaining: 'Aufgaben offen', taskRemaining: 'Aufgabe offen', completedTasks: 'Erledigt', untitledTask: 'Unbenannte Aufgabe', invalidTasksFile: 'Diese Aufgabendatei konnte nicht gelesen werden. Der Rohtext wird angezeigt.',
  tasksFileIncomplete: 'Diese Aufgabendatei ist noch nicht vollständig geladen. Der Rohtext wird angezeigt.', stepsLabel: 'Schritte', completeTask: 'Als erledigt markieren', reopenTask: 'Aufgabe wieder öffnen', toggleImportant: 'Wichtig umschalten',
  important: 'Wichtig', changeStatus: 'Status ändern', toggleStep: 'Schritt umschalten', editTitle: 'Aufgabentitel bearbeiten', addTask: 'Aufgabe hinzufügen',
  deleteTask: 'Aufgabe löschen', saveFailed: 'Aufgabe konnte nicht gespeichert werden. Lade die Datei neu und versuche es erneut.', staleInvalidFile: 'Die Datei wurde geändert und ihr aktueller Inhalt ist ungültig, daher konnte die Änderung nicht zusammengeführt werden.', statusTodo: 'Zu erledigen', statusDone: 'Erledigt',
  statusToDebate: 'Zu besprechen', statusToPlan: 'Zu planen', statusToImplement: 'Umzusetzen', statusInProgress: 'In Arbeit', statusToReview: 'Zu prüfen',
  statusOnHold: 'Pausiert', statusCanceled: 'Abgebrochen',
} satisfies Record<MarkdownKey, string>
/** Russian Markdown renderer labels. */
export const ru = {
  label: 'Obsidian', copy: 'Копировать', copied: 'Скопировано', properties: 'Properties', empty: 'empty',
  footnotes: 'Footnotes', readSection: 'Прочитать вслух', stopSection: 'Остановить чтение', tasksLabel: 'Задачи', openTasks: 'Открытые',
  tasksRemaining: 'задач осталось', taskRemaining: 'задача осталась', completedTasks: 'Выполненные', untitledTask: 'Задача без названия', invalidTasksFile: 'Не удалось разобрать файл задач. Показан исходный текст.',
  tasksFileIncomplete: 'Файл задач ещё не загружен полностью. Показан исходный текст.', stepsLabel: 'шагов', completeTask: 'Отметить выполненной', reopenTask: 'Открыть задачу снова', toggleImportant: 'Переключить важность',
  important: 'Важное', changeStatus: 'Изменить статус', toggleStep: 'Переключить шаг', editTitle: 'Изменить название задачи', addTask: 'Добавить задачу',
  deleteTask: 'Удалить задачу', saveFailed: 'Не удалось сохранить задачу. Перезагрузите файл и попробуйте снова.', staleInvalidFile: 'Файл изменился, и его текущее содержимое недействительно, поэтому правку не удалось объединить.', statusTodo: 'К выполнению', statusDone: 'Выполнено',
  statusToDebate: 'Обсудить', statusToPlan: 'Спланировать', statusToImplement: 'Реализовать', statusInProgress: 'В работе', statusToReview: 'На проверку',
  statusOnHold: 'Приостановлено', statusCanceled: 'Отменено',
} satisfies Record<MarkdownKey, string>
/** Portuguese Markdown renderer labels. */
export const pt = {
  label: 'Obsidian', copy: 'Copiar', copied: 'Copiado', properties: 'Properties', empty: 'empty',
  footnotes: 'Footnotes', readSection: 'Ler em voz alta', stopSection: 'Parar leitura', tasksLabel: 'Tarefas', openTasks: 'Abertas',
  tasksRemaining: 'tarefas restantes', taskRemaining: 'tarefa restante', completedTasks: 'Concluídas', untitledTask: 'Tarefa sem título', invalidTasksFile: 'Não foi possível analisar este arquivo de tarefas. Mostrando o texto bruto.',
  tasksFileIncomplete: 'Este arquivo de tarefas ainda não foi totalmente carregado. Mostrando o texto bruto.', stepsLabel: 'etapas', completeTask: 'Marcar como concluída', reopenTask: 'Reabrir tarefa', toggleImportant: 'Alternar importante',
  important: 'Importante', changeStatus: 'Alterar status', toggleStep: 'Alternar etapa', editTitle: 'Editar título da tarefa', addTask: 'Adicionar tarefa',
  deleteTask: 'Excluir tarefa', saveFailed: 'Não foi possível salvar a tarefa. Recarregue o arquivo e tente novamente.', staleInvalidFile: 'O arquivo mudou e o conteúdo atual é inválido, então a edição não pôde ser mesclada.', statusTodo: 'A fazer', statusDone: 'Concluída',
  statusToDebate: 'Para debater', statusToPlan: 'Para planejar', statusToImplement: 'Para implementar', statusInProgress: 'Em andamento', statusToReview: 'Para revisar',
  statusOnHold: 'Em espera', statusCanceled: 'Cancelada',
} satisfies Record<MarkdownKey, string>

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap { gaiaMarkdown: MarkdownKey }
}
