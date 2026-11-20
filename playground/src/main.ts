/* oxlint-disable import/no-unassigned-import -- Vite loads the reset and styles for their side effects. */
import '@unocss/reset/tailwind-v4.css'
import 'virtual:uno.css'
import './theme.css'
import { createApp } from 'vue'
import App from './App.vue'

const app = createApp(App)

app.mount('#app')
