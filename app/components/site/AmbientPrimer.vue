<script setup lang="ts">
import { nightStars } from '~/utils/ambient-night'
defineProps<{ ready: boolean; enabled: boolean }>()
const stars = nightStars.slice(0, 64)
</script>

<template>
  <div class="ambient-primer" data-ambient-primer :data-ready="ready" :data-enabled="enabled" aria-hidden="true">
    <svg class="ambient-primer__pond" data-primer-scene="light" width="100%" height="100%">
      <g fill="none" stroke="currentColor" stroke-width=".8">
        <g class="ambient-primer__ripples" opacity=".2">
          <ellipse cx="49%" cy="46%" rx="8%" ry="2.5%" />
          <ellipse cx="49%" cy="46%" rx="13%" ry="4.1%" opacity=".65" />
          <ellipse cx="49%" cy="46%" rx="19%" ry="6%" opacity=".35" />
        </g>
        <g opacity=".16">
          <ellipse cx="12%" cy="27%" rx="5%" ry="1.3%" />
          <ellipse cx="12%" cy="27%" rx="8%" ry="2.1%" opacity=".5" />
          <ellipse cx="86%" cy="76%" rx="7%" ry="1.8%" />
          <ellipse cx="86%" cy="76%" rx="11%" ry="2.9%" opacity=".5" />
        </g>
      </g>
    </svg>
    <svg class="ambient-primer__night" data-primer-scene="dark" width="100%" height="100%">
      <circle v-for="(star, index) in stars" :key="index" :cx="`${star.x * 100}%`" :cy="`${star.y * 100}%`" :r="star.radius" :fill="star.warm ? '#f5dcb3' : '#d5e8ff'" opacity=".55" />
    </svg>
  </div>
</template>

<style scoped>
.ambient-primer {
  position:fixed; inset:0; z-index:-1; pointer-events:none; opacity:1;
  color:#6c9692;
  background:linear-gradient(169deg,rgba(205,224,218,.085),rgba(166,204,193,.136) 45%,rgba(127,178,172,.1785));
}
.ambient-primer svg { position:absolute; inset:0; }
.ambient-primer__night { display:none; }
.ambient-primer__ripples { transform-origin:49% 46%; animation:primer-water-breath 4.8s ease-in-out infinite; }
.ambient-primer[data-ready="true"] { animation:primer-dissolve 900ms cubic-bezier(.22,.61,.36,1) both; }
.ambient-primer[data-ready="true"] .ambient-primer__ripples { animation-play-state:paused; }
.ambient-primer[data-enabled="false"],:global(html[data-ambient-enabled="off"] .ambient-primer) { display:none; }
:global(:root[data-theme="dark"] .ambient-primer) { background:none; }
:global(:root[data-theme="dark"] .ambient-primer__pond) { display:none; }
:global(:root[data-theme="dark"] .ambient-primer__night) { display:block; }
@keyframes primer-dissolve { from { opacity:1; } to { opacity:0; } }
@keyframes primer-water-breath { 0%,100% { transform:scale(.96); opacity:.13; } 50% { transform:scale(1.05); opacity:.23; } }
@media(prefers-reduced-motion:reduce) { .ambient-primer[data-ready="true"],.ambient-primer__ripples { animation:none; } }
</style>
