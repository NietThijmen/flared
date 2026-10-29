import type {
  BinaryStatus,
  DownloadMode,
  DownloadOptions,
  Job,
  MediaInfo,
  QuickResult,
  Result,
  Settings
} from './types'

/** Request/response channels (ipcRenderer.invoke -> ipcMain.handle). */
export interface InvokeMap {
  'media:probe': (url: string) => Result<MediaInfo>
  'queue:add': (
    items: { url: string; title: string; thumbnail: string | null }[],
    options: DownloadOptions
  ) => Job[]
  'queue:list': () => Job[]
  'queue:cancel': (id: string) => void
  'queue:retry': (id: string) => void
  'queue:remove': (id: string) => void
  'history:list': () => Job[]
  'history:clear': () => void
  'settings:get': () => Settings
  'settings:set': (patch: Partial<Settings>) => Settings
  'settings:pickDir': () => string | null
  'binaries:status': () => BinaryStatus
  'binaries:update': () => BinaryStatus
  'shell:reveal': (path: string) => void
  'shell:openExternal': (url: string) => void
  'shell:openFolder': () => void
  'clipboard:read': () => string
  'quick:submit': (url: string, mode: DownloadMode) => Result<QuickResult>
  'quick:openInApp': (url: string) => void
  'quick:hide': () => void
  'logs:get': () => string
  'logs:clear': () => void
}

/** Main -> renderer push events. */
export interface EventMap {
  'queue:update': Job
  'queue:removed': string
  'binaries:status': BinaryStatus
  'clipboard:url': string
}

export type InvokeChannel = keyof InvokeMap
export type EventChannel = keyof EventMap

export const INVOKE_CHANNELS: InvokeChannel[] = [
  'media:probe',
  'queue:add',
  'queue:list',
  'queue:cancel',
  'queue:retry',
  'queue:remove',
  'history:list',
  'history:clear',
  'settings:get',
  'settings:set',
  'settings:pickDir',
  'binaries:status',
  'binaries:update',
  'shell:reveal',
  'shell:openExternal',
  'shell:openFolder',
  'clipboard:read',
  'quick:submit',
  'quick:openInApp',
  'quick:hide',
  'logs:get',
  'logs:clear'
]

export const EVENT_CHANNELS: EventChannel[] = [
  'queue:update',
  'queue:removed',
  'binaries:status',
  'clipboard:url'
]

export type FlaredApi = {
  [K in InvokeChannel]: (...args: Parameters<InvokeMap[K]>) => Promise<ReturnType<InvokeMap[K]>>
} & {
  on<K extends EventChannel>(channel: K, cb: (payload: EventMap[K]) => void): () => void
}
