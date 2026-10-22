export type SourceEntryKind = 'script' | 'subscription'
export interface SourceEntry { url: string, kind: SourceEntryKind, enable: boolean }

export const parseSourceAddress = (raw: string): string => {
  if (typeof raw !== 'string') throw new Error('请输入源链接或订阅地址')
  const url = raw.trim()
  if (!url || url.length > 4096 || Array.from(url).some(char => char.charCodeAt(0) <= 32 || char.charCodeAt(0) === 127)) throw new Error('链接为空、过长或包含空白字符')
  // React Native's built-in URL getters are incomplete. Validate without rewriting signed URLs.
  const match = /^https?:\/\/([^/?#]+)(?:[/?#]|$)/i.exec(url)
  const authority = match?.[1] ?? ''
  const host = /^(\[[0-9a-f:.]+\]|[a-z0-9\u0080-\uffff](?:[a-z0-9.\-\u0080-\uffff]*[a-z0-9\u0080-\uffff])?)(?::([0-9]{1,5}))?$/i.exec(authority)
  if (!host || (host[2] && (Number(host[2]) < 1 || Number(host[2]) > 65535)) || url.includes('\\')) throw new Error('仅支持有效的 HTTP 或 HTTPS 链接，不支持带账号密码的地址')
  return url
}

export const executeSourceEntry = async(entry: SourceEntry, actions: {
  importScript: (url: string) => Promise<string>
  subscribe: (url: string) => Promise<string | undefined>
  activate: (id: string) => void
}): Promise<string> => {
  const url = parseSourceAddress(entry.url)
  if (entry.kind !== 'script' && entry.kind !== 'subscription') throw new Error('请选择导入单个源或添加订阅')
  if (typeof entry.enable !== 'boolean') throw new Error('启用选项无效')
  const id = entry.kind === 'script' ? await actions.importScript(url) : await actions.subscribe(url)
  if (!id) throw new Error('没有可添加的源，请检查地址或网络')
  if (entry.enable) actions.activate(id)
  return entry.kind === 'script' ? '自定义源已导入' : '订阅已保存，失效时将自动检查更新'
}
