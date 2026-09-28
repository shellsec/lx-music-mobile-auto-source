import { initSetting, showPactModal, updateSetting } from '@/core/common'
import registerPlaybackService from '@/plugins/player/service'
import initTheme from './theme'
import initI18n from './i18n'
import initUserApi from './userApi'
import initPlayer from './player'
import dataInit from './dataInit'
import initSync from './sync'
import initCommonState from './common'
import { initDeeplink } from './deeplink'
import { setApiSource } from '@/core/apiSource'
import commonActions from '@/store/common/action'
import settingState from '@/store/setting/state'
import { bootLog } from '@/utils/bootLog'
import { USER_API_AUTO_ID } from '@/sources/builtin'
import { ensureBuiltinUserApis } from '@/sources/builtin/ensure'

let isFirstPush = true
const handlePushedHomeScreen = async() => {
  // fork：跳过「谨防被骗」首启弹窗（cheatTip / @cheat_tip），不写存储
  if (settingState.setting['common.isAgreePact']) {
    if (isFirstPush) {
      isFirstPush = false
      // fork：冷启动不自动检查官方更新；手动入口在设置-版本
      void initDeeplink()
    }
  } else {
    if (isFirstPush) isFirstPush = false
    showPactModal()
  }
}

let isInited = false
export default async() => {
  if (isInited) return handlePushedHomeScreen
  bootLog('Initing...')
  commonActions.setFontSize(global.lx.fontSize)
  bootLog('Font size changed.')
  const setting = await initSetting()
  bootLog('Setting inited.')
  // console.log(setting)

  await initTheme(setting)
  bootLog('Theme inited.')
  await initI18n(setting)
  bootLog('I18n inited.')

  await initUserApi(setting)
  bootLog('User Api inited.')

  // 内置自定义音源 +「自动切换」：写入列表，默认走自动
  await ensureBuiltinUserApis()
  const legacyFlowerId = 'user_api_flower_builtin'
  const apiSource = setting['common.apiSource']
  if (!apiSource || apiSource === legacyFlowerId || apiSource === 'user_api_builtin_xinghai') {
    updateSetting({ 'common.apiSource': USER_API_AUTO_ID })
    setting['common.apiSource'] = USER_API_AUTO_ID
  }
  bootLog('Builtin User Apis ensured.')

  setApiSource(setting['common.apiSource'])
  bootLog('Api inited.')

  registerPlaybackService()
  bootLog('Playback Service Registered.')
  await initPlayer(setting)
  bootLog('Player inited.')
  await dataInit(setting)
  bootLog('Data inited.')
  await initCommonState(setting)
  bootLog('Common State inited.')

  void initSync(setting)
  bootLog('Sync inited.')

  // syncSetting()

  isInited ||= true

  return handlePushedHomeScreen
}
