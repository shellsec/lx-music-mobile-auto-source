import { memo, useCallback, useMemo, useRef, useState } from 'react'

import { View, TextInput } from 'react-native'

import SubTitle from '../../components/SubTitle'
import CheckBox from '@/components/common/CheckBox'
import { createStyle } from '@/utils/tools'
import { setApiSource } from '@/core/apiSource'
import { useI18n } from '@/lang'
import apiSourceInfo from '@/utils/musicSdk/api-source-info'
import { useSettingValue } from '@/store/setting/hook'
import { useStatus, useUserApiList } from '@/store/userApi'
import Button from '../../components/Button'
import UserApiEditModal, { type UserApiEditModalType } from './UserApiEditModal'
import Text from '@/components/common/Text'
import { useTheme } from '@/store/theme/hook'
import { updateSetting } from '@/core/common'
import { state as userApiState } from '@/store/userApi/state'
import { applyRemoteSourceFallback } from '@/sources/remoteSourceFallback'

const apiSourceList = apiSourceInfo.map(api => ({
  id: api.id,
  name: api.name,
  disabled: api.disabled,
}))

const useActive = (id: string) => {
  const activeLangId = useSettingValue('common.apiSource')
  const isActive = useMemo(() => activeLangId == id, [activeLangId, id])
  return isActive
}

const Item = ({ id, name, desc, statusLabel, change }: {
  id: string
  name: string
  desc?: string
  statusLabel?: string
  change: (id: string) => void
}) => {
  const isActive = useActive(id)
  const theme = useTheme()
  // const [toggleCheckBox, setToggleCheckBox] = useState(false)
  return (
    <CheckBox marginBottom={5} check={isActive} onChange={() => { change(id) }} need>
      <Text style={styles.sourceLabel}>
        {name}
        {
          desc ? <Text style={styles.sourceDesc} color={theme['c-500']} size={13}>  {desc}</Text> : null
        }
        {
          statusLabel ? <Text style={styles.sourceStatus} size={13}>  {statusLabel}</Text> : null
        }
      </Text>
    </CheckBox>
  )
}

export default memo(() => {
  const savedCatalogUrl = useSettingValue('common.sourceListUrl')
  const [catalogUrl, setCatalogUrl] = useState(savedCatalogUrl)
  const [updating, setUpdating] = useState(false)
  const [updateMessage, setUpdateMessage] = useState('')
  const updateCatalog = async() => {
    if (updating) return
    setUpdating(true)
    try {
      const url = catalogUrl.trim()
      if (url && !/^https?:\/\//i.test(url)) {
        setUpdateMessage('请输入有效的源清单地址')
        return
      }
      updateSetting({ 'common.sourceListUrl': url })
      if (!url) {
        setUpdateMessage('订阅已清除，自动更新已停用')
        return
      }
      const changed = await applyRemoteSourceFallback(url, true)
      if (changed) {
        const selected = apiSourceSetting === 'user_api_auto' || userApiState.list.some(item => item.id === apiSourceSetting)
          ? apiSourceSetting : userApiState.list[0]?.id ?? ''
        setApiSource(selected)
      }
      setUpdateMessage(changed ? '订阅已保存并更新，失效时将自动检查更新' : '订阅已保存；清单无变化或暂时无法下载，失效时会自动检查')
    } catch {
      setUpdateMessage('清单更新失败')
    } finally {
      setUpdating(false)
    }
  }
  const t = useI18n()
  const list = useMemo(() => apiSourceList.map(s => ({
    // @ts-expect-error
    name: t(`setting_basic_source_${s.id}`) || s.name,
    id: s.id,
  })), [t])
  const setApiSourceId = useCallback((id: string) => {
    setApiSource(id)
  }, [])
  const userApiListRaw = useUserApiList()
  const apiStatus = useStatus()
  const apiSourceSetting = useSettingValue('common.apiSource')
  const userApiList = useMemo(() => {
    const getApiStatus = () => {
      let status
      if (apiStatus.status) status = t('setting_basic_source_status_success')
      else if (apiStatus.message == 'initing') status = t('setting_basic_source_status_initing')
      else status = t('setting_basic_source_status_failed')

      return status
    }
    return userApiListRaw.map(api => {
      const statusLabel = api.id == apiSourceSetting ? `[${getApiStatus()}]` : ''
      return {
        id: api.id,
        name: api.name,
        label: `${api.name}${statusLabel}`,
        desc: [/^\d/.test(api.version) ? `v${api.version}` : api.version].filter(Boolean).join(', '),
        statusLabel,
        // status: apiStatus.status,
        // message: apiStatus.message,
        // disabled: false,
      }
    })
  }, [userApiListRaw, apiStatus, apiSourceSetting, t])

  const modalRef = useRef<UserApiEditModalType>(null)
  const handleShow = () => {
    modalRef.current?.show()
  }

  return (
    <SubTitle title={t('setting_basic_source')}>
      <View style={styles.list}>
        {!userApiList.length ? <Text>请在设置中导入自定义源</Text> : (
          <Item name="多源自动切换" id="user_api_auto" change={id => { setApiSourceId(apiSourceSetting === id ? userApiList[0].id : id) }} />
        )}
        {
          list.map(({ id, name }) => <Item name={name} id={id} key={id} change={setApiSourceId} />)
        }
        {
          userApiList.map(({ id, name, desc, statusLabel }) => <Item name={name} desc={desc} statusLabel={statusLabel} id={id} key={id} change={setApiSourceId} />)
        }
      </View>
      <View style={styles.btn}>
        <Button onPress={handleShow}>{t('setting_basic_source_user_api_btn')}</Button>
      </View>
      <TextInput value={catalogUrl} onChangeText={setCatalogUrl} placeholder="https://example.com/sources.json" accessibilityLabel="源清单地址" autoCapitalize="none" />
      <Button disabled={updating} onPress={() => { void updateCatalog() }}>{updating ? '更新中…' : '保存并更新订阅'}</Button>
      {updateMessage ? <Text>{updateMessage}</Text> : null}
      <UserApiEditModal ref={modalRef} />
    </SubTitle>
  )
})

const styles = createStyle({
  list: {
    flexGrow: 0,
    flexShrink: 1,
    // flexDirection: 'row',
    // flexWrap: 'wrap',
  },
  btn: {
    marginTop: 10,
    flexDirection: 'row',
  },
  sourceLabel: {

  },
  sourceDesc: {

  },
  sourceStatus: {

  },
})
