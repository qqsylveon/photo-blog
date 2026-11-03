import { homeEntryBootstrap } from './app/utils/home-entry'

export default defineNuxtConfig({
  buildDir: process.env.JOURNAL_BUILD_DIR || '.nuxt',
  devServer: { host: '127.0.0.1' },
  compatibilityDate: '2026-10-25',
  css: ['~/assets/css/main.css', '~/assets/css/admin.css', '~/assets/css/notebook.css', '~/assets/css/workspace-ui.css'],
  devtools: { enabled: false },
  runtimeConfig: { public: { icpNumber: '' } },
  routeRules: { '/stories/**': { redirect: '/gallery' }, '/admin/stories/**': { redirect: '/admin' } },
  vite: {
    cacheDir: process.env.JOURNAL_BUILD_DIR ? `${process.env.JOURNAL_BUILD_DIR}/vite-cache` : 'node_modules/.cache/vite',
    optimizeDeps: { include: ['lenis', 'gsap', 'gsap/ScrollTrigger'] }
  },
  app: {
    head: {
      htmlAttrs: { lang: 'zh-CN' },
      script: [{ key: 'home-entry-bootstrap', innerHTML: homeEntryBootstrap }, {
        key: 'theme-bootstrap',
        innerHTML: `(function(){var p='system';try{var s=localStorage.getItem('photo-journal-theme');if(s==='dark'||s==='light')p=s}catch(e){}var d=p;if(p==='system'){try{d=matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'}catch(e){d='light'}}document.documentElement.dataset.theme=d;document.documentElement.dataset.themePreference=p})()`
      }]
    }
  },
  typescript: { typeCheck: true }
})
