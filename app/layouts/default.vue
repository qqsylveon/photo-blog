<script setup lang="ts">const route=useRoute()</script>
<template>
  <div class="site-shell" :class="{'site-shell--notebook':route.path==='/about','site-shell--home':route.path==='/'}">
    <SiteAmbientBackground />
    <SiteHeader />
    <main id="main-content" class="site-main">
      <slot />
    </main>
    <SiteFooter :show-registration="route.path === '/'" />
    <SiteRouteCurtain />
  </div>
</template>
