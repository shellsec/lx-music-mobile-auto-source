import settingState from '@/store/setting/state'
import { updateSetting } from '@/core/common'
import { setUserApi } from '@/core/userApi'
import { getUserApiScript } from '@/utils/data'
import { applyRemoteSourceFallback } from '@/sources/remoteSourceFallback'
import { runSubscriptionRecovery } from '@/sources/subscriptionRecovery'
import {
  USER_API_AUTO_ID,
  getSourceRetryOrder,
  getLoadedSourceId,
  getLocalPlayableIds,
  resolveInitialSourceId,
  setLoadedSourceId,
} from '@/sources/userSources'

let initGeneration = 0
/** 这次 load 期望的用户导入的源。对不上的初始化事件丢掉，避免上一轮把下一轮结束掉。 */
let expectedSourceId: string | null = null
/** 当前这扇门闩最后一次结束时是不是成功。失败或超时记成 false。 */
let initGateOpen = false

export const getExpectedSourceId = () => expectedSourceId
export const setExpectedSourceId = (id: string | null) => {
  expectedSourceId = id
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
 * 全部用户导入的源都失败后，把门闩收成可以继续播。
 * 初始化失败时是 false，超时则已经在 waitApiReady 里结束。
 * 若仍是失败，换成已完成的 true，当前这首歌才能走原来的平台换源，
 * 下一首也不会被 source init failed 挡住。设置保持不动。
 */
const releaseInitGateAfterSourceFailure = () => {
  if (!global.lx.apiInitPromise[1]) global.lx.apiInitPromise[2](true)
  if (initGateOpen) return
  global.lx.apiInitPromise[0] = Promise.resolve(true)
  global.lx.apiInitPromise[1] = true
  initGateOpen = true
}

/**
 * 加载指定用户导入的自定义音源脚本（洛雪原 setUserApi / loadScript）。
 * setting 可为 user_api_auto，实际运行的是具体用户源 id。
 */
export const loadUserSource = async(apiId: string) => {
  if (!getLocalPlayableIds().includes(apiId)) throw new Error('not local api')
  setExpectedSourceId(apiId)
  const script = await getUserApiScript(apiId)
  if (!script.trim()) throw new Error('no local script')
  if (getLoadedSourceId() === apiId && global.lx.apis && Object.keys(global.lx.apis).length) {
    if (!global.lx.apiInitPromise[1]) global.lx.apiInitPromise[2](true)
    return true
  }
  setLoadedSourceId(null)
  resetApiInitPromise()
  await setUserApi(apiId)
  const ok = await waitApiReady()
  if (!ok) throw new Error('source init failed')
  setLoadedSourceId(apiId)
  return true
}

/** 启动或切换到「自动」时，加载优先用户导入的源 */
export const activateAutoUserApi = async() => {
  const id = resolveInitialSourceId()
  if (!id) throw new Error('请在设置中导入自定义源')
  await loadUserSource(id)
  if (settingState.setting['common.apiSource'] !== USER_API_AUTO_ID) {
    updateSetting({ 'common.apiSource': USER_API_AUTO_ID })
  }
}

export const isAutoApiSource = (apiId = settingState.setting['common.apiSource']) => {
  return apiId === USER_API_AUTO_ID
}

const tryOrderedLocalSources = async(
  tryOnce: () => Promise<{ url: string, type: LX.Quality }>,
  skipIds: string[],
) => {
  const order = getSourceRetryOrder(skipIds)
  let lastErr: Error | null = null
  for (const id of order) {
    if (!isAutoApiSource()) throw new Error('automatic switching disabled')
    try {
      console.log('[userApi failover] try', id)
      await loadUserSource(id)
      const result = await tryOnce()
      if (!result?.url || !/^https?:\/\//i.test(result.url)) {
        throw new Error('invalid music url')
      }
      return result
    } catch (err: any) {
      lastErr = err instanceof Error ? err : new Error(String(err?.message ?? err))
      console.log('[userApi failover] fail', id, lastErr.message)
    }
  }
  throw lastErr ?? new Error('all local sources failed')
}

/**
 * 在原 musicUrl 失败后，按本地名单切换音源并重试同一首歌。
 * 多源失败后检查用户保存的订阅；更新后最多再尝试一轮。
 * 仅包在取播放地址层，不改变榜单/搜索。
 */
export const tryUserSourceFailover = async(
  tryOnce: () => Promise<{ url: string, type: LX.Quality }>,
  songKey = '',
): Promise<{ url: string, type: LX.Quality }> => {
  const settingId = settingState.setting['common.apiSource']
  const auto = isAutoApiSource(settingId)
  const subscriptionUrl = settingState.setting['common.sourceListUrl'] ?? ''
  if (!auto && !(subscriptionUrl && settingId.startsWith('user_api_subscription_'))) throw new Error('not auto mode')

  const loadedId = getExpectedSourceId() ?? getLoadedSourceId()
  // 自动模式且没有已加载的源时，不排除清单头，下一首可以从头再试
  const current = loadedId ?? (settingId === USER_API_AUTO_ID ? '' : settingId)
  try {
    if (auto) return await tryOrderedLocalSources(tryOnce, current ? [current] : [])
    throw new Error('selected source failed')
  } catch (err) {
    releaseInitGateAfterSourceFailure()
    const recovered = await runSubscriptionRecovery({
      url: subscriptionUrl,
      songKey,
      fetchAndUpdate: async() => applyRemoteSourceFallback(subscriptionUrl, true),
      retry: async() => {
        if (settingState.setting['common.apiSource'] !== settingId || settingState.setting['common.sourceListUrl'] !== subscriptionUrl) {
          throw new Error('source selection changed')
        }
        try {
          if (auto) return await tryOrderedLocalSources(tryOnce, [])
          await loadUserSource(settingId)
          return await tryOnce()
        } catch (retryErr) {
          releaseInitGateAfterSourceFailure()
          throw retryErr
        }
      },
    })
    if (!recovered) throw err
    return recovered
  }
}
