import { NativeModules, NativeEventEmitter, type NativeModule } from 'react-native'
import { type SourceEntry } from '@/core/sourceEntryCore'

const native = NativeModules.SourceEntryModule
export const quickAddSupported = Boolean(native)
export interface LanSession { id: string, address: string, code: string, qrImage: string, expiresAt: number }
export interface LanRequest extends SourceEntry { id: string, session: string, expiresAt: number }
const emitter = native ? new NativeEventEmitter(native as NativeModule) : null
export const scanSourceCode = async(): Promise<string | null> => native.scan()
export const decodeSourceImage = async(path: string): Promise<string> => native.decodeImage(path)
export const startSourceServer = async(): Promise<LanSession> => native.startServer()
export const stopSourceServer = async(): Promise<void> => native?.stopServer()
export const completeSourceRequest = (id: string, ok: boolean, message: string) => native.completeRequest(id, ok, message)
export const onSourceRequest = (callback: (request: LanRequest) => void) => emitter?.addListener('source-entry-request', callback)
export const onSourceServerStopped = (callback: () => void) => emitter?.addListener('source-entry-stopped', callback)
