import type { BuildOSDesktopApi } from '../../../electron/preload';

declare global {
  interface Window {
    buildos: BuildOSDesktopApi;
  }
}

export {};
