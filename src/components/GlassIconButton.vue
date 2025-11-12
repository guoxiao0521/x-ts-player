<template>
  <button
    :class="[
      'size-9 rounded-xl p-0 grid place-items-center',
      'backdrop-blur-xl bg-white/10 hover:bg-white/15',
      'border border-white/15 hover:border-white/20',
      'shadow-[inset_0_1px_0_rgba(255,255,255,.35),0_6px_24px_rgba(0,0,0,.30)]',
      'text-white/90 transition-all',
      className
    ]"
    v-bind="$attrs"
  >
    <slot />
  </button>
</template>

<script setup lang="ts">
defineProps<{
  className?: string
}>()
</script>


