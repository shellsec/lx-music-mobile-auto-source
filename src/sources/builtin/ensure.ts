import {
  BUILTIN_USER_APIS,
  BUILTIN_USER_API_IDS,
  USER_API_AUTO_ID,
  getBuiltinScript,
  type BuiltinUserApi,
} from './index'
import { getUserApiList, saveBuiltinUserApi } from '@/utils/data'
import { setUserApiList } from '@/core/userApi'

export { USER_API_AUTO_ID, BUILTIN_USER_APIS, BUILTIN_USER_API_IDS, getBuiltinScript }

const AUTO_INFO: LX.UserApi.UserApiInfo = {
  id: USER_API_AUTO_ID,
  name: '自动切换',
  description: '按序尝试内置自定义音源解析播放地址',
  author: 'lx-music',
  homepage: '',
  version: '1',
  allowShowUpdateAlert: false,
}

/** 最近一次成功解析的内置源 id（仅内存，重启后仍从列表头开始优先） */
let preferredBuiltinId: string | null = null
/** 当前实际已 loadScript 的内置源（auto 模式下不等于 setting 里的 user_api_auto） */
let loadedBuiltinId: string | null = null

export const getPreferredBuiltinId = () => preferredBuiltinId
export const setPreferredBuiltinId = (id: string | null) => {
  preferredBuiltinId = id && BUILTIN_USER_API_IDS.includes(id) ? id : null
}
export const getLoadedBuiltinId = () => loadedBuiltinId
export const setLoadedBuiltinId = (id: string | null) => {
  loadedBuiltinId = id
}

export const resolveInitialBuiltinId = (): string => {
  if (preferredBuiltinId && BUILTIN_USER_API_IDS.includes(preferredBuiltinId)) return preferredBuiltinId
  return BUILTIN_USER_APIS[0]?.id ?? ''
}

/** 按「成功优先 → 其余按清单顺序」生成尝试队列 */
export const getBuiltinFailoverOrder = (exclude: string[] = []): string[] => {
  const ids = BUILTIN_USER_API_IDS.filter((id) => !exclude.includes(id))
  if (!preferredBuiltinId || !ids.includes(preferredBuiltinId)) return ids
  return [preferredBuiltinId, ...ids.filter((id) => id !== preferredBuiltinId)]
}

/**
 * 确保全部内置自定义音源写入本地列表；并插入「自动切换」虚拟项。
 * 脚本内容每次启动覆盖，避免旧缓存。
 */
export const ensureBuiltinUserApis = async(): Promise<LX.UserApi.UserApiInfo[]> => {
  await getUserApiList()
  let list: LX.UserApi.UserApiInfo[] = []
  for (const api of BUILTIN_USER_APIS) {
    const info: LX.UserApi.UserApiInfo = {
      id: api.id,
      name: api.name,
      description: `内置 ${api.name}，用于解析播放地址`,
      author: api.author,
      homepage: '',
      version: api.version,
      allowShowUpdateAlert: false,
    }
    list = await saveBuiltinUserApi(info, api.script)
  }
  // 虚拟「自动切换」只进列表，不存脚本；并剔除已废弃的星海等项
  const deprecatedIds = new Set(['user_api_builtin_xinghai', 'user_api_flower_builtin'])
  const withoutAuto = list
    .filter((i) => i.id !== USER_API_AUTO_ID && !deprecatedIds.has(i.id))
  // 保证内置项在前、自动第一；去掉重复 builtin
  const builtinIds = new Set(BUILTIN_USER_API_IDS)
  const extras = withoutAuto.filter((i) => !builtinIds.has(i.id))
  const builtinInfos = BUILTIN_USER_APIS.map((api) => ({
    id: api.id,
    name: api.name,
    description: `内置 ${api.name}，用于解析播放地址`,
    author: api.author,
    homepage: '',
    version: api.version,
    allowShowUpdateAlert: false,
  }))
  list = [AUTO_INFO, ...builtinInfos, ...extras]
  // 再写一次列表顺序（自动在最前）
  const { saveData } = await import('@/plugins/storage')
  const { storageDataPrefix } = await import('@/config/constant')
  await saveData(storageDataPrefix.userApi, list)
  setUserApiList(list)
  return list
}

export const toBuiltinInfo = (api: BuiltinUserApi): LX.UserApi.UserApiInfo => ({
  id: api.id,
  name: api.name,
  description: `内置 ${api.name}`,
  author: api.author,
  homepage: '',
  version: api.version,
  allowShowUpdateAlert: false,
})
