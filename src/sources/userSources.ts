import { USER_API_AUTO_ID } from './constants'
import { getUserApiList, replaceUserApiList, removeUserApiScripts } from '@/utils/data'
import { setUserApiList } from '@/core/userApi'
import { state as userApiState } from '@/store/userApi/state'

export { USER_API_AUTO_ID }
let loadedSourceId: string | null = null
export const getLoadedSourceId = () => loadedSourceId
export const setLoadedSourceId = (id: string | null) => { loadedSourceId = id }
export const getLocalPlayableIds = (): string[] => userApiState.list.map(api => api.id)
export const resolveInitialSourceId = () => getLocalPlayableIds()[0] ?? ''
export const getSourceRetryOrder = (exclude: string[] = []) => getLocalPlayableIds().filter(id => !exclude.includes(id))

/** Upgrade migration removes previously provisioned entries, retaining user imports. */
export const initializeUserSources = async(): Promise<LX.UserApi.UserApiInfo[]> => {
  const existing = await getUserApiList()
  const removed = existing.filter(item => item.id === USER_API_AUTO_ID || item.id.startsWith('user_api_builtin_') || item.id.endsWith('_builtin'))
  const list = existing.filter(item => !removed.includes(item))
  if (removed.length) {
    await replaceUserApiList(list)
    await removeUserApiScripts(removed.map(item => item.id))
  }
  setUserApiList(list)
  return list
}
