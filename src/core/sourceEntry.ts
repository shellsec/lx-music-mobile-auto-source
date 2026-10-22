import { executeSourceEntry, type SourceEntry } from './sourceEntryCore'
import { importUserApi } from './userApi'
import { setApiSource } from './apiSource'
import { updateSetting } from './common'
import { state as userApiState } from '@/store/userApi/state'
import { updateRemoteCatalog } from '@/sources/remoteSourceFallback'
import { httpFetch } from '@/utils/request'

const operation = { importing: false }
export const addSourceEntry = async(entry: SourceEntry, isCurrent: () => boolean = () => true): Promise<string> => {
  const assertCurrent = () => { if (!isCurrent()) throw new Error('配置服务已关闭，请重新添加') }
  assertCurrent()
  if (operation.importing) throw new Error('正在添加源，请稍后再试')
  operation.importing = true
  try {
    return await executeSourceEntry(entry, {
      importScript: async(url) => {
        if (userApiState.list.length >= 20) throw new Error('自定义源数量已达到上限')
        const response = await httpFetch(url).promise
        const script = response.body
        assertCurrent()
        if (typeof script !== 'string' || script.length > 9_000_000) throw new Error('源脚本格式不正确或文件过大')
        const info = await importUserApi(script)
        return info.id
      },
      subscribe: async(url) => {
        const status = await updateRemoteCatalog(url, true, isCurrent)
        assertCurrent()
        if (status === 'unavailable') throw new Error('清单下载失败或格式不正确，本地源保持不变')
        updateSetting({ 'common.sourceListUrl': url })
        return userApiState.list.find(info => info.id.startsWith('user_api_subscription_'))?.id
      },
      activate: id => { assertCurrent(); setApiSource(id) },
    })
  } finally {
    operation.importing = false
  }
}
