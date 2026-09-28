import settingState from '@/store/setting/state'
import { updateSetting } from '@/core/common'
import { setUserApi } from '@/core/userApi'
import {
  BUILTIN_USER_API_IDS,
  USER_API_AUTO_ID,
  getBuiltinFailoverOrder,
  getLoadedBuiltinId,
  resolveInitialBuiltinId,
  setLoadedBuiltinId,
  setPreferredBuiltinId,
} from '@/sources/builtin/ensure'

const waitApiReady = async(timeoutMs = 25_000) => {
  const ok = await Promise.race([
    global.lx.apiInitPromise[0],
    new Promise<boolean>((resolve) => {
      setTimeout(() => { resolve(false) }, timeoutMs)
    }),
  ])
  return ok
}

const resetApiInitPromise = () => {
  if (!global.lx.apiInitPromise[1]) return
  global.lx.apiInitPromise[0] = new Promise((resolve) => {
    global.lx.apiInitPromise[1] = false
    global.lx.apiInitPromise[2] = (result: boolean) => {
      global.lx.apiInitPromise[1] = true
      resolve(result)
    }
  })
}

/**
 * 加载指定内置自定义音源脚本（洛雪原 setUserApi / loadScript）。
 * setting 可为 user_api_auto，实际运行的是具体 builtin id。
 */
export const loadBuiltinUserApi = async(apiId: string) => {
  if (!BUILTIN_USER_API_IDS.includes(apiId)) throw new Error('not builtin api')
  if (getLoadedBuiltinId() === apiId && global.lx.apis && Object.keys(global.lx.apis).length) {
    return true
  }
  resetApiInitPromise()
  await setUserApi(apiId)
  const ok = await waitApiReady()
  if (!ok) throw new Error('source init failed')
  setLoadedBuiltinId(apiId)
  return true
}

/** 启动或切换到「自动」时，加载优先内置源 */
export const activateAutoUserApi = async() => {
  const id = resolveInitialBuiltinId()
  if (!id) throw new Error('no builtin api')
  await loadBuiltinUserApi(id)
  if (settingState.setting['common.apiSource'] !== USER_API_AUTO_ID) {
    updateSetting({ 'common.apiSource': USER_API_AUTO_ID })
  }
}

export const isAutoOrBuiltinApiSource = (apiId = settingState.setting['common.apiSource']) => {
  return apiId === USER_API_AUTO_ID || BUILTIN_USER_API_IDS.includes(apiId)
}

/**
 * 在原 musicUrl 失败后，按序切换内置自定义源并重试同一首歌。
 * 仅包在取播放地址层，不改变榜单/搜索。
 */
export const tryBuiltinMusicUrlFailover = async(
  tryOnce: () => Promise<{ url: string, type: LX.Quality }>
): Promise<{ url: string, type: LX.Quality }> => {
  const settingId = settingState.setting['common.apiSource']
  // 固定选中某个内置源时，也允许失败后自动试其余内置源
  if (!isAutoOrBuiltinApiSource(settingId)) throw new Error('not auto mode')

  const current = getLoadedBuiltinId() || (settingId === USER_API_AUTO_ID ? resolveInitialBuiltinId() : settingId)
  const order = getBuiltinFailoverOrder(current ? [current] : [])
  let lastErr: Error | null = null

  for (const id of order) {
    try {
      console.log('[userApi failover] try', id)
      await loadBuiltinUserApi(id)
      const result = await tryOnce()
      if (!result?.url || !/^https?:\/\//i.test(result.url)) {
        throw new Error('invalid music url')
      }
      setPreferredBuiltinId(id)
      // 保持 setting 为自动；若用户手动选了具体内置源则记回该源
      if (settingId !== USER_API_AUTO_ID && BUILTIN_USER_API_IDS.includes(settingId)) {
        updateSetting({ 'common.apiSource': id })
      }
      return result
    } catch (err: any) {
      lastErr = err instanceof Error ? err : new Error(String(err?.message ?? err))
      console.log('[userApi failover] fail', id, lastErr.message)
    }
  }
  throw lastErr ?? new Error('all builtin sources failed')
}
