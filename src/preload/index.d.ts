import type { BbboardAPI } from './index'

declare global {
  interface Window {
    api: BbboardAPI
  }
}
