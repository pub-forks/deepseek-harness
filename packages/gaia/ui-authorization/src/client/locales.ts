/** Copy for the Gaia sign-in settings section. */
export type AuthorizationKey = keyof typeof en
/** English copy for Gaia authorization settings. */
export const en = {
  nav: 'Sign-in', title: 'Sign-in', intro: 'Connect a provider to use its models.',
  loading: 'Loading sign-in options…', empty: 'No OAuth sign-in flows are available.', failed: 'Sign-in options are unavailable.',
  apiKeyHint: 'API-key providers are configured in Models.',
  signedIn: 'Signed in', signedOut: 'Signed out', expires: 'Expires', signIn: 'Sign in', signOut: 'Sign out',
  method: 'Sign-in method', cancel: 'Cancel', submit: 'Continue', open: 'Open', copy: 'Copy', copied: 'Copied',
  busy: 'A sign-in is already in progress.', authorized: 'Signed in successfully.', cancelled: 'Sign-in cancelled.', error: 'Sign-in failed.',
  modelsHint: 'Choose a model for this provider in Models settings.', models: 'Models settings',
  confirmTitle: 'Sign out?', confirmDescription: 'Remove the stored sign-in for this provider?', close: 'Close',
  accountLabel: 'Account label', accountId: 'Account id', addAccount: 'Add account', removeAccount: 'Remove account',
  accountSource: 'OAuth provider',
  accountKind: 'Account type', oauthAccount: 'OAuth account', apiKeyAccount: 'API-key account', apiKey: 'API key', changeKey: 'Change key',
  removeTitle: 'Remove account?', removeDescription: 'Remove this account route and its stored sign-in?',
} as const
/** Chinese copy for Gaia authorization settings. */
export const zh: Record<AuthorizationKey, string> = {
  nav: '登录', title: '登录', intro: '连接服务提供方以使用其模型。',
  loading: '正在加载登录选项…', empty: '没有可用的 OAuth 登录流程。', failed: '无法加载登录选项。',
  apiKeyHint: 'API 密钥提供方请在模型中配置。',
  signedIn: '已登录', signedOut: '未登录', expires: '到期', signIn: '登录', signOut: '退出登录',
  method: '登录方式', cancel: '取消', submit: '继续', open: '打开', copy: '复制', copied: '已复制',
  busy: '已有登录流程正在进行。', authorized: '登录成功。', cancelled: '登录已取消。', error: '登录失败。',
  modelsHint: '前往模型设置选择此提供方的模型。', models: '模型设置',
  confirmTitle: '退出登录？', confirmDescription: '删除此提供方保存的登录信息？', close: '关闭',
  accountLabel: '账户名称', accountId: '账户标识', addAccount: '添加账户', removeAccount: '删除账户',
  accountSource: 'OAuth 服务提供方',
  accountKind: '账户类型', oauthAccount: 'OAuth 账户', apiKeyAccount: 'API 密钥账户', apiKey: 'API 密钥', changeKey: '更改密钥',
  removeTitle: '删除账户？', removeDescription: '删除此账户路由及其保存的登录信息？',
}
/** Japanese copy for Gaia authorization settings. */
export const ja: Record<AuthorizationKey, string> = {
  nav: 'サインイン', title: 'サインイン', intro: 'プロバイダーに接続してそのモデルを使用します。',
  loading: 'サインインオプションを読み込み中…', empty: '利用できる OAuth サインインフローはありません。', failed: 'サインインオプションを利用できません。',
  apiKeyHint: 'API キーのプロバイダーはモデルで設定します。',
  signedIn: 'サインイン済み', signedOut: 'サインアウト済み', expires: '有効期限', signIn: 'サインイン', signOut: 'サインアウト',
  method: 'サインイン方法', cancel: 'キャンセル', submit: '続行', open: '開く', copy: 'コピー', copied: 'コピーしました',
  busy: 'サインインはすでに進行中です。', authorized: 'サインインしました。', cancelled: 'サインインをキャンセルしました。', error: 'サインインに失敗しました。',
  modelsHint: 'モデル設定でこのプロバイダーのモデルを選択してください。', models: 'モデル設定',
  confirmTitle: 'サインアウトしますか？', confirmDescription: 'このプロバイダーの保存済みサインインを削除しますか？', close: '閉じる',
  accountLabel: 'アカウント名', accountId: 'アカウント ID', addAccount: 'アカウントを追加', removeAccount: 'アカウントを削除',
  accountSource: 'OAuth プロバイダー',
  accountKind: 'アカウントの種類', oauthAccount: 'OAuth アカウント', apiKeyAccount: 'API キーアカウント', apiKey: 'API キー', changeKey: 'キーを変更',
  removeTitle: 'アカウントを削除しますか？', removeDescription: 'このアカウントのルートと保存済みサインインを削除しますか？',
}
/** Spanish copy for Gaia authorization settings. */
export const es: Record<AuthorizationKey, string> = {
  nav: 'Inicio de sesión', title: 'Inicio de sesión', intro: 'Conecta un proveedor para usar sus modelos.',
  loading: 'Cargando opciones de inicio de sesión…', empty: 'No hay flujos de inicio de sesión OAuth disponibles.', failed: 'Las opciones de inicio de sesión no están disponibles.',
  apiKeyHint: 'Los proveedores con clave de API se configuran en Modelos.',
  signedIn: 'Sesión iniciada', signedOut: 'Sesión cerrada', expires: 'Caduca', signIn: 'Iniciar sesión', signOut: 'Cerrar sesión',
  method: 'Método de inicio de sesión', cancel: 'Cancelar', submit: 'Continuar', open: 'Abrir', copy: 'Copiar', copied: 'Copiado',
  busy: 'Ya hay un inicio de sesión en curso.', authorized: 'Sesión iniciada correctamente.', cancelled: 'Inicio de sesión cancelado.', error: 'Error al iniciar sesión.',
  modelsHint: 'Elige un modelo para este proveedor en la configuración de Modelos.', models: 'Configuración de Modelos',
  confirmTitle: '¿Cerrar sesión?', confirmDescription: '¿Eliminar el inicio de sesión guardado de este proveedor?', close: 'Cerrar',
  accountLabel: 'Nombre de la cuenta', accountId: 'ID de la cuenta', addAccount: 'Añadir cuenta', removeAccount: 'Eliminar cuenta',
  accountSource: 'Proveedor OAuth',
  accountKind: 'Tipo de cuenta', oauthAccount: 'Cuenta OAuth', apiKeyAccount: 'Cuenta con clave de API', apiKey: 'Clave de API', changeKey: 'Cambiar clave',
  removeTitle: '¿Eliminar cuenta?', removeDescription: '¿Eliminar la ruta de esta cuenta y su inicio de sesión guardado?',
}
/** French copy for Gaia authorization settings. */
export const fr: Record<AuthorizationKey, string> = {
  nav: 'Connexion', title: 'Connexion', intro: 'Connectez un fournisseur pour utiliser ses modèles.',
  loading: 'Chargement des options de connexion…', empty: 'Aucun flux de connexion OAuth disponible.', failed: 'Les options de connexion ne sont pas disponibles.',
  apiKeyHint: 'Les fournisseurs à clé d’API se configurent dans Modèles.',
  signedIn: 'Connecté', signedOut: 'Déconnecté', expires: 'Expire', signIn: 'Se connecter', signOut: 'Se déconnecter',
  method: 'Méthode de connexion', cancel: 'Annuler', submit: 'Continuer', open: 'Ouvrir', copy: 'Copier', copied: 'Copié',
  busy: 'Une connexion est déjà en cours.', authorized: 'Connexion réussie.', cancelled: 'Connexion annulée.', error: 'Échec de la connexion.',
  modelsHint: 'Choisissez un modèle pour ce fournisseur dans les paramètres Modèles.', models: 'Paramètres Modèles',
  confirmTitle: 'Se déconnecter ?', confirmDescription: 'Supprimer la connexion enregistrée pour ce fournisseur ?', close: 'Fermer',
  accountLabel: 'Nom du compte', accountId: 'Identifiant du compte', addAccount: 'Ajouter un compte', removeAccount: 'Supprimer le compte',
  accountSource: 'Fournisseur OAuth',
  accountKind: 'Type de compte', oauthAccount: 'Compte OAuth', apiKeyAccount: 'Compte à clé d’API', apiKey: 'Clé d’API', changeKey: 'Changer la clé',
  removeTitle: 'Supprimer le compte ?', removeDescription: 'Supprimer la route de ce compte et sa connexion enregistrée ?',
}
/** German copy for Gaia authorization settings. */
export const de: Record<AuthorizationKey, string> = {
  nav: 'Anmeldung', title: 'Anmeldung', intro: 'Verbinde einen Anbieter, um seine Modelle zu nutzen.',
  loading: 'Anmeldeoptionen werden geladen…', empty: 'Keine OAuth-Anmeldeabläufe verfügbar.', failed: 'Anmeldeoptionen sind nicht verfügbar.',
  apiKeyHint: 'Anbieter mit API-Schlüssel werden unter Modelle konfiguriert.',
  signedIn: 'Angemeldet', signedOut: 'Abgemeldet', expires: 'Läuft ab', signIn: 'Anmelden', signOut: 'Abmelden',
  method: 'Anmeldemethode', cancel: 'Abbrechen', submit: 'Weiter', open: 'Öffnen', copy: 'Kopieren', copied: 'Kopiert',
  busy: 'Eine Anmeldung läuft bereits.', authorized: 'Erfolgreich angemeldet.', cancelled: 'Anmeldung abgebrochen.', error: 'Anmeldung fehlgeschlagen.',
  modelsHint: 'Wähle in den Modelleinstellungen ein Modell für diesen Anbieter.', models: 'Modelleinstellungen',
  confirmTitle: 'Abmelden?', confirmDescription: 'Gespeicherte Anmeldung für diesen Anbieter entfernen?', close: 'Schließen',
  accountLabel: 'Kontoname', accountId: 'Konto-ID', addAccount: 'Konto hinzufügen', removeAccount: 'Konto entfernen',
  accountSource: 'OAuth-Anbieter',
  accountKind: 'Kontotyp', oauthAccount: 'OAuth-Konto', apiKeyAccount: 'API-Schlüssel-Konto', apiKey: 'API-Schlüssel', changeKey: 'Schlüssel ändern',
  removeTitle: 'Konto entfernen?', removeDescription: 'Route dieses Kontos und seine gespeicherte Anmeldung entfernen?',
}
/** Russian copy for Gaia authorization settings. */
export const ru: Record<AuthorizationKey, string> = {
  nav: 'Вход', title: 'Вход', intro: 'Подключите провайдера, чтобы использовать его модели.',
  loading: 'Загрузка вариантов входа…', empty: 'Нет доступных способов входа через OAuth.', failed: 'Варианты входа недоступны.',
  apiKeyHint: 'Провайдеры с API-ключом настраиваются в разделе «Модели».',
  signedIn: 'Вход выполнен', signedOut: 'Вход не выполнен', expires: 'Истекает', signIn: 'Войти', signOut: 'Выйти',
  method: 'Способ входа', cancel: 'Отмена', submit: 'Продолжить', open: 'Открыть', copy: 'Копировать', copied: 'Скопировано',
  busy: 'Вход уже выполняется.', authorized: 'Вход выполнен успешно.', cancelled: 'Вход отменён.', error: 'Не удалось войти.',
  modelsHint: 'Выберите модель для этого провайдера в настройках моделей.', models: 'Настройки моделей',
  confirmTitle: 'Выйти?', confirmDescription: 'Удалить сохранённый вход для этого провайдера?', close: 'Закрыть',
  accountLabel: 'Название аккаунта', accountId: 'ID аккаунта', addAccount: 'Добавить аккаунт', removeAccount: 'Удалить аккаунт',
  accountSource: 'OAuth-провайдер',
  accountKind: 'Тип аккаунта', oauthAccount: 'OAuth-аккаунт', apiKeyAccount: 'Аккаунт с API-ключом', apiKey: 'API-ключ', changeKey: 'Изменить ключ',
  removeTitle: 'Удалить аккаунт?', removeDescription: 'Удалить маршрут этого аккаунта и его сохранённый вход?',
}
/** Portuguese copy for Gaia authorization settings. */
export const pt: Record<AuthorizationKey, string> = {
  nav: 'Início de sessão', title: 'Início de sessão', intro: 'Conecte um provedor para usar os modelos dele.',
  loading: 'Carregando opções de início de sessão…', empty: 'Nenhum fluxo de início de sessão OAuth disponível.', failed: 'As opções de início de sessão não estão disponíveis.',
  apiKeyHint: 'Provedores com chave de API são configurados em Modelos.',
  signedIn: 'Sessão iniciada', signedOut: 'Sessão encerrada', expires: 'Expira', signIn: 'Entrar', signOut: 'Sair',
  method: 'Método de início de sessão', cancel: 'Cancelar', submit: 'Continuar', open: 'Abrir', copy: 'Copiar', copied: 'Copiado',
  busy: 'Já existe um início de sessão em andamento.', authorized: 'Sessão iniciada com sucesso.', cancelled: 'Início de sessão cancelado.', error: 'Falha ao iniciar sessão.',
  modelsHint: 'Escolha um modelo para este provedor nas configurações de Modelos.', models: 'Configurações de Modelos',
  confirmTitle: 'Sair?', confirmDescription: 'Remover o início de sessão salvo deste provedor?', close: 'Fechar',
  accountLabel: 'Nome da conta', accountId: 'ID da conta', addAccount: 'Adicionar conta', removeAccount: 'Remover conta',
  accountSource: 'Provedor OAuth',
  accountKind: 'Tipo de conta', oauthAccount: 'Conta OAuth', apiKeyAccount: 'Conta com chave de API', apiKey: 'Chave de API', changeKey: 'Alterar chave',
  removeTitle: 'Remover conta?', removeDescription: 'Remover a rota desta conta e o início de sessão salvo?',
}
