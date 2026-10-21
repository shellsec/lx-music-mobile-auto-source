import BackgroundTimer from 'react-native-background-timer'
import { setUserApiList } from '@/core/userApi'
import { state as userApiState } from '@/store/userApi/state'
import {
  getUserApiList,
  getUserApiScript,
  removeUserApiScripts,
  replaceUserApiList,
  writeUserApiScripts,
} from '@/utils/data'
import { setLoadedSourceId } from '@/sources/userSources'
import { setApiSource } from '@/core/apiSource'
import {
  catalogContentChanged,
  catalogLocalId,
  catalogRemoteId,
  parseSourcesJson,
  readScriptMeta,
  type LocalCatalogEntry,
  type RemoteScriptEntry,
} from '@/sources/remoteSourceFallbackCore'

const fetchText = async(url: string, timeoutMs = 15_000): Promise<string> => {
  const controller = new AbortController()
  const timer = BackgroundTimer.setTimeout(() => {
    controller.abort()
  }, timeoutMs)
  try {
    const resp = await global.fetch(url, {
      method: 'GET',
      signal: controller.signal,
      cache: 'no-store',
    })
    if (!resp.ok) throw new Error(String(resp.status))
    const text = await resp.text()
    if (!text.trim()) throw new Error('empty')
    return text
  } finally {
    BackgroundTimer.clearTimeout(timer)
  }
}

const collectLocalCatalog = async(): Promise<LocalCatalogEntry[]> => {
  const list = userApiState.list.length ? userApiState.list : await getUserApiList()
  const entries: LocalCatalogEntry[] = []
  for (const info of list) {
    const id = catalogRemoteId(info.id)
    if (!id) continue
    entries.push({
      id,
      name: info.name,
      script: await getUserApiScript(info.id),
    })
  }
  return entries
}

const writeCatalog = async(previous: LX.UserApi.UserApiInfo[], remote: RemoteScriptEntry[], preserveSelection: boolean) => {
  const remoteIds = new Set(remote.map(item => catalogLocalId(item.id)))
  const dropped = previous.filter(info => {
    const remoteId = catalogRemoteId(info.id)
    return !!remoteId && !remoteIds.has(info.id)
  })
  const extras = previous.filter(info => !catalogRemoteId(info.id))
  const catalogInfos: LX.UserApi.UserApiInfo[] = remote.map(item => {
    const meta = readScriptMeta(item.script)
    return {
      id: catalogLocalId(item.id),
      name: item.name,
      description: `用户订阅：${item.name}`,
      author: meta.author,
      homepage: '',
      version: meta.version,
      allowShowUpdateAlert: false,
      scriptUrl: item.url,
    }
  })
  await writeUserApiScripts(remote.map(item => ({
    id: catalogLocalId(item.id),
    script: item.script,
  })))
  if (dropped.length) await removeUserApiScripts(dropped.map(info => info.id))
  const byId = new Map(catalogInfos.map(info => [info.id, info]))
  const ordered = previous.flatMap(info => {
    const updated = byId.get(info.id)
    if (updated) {
      byId.delete(info.id)
      return [updated]
    }
    return extras.includes(info) ? [info] : []
  })
  const list = await replaceUserApiList([...ordered, ...byId.values()])
  setUserApiList(list)
  setLoadedSourceId(null)
  if (global.lx && !preserveSelection) setApiSource('')
}

/**
 * 拉取一次 sources.json，并在需要比对正文时才取脚本。
 * 没变化、解析失败、空响应或任一脚本取不到：不改本地名单，返回 false。
 */
export const applyRemoteSourceFallback = async(catalogUrl: string, preserveSelection = false): Promise<boolean> => {
  if (!/^https?:\/\//i.test(catalogUrl.trim())) return false
  const local = await collectLocalCatalog()
  let catalogText = ''
  try {
    console.log('[userApi fallback] fetch sources.json')
    catalogText = await fetchText(catalogUrl.trim())
  } catch (err: any) {
    console.log('[userApi fallback] sources.json unavailable', err?.message ?? err)
    return false
  }
  const parsed = parseSourcesJson(catalogText, catalogUrl.trim())
  if (!parsed) {
    console.log('[userApi fallback] sources.json empty or invalid')
    return false
  }
  const remote: RemoteScriptEntry[] = []
  for (const item of parsed) {
    try {
      const script = await fetchText(item.url)
      remote.push({ ...item, script })
    } catch (err: any) {
      console.log('[userApi fallback] script unavailable', item.id, err?.message ?? err)
      return false
    }
  }
  if (!catalogContentChanged(local, remote)) {
    console.log('[userApi fallback] unchanged')
    return false
  }
  const previous = await getUserApiList()
  await writeCatalog(previous, remote, preserveSelection)
  console.log('[userApi fallback] updated')
  return true
}
