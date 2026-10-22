import { useEffect, useRef, useState } from 'react'
import { AppState, Image, TextInput, View } from 'react-native'
import Clipboard from '@react-native-clipboard/clipboard'
import Text from '@/components/common/Text'
import CheckBox from '@/components/common/CheckBox'
import Button from '../../components/Button'
import { selectFile } from '@/utils/fs'
import { addSourceEntry } from '@/core/sourceEntry'
import { parseSourceAddress, type SourceEntryKind } from '@/core/sourceEntryCore'
import { useTheme } from '@/store/theme/hook'
import {
  quickAddSupported, scanSourceCode, decodeSourceImage, startSourceServer, stopSourceServer,
  onSourceRequest, onSourceServerStopped, completeSourceRequest, type LanSession,
} from '@/utils/nativeModules/sourceEntry'

export default function SourceQuickAdd() {
  const theme = useTheme()
  const [url, setUrl] = useState('')
  const [kind, setKind] = useState<SourceEntryKind>('script')
  const [enable, setEnable] = useState(true)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [session, setSession] = useState<LanSession | null>(null)
  const sessionRef = useRef<LanSession | null>(null)
  const mounted = useRef(true)
  const generation = useRef(0)
  const errorMessage = (error: unknown) => error instanceof Error ? error.message : String(error)
  const stop = () => {
    generation.current++
    sessionRef.current = null
    if (mounted.current) setSession(null)
    void stopSourceServer()
  }
  useEffect(() => {
    mounted.current = true
    const stopped = onSourceServerStopped(() => {
      sessionRef.current = null
      if (mounted.current) setSession(null)
    })
    const requests = onSourceRequest(request => {
      const current = () => mounted.current && sessionRef.current?.id === request.session && AppState.currentState === 'active' && Date.now() < request.expiresAt
      if (!current()) {
        completeSourceRequest(request.id, false, '配置服务已关闭')
        return
      }
      void addSourceEntry(request, current).then(result => {
        completeSourceRequest(request.id, true, result)
        if (mounted.current) setMessage(result)
      }).catch(error => {
        completeSourceRequest(request.id, false, errorMessage(error))
        if (mounted.current) setMessage(errorMessage(error))
      })
    })
    const app = AppState.addEventListener('change', state => { if (state !== 'active') stop() })
    const navigation = (id: string) => { if (id !== 'nav_setting') stop() }
    global.state_event.on('navActiveIdUpdated', navigation)
    return () => {
      mounted.current = false
      stop()
      stopped?.remove()
      requests?.remove()
      app.remove()
      global.state_event.off('navActiveIdUpdated', navigation)
    }
  }, [])
  const run = async(action: () => Promise<void>) => {
    if (busy) return
    setBusy(true)
    setMessage('')
    try { await action() } catch (error) { if (mounted.current) setMessage(errorMessage(error)) } finally { if (mounted.current) setBusy(false) }
  }
  const accept = (value: string | null) => {
    if (value === null) return
    setUrl(parseSourceAddress(value))
    setMessage('请确认地址类型及启用选项，再点击添加')
  }
  if (!quickAddSupported) return null
  return (
    <View style={{ marginTop: 12, gap: 8 }}>
      <Text>快速添加自定义源</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        <Button disabled={busy} onPress={() => { void run(async() => { accept(await scanSourceCode()) }) }}>扫一扫</Button>
        <Button disabled={busy} onPress={() => {
          void run(async() => {
            const file = await selectFile({ mimeTypes: ['image/*'] })
            accept(await decodeSourceImage(file.path))
          })
        }}>从图片识别</Button>
        <Button disabled={busy} onPress={() => { void run(async() => { accept(await Clipboard.getString()) }) }}>粘贴链接</Button>
      </View>
      <TextInput value={url} onChangeText={setUrl} placeholder="输入源链接或订阅地址" accessibilityLabel="快速添加地址" autoCapitalize="none" autoCorrect={false} style={{ color: theme['c-font'] }} />
      <CheckBox check={kind === 'script'} need onChange={() => { setKind('script') }}><Text>导入单个源</Text></CheckBox>
      <CheckBox check={kind === 'subscription'} need onChange={() => { setKind('subscription') }}><Text>添加订阅清单</Text></CheckBox>
      <CheckBox check={enable} onChange={() => { setEnable(!enable) }}><Text>添加后启用</Text></CheckBox>
      <Button disabled={busy || !url.trim()} onPress={() => {
        void run(async() => { const result = await addSourceEntry({ url, kind, enable }); setMessage(result); setUrl('') })
      }}>{busy ? '处理中…' : '确认添加'}</Button>
      <Button disabled={busy} onPress={() => {
        if (session) { stop(); return }
        void run(async() => {
          const intent = generation.current
          const next = await startSourceServer()
          if (!mounted.current || intent !== generation.current || AppState.currentState !== 'active') { void stopSourceServer(); return }
          sessionRef.current = next
          setSession(next)
        })
      }}>{session ? '关闭 HTTP 网页' : '启用 HTTP 网页'}</Button>
      {session ? <View style={{ gap: 8 }}>
        <Text>另一台设备连接同一 Wi-Fi 后扫码访问。二维码包含临时凭证，请勿分享给他人。</Text>
        <Image source={{ uri: session.qrImage }} style={{ width: 200, height: 200, backgroundColor: '#fff' }} accessibilityLabel="临时配置网页二维码" />
        <Text selectable>{session.address}</Text>
        <Text selectable>手动打开地址时输入配对码：{session.code}</Text>
        <Text>10 分钟后自动关闭；离开设置或切到后台也会关闭。添加源脚本后启用会运行该脚本，请仅添加可信内容。</Text>
      </View> : null}
      {message ? <Text>{message}</Text> : null}
    </View>
  )
}
