// import { setUserApi as setUserApiAction } from '@renderer/utils/ipc'
import musicSdk from '@/utils/musicSdk'
// import apiSourceInfo from '@renderer/utils/musicSdk/api-source-info'
import { updateSetting } from './common'
import settingState from '@/store/setting/state'
import { destroyUserApi, setUserApi } from './userApi'
import apiSourceInfo from '@/utils/musicSdk/api-source-info'
import { USER_API_AUTO_ID } from '@/sources/constants'
import { setLoadedSourceId } from '@/sources/userSources'
import { activateAutoUserApi, setExpectedSourceId } from './userApiFailover'


export const setApiSource = (apiId: string) => {
  // 手动换源时丢掉上一轮用户导入的源的期望 id，避免新脚本的初始化被滤掉
  setExpectedSourceId(apiId !== USER_API_AUTO_ID && /^user_api/.test(apiId) ? apiId : null)
  if (global.lx.apiInitPromise[1]) {
    global.lx.apiInitPromise[0] = new Promise(resolve => {
      global.lx.apiInitPromise[1] = false
      global.lx.apiInitPromise[2] = (result: boolean) => {
        global.lx.apiInitPromise[1] = true
        resolve(result)
      }
    })
  }
  if (apiId === USER_API_AUTO_ID) {
    // 「多源自动切换」：加载优先用户导入的自定义音源脚本，setting 记为 auto
    activateAutoUserApi().catch(err => {
      if (!global.lx.apiInitPromise[1]) global.lx.apiInitPromise[2](false)
      console.log(err)
      let api = apiSourceInfo.find(api => !api.disabled)
      if (!api) return
      if (api.id != settingState.setting['common.apiSource']) setApiSource(api.id)
    })
  } else if (/^user_api/.test(apiId)) {
    setUserApi(apiId).then(() => {
      if (apiId !== USER_API_AUTO_ID) setLoadedSourceId(apiId)
    }).catch(err => {
      if (!global.lx.apiInitPromise[1]) global.lx.apiInitPromise[2](false)
      console.log(err)
      let api = apiSourceInfo.find(api => !api.disabled)
      if (!api) return
      if (api.id != settingState.setting['common.apiSource']) setApiSource(api.id)
    })
  } else {
    // @ts-expect-error
    global.lx.qualityList = musicSdk.supportQuality[apiId] ?? {}
    global.lx.apis = {}
    setLoadedSourceId(null)
    destroyUserApi()
    if (!global.lx.apiInitPromise[1]) global.lx.apiInitPromise[2](true)
    // apiSource.value = apiId
    // void setUserApiAction(apiId)
  }

  if (apiId != settingState.setting['common.apiSource']) {
    updateSetting({ 'common.apiSource': apiId })
    requestAnimationFrame(() => {
      global.state_event.apiSourceUpdated(apiId)
    })
  }
}

