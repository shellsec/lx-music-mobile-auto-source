/** User supplied catalog URL; no default subscription. */
export const REMOTE_SOURCES_URL = ''

export interface RemoteSourceEntry {
  id: string
  name: string
  url: string
}

export interface LocalCatalogEntry {
  /** sources.json 里的 id，用户指定的标识 */
  id: string
  name: string
  script: string
}

export interface RemoteScriptEntry extends RemoteSourceEntry {
  script: string
}

const CATALOG_ID_PREFIX = 'user_api_subscription_'

export const catalogLocalId = (remoteId: string) => `${CATALOG_ID_PREFIX}${remoteId}`

export const catalogRemoteId = (localId: string) => {
  if (!localId.startsWith(CATALOG_ID_PREFIX)) return ''
  return localId.slice(CATALOG_ID_PREFIX.length)
}

/**
 * 已经是完整 http(s) URL 时原样使用。
 * 相对路径按 sources.json 所在目录解析，不改写成别的主机。
 */
export const resolveScriptUrl = (raw: string, baseUrl = REMOTE_SOURCES_URL): string | null => {
  const url = raw.trim()
  if (!url) return null
  if (/^https?:\/\//i.test(url)) return url
  try {
    const resolved = new URL(url, baseUrl)
    return /^https?:$/.test(resolved.protocol) ? resolved.href : null
  } catch {
    return null
  }
}

/** 解析失败、空文档、空名单都返回 null，调用方停止，不再重试。 */
export const parseSourcesJson = (text: string, baseUrl = REMOTE_SOURCES_URL): RemoteSourceEntry[] | null => {
  if (!text?.trim()) return null
  let data: unknown
  try {
    data = JSON.parse(text.replace(/^\uFEFF/, ''))
  } catch {
    return null
  }
  const rawList = Array.isArray(data)
    ? data
    : (data && typeof data === 'object' && Array.isArray((data as { sources?: unknown }).sources)
        ? (data as { sources: unknown[] }).sources
        : null)
  if (!rawList?.length) return null
  const entries: RemoteSourceEntry[] = []
  const ids = new Set<string>()
  for (const item of rawList) {
    if (!item || typeof item !== 'object') return null
    const rec = item as { id?: unknown, name?: unknown, url?: unknown }
    const id = typeof rec.id === 'string' ? rec.id.trim() : ''
    const name = typeof rec.name === 'string' ? rec.name.trim() : ''
    const url = typeof rec.url === 'string' ? resolveScriptUrl(rec.url, baseUrl) : null
    if (!id || !name || !url || ids.has(id)) return null
    ids.add(id)
    entries.push({ id, name, url })
  }
  return entries
}

/**
 * 比对名单身份、名称和脚本正文。
 * 只改了 URL 字符串、正文相同，不算变化。
 */
export const catalogContentChanged = (local: LocalCatalogEntry[], remote: RemoteScriptEntry[]): boolean => {
  if (local.length !== remote.length) return true
  const remoteById = new Map(remote.map(item => [item.id, item]))
  for (const item of local) {
    const next = remoteById.get(item.id)
    if (!next || item.name !== next.name || item.script !== next.script) return true
  }
  return false
}

const INFO_LIMIT = { description: 36, author: 56, version: 36 } as const

export const readScriptMeta = (script: string) => {
  const header = /^\/\*[\s\S]*?\*\//.exec(script)?.[0] ?? ''
  const infos = { description: '', author: '', version: '' }
  const rxp = /^\s?\*\s?@(\w+)\s(.+)$/
  for (const line of header.split(/\r?\n/)) {
    const result = rxp.exec(line)
    if (!result) continue
    const key = result[1]
    if (key !== 'description' && key !== 'author' && key !== 'version') continue
    infos[key] = result[2].trim()
  }
  for (const key of Object.keys(INFO_LIMIT) as Array<keyof typeof INFO_LIMIT>) {
    if (infos[key].length > INFO_LIMIT[key]) infos[key] = infos[key].slice(0, INFO_LIMIT[key]) + '...'
  }
  return infos
}
