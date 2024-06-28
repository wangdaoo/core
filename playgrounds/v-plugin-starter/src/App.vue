<script setup lang="ts">
import { inject } from 'vue'
import HelloWorld from './components/HelloWorld.vue'
import { I8nPlugin } from './plugins/i18nPlugin'

const i18n = inject('i18n') as I8nPlugin

const change = () => {
  console.log(i18n);
  const locale = i18n.getLocale()
  i18n.setLocale(locale === 'en' ? 'fr' : 'en')

  console.log(i18n.formatDate(new Date()));
  console.log(i18n.formatNumber(1000.56))
}
</script>

<template>
  <div>
    <a href="https://vitejs.dev" target="_blank">
      <img src="/vite.svg" class="logo" alt="Vite logo" />
    </a>
    <a href="https://vuejs.org/" target="_blank">
      <img src="./assets/vue.svg" class="logo vue" alt="Vue logo" />
    </a>
  </div>
  <h1>{{ i18n.t('hello') }}</h1>
  <h3 v-t="'hello'"></h3>

  <button @click="change">Change Language</button>
  <HelloWorld msg="Vite + Vue" />
</template>

<style scoped>
.logo {
  height: 6em;
  padding: 1.5em;
  will-change: filter;
  transition: filter 300ms;
}
.logo:hover {
  filter: drop-shadow(0 0 2em #646cffaa);
}
.logo.vue:hover {
  filter: drop-shadow(0 0 2em #42b883aa);
}
</style>
