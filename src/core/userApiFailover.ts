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

let initGeneration = 0
/** 这次 load 期望的内置源。对不上的初始化事件丢掉，避免上一轮把下一轮结束掉。 */
let expectedBuiltinLoadId: string | null = null
/** 当前这扇门闩最后一次结束时是不是成功。失败或超时记成 false。 */
let initGateOpen = false

export const getExpectedBuiltinLoadId = () => expectedBuiltinLoadId
export const setExpectedBuiltinLoadId = (id: string | null) => {
  expectedBuiltinLoadId = id
}

const waitApiReady = async(timeoutMs = 25_000) => {
  const generation = initGeneration
  const pending = global.lx.apiInitPromise[0]
  let timer: ReturnType<typeof setTimeout> | undefined
  const timeout = new Promise<boolean>((resolve) => {
    timer = setTimeout(() => {
      // 超时也要把这一代门闩结束掉，不能留下永远 pending 的 Promise
      if (generation === initGeneration && !global.lx.apiInitPromise[1]) {
        global.lx.apiInitPromise[2](false)
      }
      resolve(false)
    }, timeoutMs)
  })
  try {
    return await Promise.race([pending, timeout])
  } finally {
    if (timer != null) clearTimeout(timer)
  }
}

const resetApiInitPromise = () => {
  // 上一轮还没结束就先结束掉，下一轮换一个新 Promise，不能继续等上一轮
  if (!global.lx.apiInitPromise[1]) global.lx.apiInitPromise[2](false)
  const generation = ++initGeneration
  global.lx.apiInitPromise[0] = new Promise((resolve) => {
    global.lx.apiInitPromise[1] = false
    global.lx.apiInitPromise[2] = (result: boolean) => {
      if (generation !== initGeneration) return
      global.lx.apiInitPromise[1] = true
      initGateOpen = result
      resolve(result)
    }
  })
}

/**
 * 全部内置源都失败后，把门闩收成可以继续播。
 * 初始化失败时是 false，超时则已经在 waitApiReady 里结束。
 * 若仍是失败，换成已完成的 true，当前这首歌才能走原来的平台换源，
 * 下一首也不会被 source init failed 挡住。设置保持不动。
 */
const releaseInitGateAfterBuiltinFailure = () => {
  if (!global.lx.apiInitPromise[1]) global.lx.apiInitPromise[2](true)
  if (initGateOpen) return
  global.lx.apiInitPromise[0] = Promise.resolve(true)
  global.lx.apiInitPromise[1] = true
  initGateOpen = true
}

/**
 * 加载指定内置自定义音源脚本（洛雪原 setUserApi / loadScript）。
 * setting 可为 user_api_auto，实际运行的是具体 builtin id。
 */
export const loadBuiltinUserApi = async(apiId: string) => {
  if (!BUILTIN_USER_API_IDS.includes(apiId)) throw new Error('not builtin api')
  setExpectedBuiltinLoadId(apiId)
  if (getLoadedBuiltinId() === apiId && global.lx.apis && Object.keys(global.lx.apis).length) {
    if (!global.lx.apiInitPromise[1]) global.lx.apiInitPromise[2](true)
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
  tryOnce: () => Promise<{ url: string, type: LX.Quality }>,
): Promise<{ url: string, type: LX.Quality }> => {
  const settingId = settingState.setting['common.apiSource']
  // 固定选中某个内置源时，也允许失败后自动试其余内置源
  if (!isAutoOrBuiltinApiSource(settingId)) throw new Error('not auto mode')

  const loadedId = getLoadedBuiltinId()
  // 自动模式且没有已加载的内置源时，不排除清单头，下一首可以从头再试
  const current = loadedId ?? (settingId === USER_API_AUTO_ID ? '' : settingId)
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
  releaseInitGateAfterBuiltinFailure()
  throw lastErr ?? new Error('all builtin sources failed')
}
