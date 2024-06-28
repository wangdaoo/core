import { createApp } from 'vue'
import './style.css'
import App from './App.vue'
import { i18nPlugin } from './plugins/i18nPlugin'

// createApp(App).mount('#app')
const app = createApp(App)

const messages = {
  en: {
    hello: 'Hello, World!',
  },
  ja: {
    hello: 'こんにちは、世界！',
  },
  fr: {
    hello: 'Bonjour, le monde!',
  },
}

app.use(i18nPlugin, {
  locale: 'fr',
  messages,
})

app.mount('#app')
