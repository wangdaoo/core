import type { I8nPlugin } from './plugins/i18nPlugin'

declare module '@vue/runtime-core' {
  interface ComponentCustomProperties {
    i18n: I8nPlugin
  }
}
