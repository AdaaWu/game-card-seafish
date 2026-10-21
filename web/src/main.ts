import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import { router } from './router'
import { useProgressStore } from './stores/progress'
import { useSettingsStore } from './stores/settings'
import './style.css'

// Google Fonts：Noto Sans TC 與圓體數字
const fontLink = document.createElement('link')
fontLink.rel = 'stylesheet'
fontLink.href =
  'https://fonts.googleapis.com/css2?family=M+PLUS+Rounded+1c:wght@500;800&family=Noto+Sans+TC:wght@500;700;900&display=swap'
document.head.appendChild(fontLink)
document.documentElement.lang = 'zh-Hant-TW'

const pinia = createPinia()
const app = createApp(App).use(pinia).use(router)

// 先載入存檔再掛載，存檔失敗時以預設值啟動
void Promise.allSettled([useProgressStore(pinia).init(), useSettingsStore(pinia).init()]).then(() =>
  app.mount('#app'),
)
