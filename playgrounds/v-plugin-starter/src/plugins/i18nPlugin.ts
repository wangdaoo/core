import { type App, type Plugin, reactive } from 'vue'

interface I8nPlugin {
  setLocale: (locale: string) => void
  getLocale: () => string
  formatDate: (date: Date) => string
  formatNumber: (number: number) => string
  t: (key: string) => string
}

const i18nPlugin: Plugin = {
  install(
    app: App,
    options: {
      locale?: string
      messages?: Record<string, Record<string, string>>
    },
  ) {
    const state = reactive({
      locale: options.locale || 'en',
      messages: options.messages || {},
    })

    const i18n: I8nPlugin = {
      setLocale(locale: string) {
        state.locale = locale
      },

      t(key: string) {
        return state.messages[state.locale][key] || key
      },

      getLocale() {
        return state.locale
      },

      /**
       * @description 根据当前语言环境格式化日期
       * 如果是英文环境，返回 "12/20/2021"
       * 如果时法文环境，返回 "20/12/2021"
       * @param {Date} date
       * @returns {string}
       */
      formatDate(date: Date): string {
        return new Intl.DateTimeFormat(state.locale).format(date)
      },

      /**
       * @description 根据当前语言环境格式化数字
       * 如果是英文环境，返回 "1,000,000"
       * 如果时法文环境，返回 "1 000.000"
       * @param {number} number
       * @returns {string}
       */
      formatNumber(number: number): string {
        return new Intl.NumberFormat(state.locale).format(number)
      },
    }

    app.config.globalProperties.i18n = i18n

    app.provide('i18n', i18n)

    app.directive('t', {
      beforeMount(el, binding) {
        el.innerText = i18n.t(binding.value)
      },
      updated(el, binding) {
        el.innerText = i18n.t(binding.value)
      },
    })
  },
}

export { i18nPlugin, type I8nPlugin }
