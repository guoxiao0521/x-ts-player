<template>
  <div class="relative flex w-full touch-none select-none items-center" :class="className">
    <div
      ref="trackRef"
      class="relative h-2 w-full grow overflow-hidden rounded-full bg-white/20"
      @mousedown="handleMouseDown"
      @touchstart="handleTouchStart"
    >
      <div
        class="absolute h-full bg-white/80 transition-all"
        :style="{ width: `${(modelValue[0] / max) * 100}%` }"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'

interface Props {
  modelValue: number[]
  max?: number
  step?: number
  className?: string
}

const props = withDefaults(defineProps<Props>(), {
  max: 100,
  step: 1,
  className: ''
})

const emit = defineEmits<{
  'update:modelValue': [value: number[]]
}>()

const trackRef = ref<HTMLElement | null>(null)
let isDragging = false

const updateValue = (clientX: number) => {
  if (!trackRef.value) return
  
  const rect = trackRef.value.getBoundingClientRect()
  const percentage = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width))
  const newValue = Math.round((percentage * props.max) / props.step) * props.step
  emit('update:modelValue', [newValue])
}

const handleMouseDown = (e: MouseEvent) => {
  isDragging = true
  updateValue(e.clientX)
  
  const handleMouseMove = (e: MouseEvent) => {
    if (isDragging) {
      updateValue(e.clientX)
    }
  }
  
  const handleMouseUp = () => {
    isDragging = false
    document.removeEventListener('mousemove', handleMouseMove)
    document.removeEventListener('mouseup', handleMouseUp)
  }
  
  document.addEventListener('mousemove', handleMouseMove)
  document.addEventListener('mouseup', handleMouseUp)
}

const handleTouchStart = (e: TouchEvent) => {
  isDragging = true
  if (e.touches[0]) {
    updateValue(e.touches[0].clientX)
  }
  
  const handleTouchMove = (e: TouchEvent) => {
    if (isDragging && e.touches[0]) {
      updateValue(e.touches[0].clientX)
    }
  }
  
  const handleTouchEnd = () => {
    isDragging = false
    document.removeEventListener('touchmove', handleTouchMove)
    document.removeEventListener('touchend', handleTouchEnd)
  }
  
  document.addEventListener('touchmove', handleTouchMove)
  document.addEventListener('touchend', handleTouchEnd)
}
</script>


