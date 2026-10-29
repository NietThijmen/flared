import type { FlaredApi } from '../shared/ipc'

declare global {
  interface Window {
    api: FlaredApi
  }
}
