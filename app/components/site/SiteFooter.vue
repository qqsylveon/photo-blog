<script setup lang="ts">
const { public: { icpNumber } } = useRuntimeConfig()
withDefaults(defineProps<{ showRegistration?: boolean }>(), { showRegistration: true })
const registrationNumber = icpNumber || '豫ICP备2026056885号'
</script>

<template>
  <footer class="site-footer" :class="{ 'site-footer--simple': !showRegistration }">
    <p>慢慢拍，慢慢记。</p>
    <p v-if="showRegistration" class="site-footer__registration">
      <a href="http://beian.miit.gov.cn/" target="_blank" rel="noopener noreferrer">{{ registrationNumber }}</a>
    </p>
    <p class="site-footer__meta">个人摄影相册</p>
  </footer>
</template>
