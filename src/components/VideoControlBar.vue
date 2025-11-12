<template>
  <div
    ref="controlsRef"
    class="absolute left-5 right-5 bottom-5"
  >
    <div class="backdrop-blur-2xl bg-white/10 rounded-2xl md:rounded-3xl border border-white/15 shadow-[inset_0_1px_0_rgba(255,255,255,.35),0_12px_60px_rgba(0,0,0,.45)]">
      <!-- 进度条 -->
      <div class="px-4 sm:px-6 pt-4 sm:pt-5">
        <Slider v-model="progressValue" :max="duration || 100" />
        <div class="mt-2 flex items-center justify-between text-[11px] text-white/70">
          <span>{{ formatTime(currentTime) }}</span>
          <span>{{ formatTime(duration) }}</span>
        </div>
      </div>

      <!-- 控件行 -->
      <div class="flex flex-wrap items-center gap-2 sm:gap-3 px-3 sm:px-4 py-3">
        <!-- 左侧：播放组 -->
        <div class="flex items-center gap-2 sm:gap-3">
          <GlassIconButton aria-label="后退 10 秒" @click="$emit('skip-back')">
            <SkipBack class="size-4" />
          </GlassIconButton>
          <GlassPillToggle
            :active="playing"
            active-label="暂停"
            inactive-label="播放"
            @click="$emit('play-pause')"
          >
            <template #iconActive>
              <Pause class="size-4" />
            </template>
            <template #iconInactive>
              <Play class="size-4 translate-x-[1px]" />
            </template>
          </GlassPillToggle>
          <GlassIconButton aria-label="前进 10 秒" @click="$emit('skip-forward')">
            <SkipForward class="size-4" />
          </GlassIconButton>
        </div>

        <!-- 中部：音量组 -->
        <div class="ml-auto md:ml-6 flex items-center gap-3">
          <GlassIconButton
            :aria-label="muted ? '取消静音' : '静音'"
            @click="$emit('toggle-mute')"
          >
            <VolumeX v-if="muted" class="size-4" />
            <Volume2 v-else class="size-4" />
          </GlassIconButton>
          <div class="w-[120px] hidden sm:block">
            <Slider v-model="volumeValue" :max="100" />
          </div>
        </div>

        <!-- 右侧：功能组 -->
        <div class="ml-auto flex items-center gap-2 sm:gap-3">
          <GlassIconButton aria-label="AirPlay" @click="$emit('airplay')">
            <Airplay class="size-4" />
          </GlassIconButton>
          <GlassIconButton aria-label="设置" @click="$emit('settings')">
            <Settings class="size-4" />
          </GlassIconButton>
          <GlassIconButton aria-label="全屏" @click="$emit('fullscreen')">
            <Maximize2 class="size-4" />
          </GlassIconButton>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { useMotion } from '@vueuse/motion';
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  Settings,
  Maximize2,
  Airplay,
  SkipBack,
  SkipForward,
} from 'lucide-vue-next';
import Slider from './ui/Slider.vue';
import GlassIconButton from './GlassIconButton.vue';
import GlassPillToggle from './GlassPillToggle.vue';

interface Props {
  playing: boolean;
  muted: boolean;
  volume: number[];
  progress: number[];
  currentTime?: number; // 当前播放时间（秒）
  duration?: number; // 总时长（秒）
}

const props = withDefaults(defineProps<Props>(), {
  currentTime: 0,
  duration: 0,
});

const emit = defineEmits<{
  'update:playing': [value: boolean];
  'update:muted': [value: boolean];
  'update:volume': [value: number[]];
  'update:progress': [value: number[]];
  'play-pause': [];
  'skip-back': [];
  'skip-forward': [];
  'toggle-mute': [];
  'airplay': [];
  'settings': [];
  'fullscreen': [];
  'seek': [time: number]; // 跳转到指定时间
}>();

// 使用 computed 来处理双向绑定
// 进度条基于 currentTime 和 duration 计算
const progressValue = computed({
  get: () => {
    if (props.duration > 0) {
      return [props.currentTime];
    }
    return props.progress;
  },
  set: (value) => {
    emit('update:progress', value);
    // 如果 duration 存在，触发 seek 事件
    if (props.duration > 0 && value[0] !== undefined) {
      emit('seek', value[0]);
    }
  },
});

const volumeValue = computed({
  get: () => props.volume,
  set: (value) => emit('update:volume', value),
});

// 格式化时间显示
const formatTime = (seconds: number): string => {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
};

// 动画引用
const controlsRef = ref<HTMLElement | null>(null);
useMotion(controlsRef, {
  initial: { y: 28, opacity: 0 },
  enter: { y: 0, opacity: 1 },
  transition: { type: 'spring', stiffness: 140, damping: 18 }
});
</script>

