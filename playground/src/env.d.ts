/// <reference types="vite/client" />

declare module '*.vue' {
  import type { DefineComponent } from 'vue'

  const component: DefineComponent
  export default component
}

declare module '*?raw&highlight' {
  const preview: { source: string; html: string }
  export default preview
}
