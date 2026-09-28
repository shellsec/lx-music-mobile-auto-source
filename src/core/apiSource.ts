// import { setUserApi as setUserApiAction } from '@renderer/utils/ipc'
import musicSdk from '@/utils/musicSdk'
// import apiSourceInfo from '@renderer/utils/musicSdk/api-source-info'
import { updateSetting } from './common'
import settingState from '@/store/setting/state'
import { destroyUserApi, setUserApi } from './userApi'
import apiSourceInfo from '@/utils/musicSdk/api-source-info'
import { BUILTIN_USER_API_IDS, USER_API_AUTO_ID } from '@/sources/builtin'
import { setLoadedBuiltinId } from '@/sources/builtin/ensure'
import { activateAutoUserApi } from './userApiFailover'


export const setApiSource = (apiId: string) => {
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
    // 「自动切换」：加载优先内置自定义音源脚本，setting 记为 auto
    activateAutoUserApi().catch(err => {
      if (!global.lx.apiInitPromise[1]) global.lx.apiInitPromise[2](false)
      console.log(err)
      let api = apiSourceInfo.find(api => !api.disabled)
      if (!api) return
      if (api.id != settingState.setting['common.apiSource']) setApiSource(api.id)
    })
  } else if (/^user_api/.test(apiId)) {
    setUserApi(apiId).then(() => {
      if (BUILTIN_USER_API_IDS.includes(apiId)) setLoadedBuiltinId(apiId)
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

