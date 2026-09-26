/** Copy for the Gaia sign-in settings section. */
export type AuthorizationKey = keyof typeof en
export const en = {
  nav: 'Sign-in', title: 'Sign-in', intro: 'Connect a provider to use its models.',
  loading: 'Loading sign-in options…', empty: 'No sign-in flows are available.', failed: 'Sign-in options are unavailable.',
  signedIn: 'Signed in', signedOut: 'Signed out', expires: 'Expires', signIn: 'Sign in', signOut: 'Sign out',
  method: 'Sign-in method', cancel: 'Cancel', submit: 'Continue', open: 'Open', copy: 'Copy', copied: 'Copied',
  busy: 'A sign-in is already in progress.', authorized: 'Signed in successfully.', cancelled: 'Sign-in cancelled.', error: 'Sign-in failed.',
  modelsHint: 'Choose a model for this provider in Models settings.', models: 'Models settings',
  confirmTitle: 'Sign out?', confirmDescription: 'Remove the stored sign-in for this provider?', close: 'Close',
} as const
export const zh: Record<AuthorizationKey, string> = {
  nav: '登录', title: '登录', intro: '连接服务提供方以使用其模型。',
  loading: '正在加载登录选项…', empty: '没有可用的登录流程。', failed: '无法加载登录选项。',
  signedIn: '已登录', signedOut: '未登录', expires: '到期', signIn: '登录', signOut: '退出登录',
  method: '登录方式', cancel: '取消', submit: '继续', open: '打开', copy: '复制', copied: '已复制',
  busy: '已有登录流程正在进行。', authorized: '登录成功。', cancelled: '登录已取消。', error: '登录失败。',
  modelsHint: '前往模型设置选择此提供方的模型。', models: '模型设置',
  confirmTitle: '退出登录？', confirmDescription: '删除此提供方保存的登录信息？', close: '关闭',
}
