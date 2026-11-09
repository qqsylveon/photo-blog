<script setup lang="ts">
import { defaultSiteCopy } from '#shared/notebook'
import { computed } from 'vue'
const props = withDefaults(defineProps<{ quote?: string; linkLabel?: string }>(), { quote: defaultSiteCopy.homeQuote, linkLabel: defaultSiteCopy.homeLinkLabel })
const lines = computed(() => props.quote.split(/\r?\n/).map(line => Array.from(line)))
</script>
<template>
  <section id="home-intro" class="gallery-invitation" aria-labelledby="gallery-invitation-title" data-home-motion="gallery-invitation">
    <h1 id="gallery-invitation-title" :aria-label="quote">
      <span v-for="(line, row) in lines" :key="row" class="home-quote-line" aria-hidden="true"><span v-for="(character, index) in line" :key="index" class="home-glyph-mask"><span class="home-glyph" data-home-motion="gallery-character">{{ character }}</span></span><br v-if="!line.length"></span>
    </h1>
    <div class="gallery-invitation__line" aria-hidden="true" data-home-motion="gallery-copy" />
    <NuxtLink class="text-link text-link--large" to="/gallery" data-home-motion="gallery-copy">{{ linkLabel }} ↗</NuxtLink>
  </section>
</template>
