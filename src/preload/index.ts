import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron'
import { EVENT_CHANNELS, INVOKE_CHANNELS, type EventChannel, type FlaredApi } from '../shared/ipc'

const api = {
  on(channel: EventChannel, cb: (payload: never) => void) {
    if (!EVENT_CHANNELS.includes(channel)) throw new Error(`Unknown channel ${channel}`)
    const listener = (_event: IpcRendererEvent, payload: unknown): void => cb(payload as never)
    ipcRenderer.on(channel, listener)
    return () => ipcRenderer.removeListener(channel, listener)
  }
} as Record<string, unknown>

for (const channel of INVOKE_CHANNELS) {
  api[channel] = (...args: unknown[]) => ipcRenderer.invoke(channel, ...args)
}

contextBridge.exposeInMainWorld('api', api as unknown as FlaredApi)
