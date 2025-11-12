<template>
  <button
    :class="[
      'relative h-9 md:h-10 rounded-full px-3.5 md:px-4 inline-flex items-center gap-2',
      'text-white/90 backdrop-blur-xl bg-white/12 border border-white/20',
      'shadow-[inset_0_1px_0_rgba(255,255,255,.35),0_8px_30px_rgba(0,0,0,.35)]',
      'transition-all hover:scale-[1.02] active:scale-[0.98]'
    ]"
    @click="$emit('click')"
  >
    <div class="relative size-6 grid place-items-center">
      <div class="absolute inset-0 rounded-full bg-gradient-to-br from-white/40 to-white/10 opacity-70" />
      <div class="absolute inset-0 rounded-full ring-1 ring-white/30" />
      <span class="relative">
        <slot :name="active ? 'iconActive' : 'iconInactive'" />
      </span>
    </div>
    <span class="text-xs md:text-sm tracking-wide">
      {{ active ? activeLabel : inactiveLabel }}
    </span>
  </button>
</template>

<script setup lang="ts">
defineProps<{
  active: boolean
  activeLabel: string
  inactiveLabel: string
}>()

defineEmits<{
  click: []
}>()
</script>

