<script setup lang="ts">
import { ref, computed } from 'vue';
import { type UploadFileInfo } from 'naive-ui';
import { useVideoDemuxDecoder } from './composeable/useVideoDemuxDecoder';
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
  Info,
  ChevronDown,
  ChevronUp,
} from 'lucide-vue-next';
import Slider from './components/ui/Slider.vue';
import GlassIconButton from './components/GlassIconButton.vue';
import GlassPillToggle from './components/GlassPillToggle.vue';
import ChevronLight from './components/ChevronLight.vue';
import UploadBar from './components/UploadBar.vue';

const { processVideoFile, stats, isLoading, error } = useVideoDemuxDecoder();
const videoRef = ref<HTMLVideoElement | null>(null);
const fileList = ref<UploadFileInfo[]>([]);
const codecType = ref<'auto' | 'h264' | 'h265'>('auto');
const showStats = ref(false); // 统计信息默认隐藏

// 视频播放控制状态（仅用于UI演示，实际控制通过原生video controls）
const playing = ref(false);
const muted = ref(false);
const volume = ref<number[]>([70]);
const progress = ref<number[]>([28]);

const handleFileChange = async (options: { file: UploadFileInfo; fileList: UploadFileInfo[] }) => {
  const { file } = options;
  fileList.value = options.fileList;

  if (file.status === 'pending' && file.file) {
    try {
      const result = await processVideoFile({
        source: file.file,
        videoEl: videoRef.value!,
        forceCodecType: codecType.value === 'auto' ? undefined : codecType.value,
        onProgress: (progressStats) => {
          console.log('进度更新:', progressStats);
        }
      });

      console.log('解封装和解码完成，统计信息:', result);
      // 解析成功后，可以显示统计信息
      if (result) {
        showStats.value = false; // 默认仍然隐藏，用户需要手动展开
      }
    } catch (err) {
      console.error('解封装和解码失败:', err);
    }
  }
};

const handleRemove = () => {
  fileList.value = [];
  stats.value = null;
  error.value = null;
  isLoading.value = false;
  showStats.value = false;
};


// 渐变光雾遮罩
const gradientMask = computed(
  () =>
    `radial-gradient(1200px 600px at 70% -10%, rgba(255,255,255,.35) 0%, rgba(255,255,255,0) 60%),
     radial-gradient(800px 500px at 0% 110%, rgba(99,102,241,.25) 0%, rgba(99,102,241,0) 60%),
     radial-gradient(900px 600px at 110% 90%, rgba(236,72,153,.15) 0%, rgba(236,72,153,0) 60%)`
);

// 动画引用
const controlsRef = ref<HTMLElement | null>(null);
useMotion(controlsRef, {
  initial: { y: 28, opacity: 0 },
  enter: { y: 0, opacity: 1 },
  transition: { type: 'spring', stiffness: 140, damping: 18 }
});
</script>

<template>
  <div class="w-full min-h-screen bg-black/95 relative">
    <!-- 顶部上传栏 -->
    <UploadBar
      v-model:file-list="fileList"
      v-model:codec-type="codecType"
      :is-loading="isLoading"
      :error="error"
      :stats="stats"
      @change="handleFileChange"
      @remove="handleRemove"
    />

    <!-- 视频播放器容器 - 居中显示 -->
    <div class="w-full min-h-screen flex items-center justify-center p-4 pt-24">
      <div
        class="relative w-full max-w-[min(1200px,92vw)] aspect-[16/9] rounded-[28px] overflow-hidden shadow-[0_20px_80px_-20px_rgba(0,0,0,.6)] ring-1 ring-white/10"
      >
        <!-- 背景层：渐变光雾 -->
        <div
          class="absolute inset-0 pointer-events-none"
          :style="{ backgroundImage: gradientMask }"
        />

        <!-- 视频画面 -->
        <div class="absolute inset-0">
          <video
            ref="videoRef"
            class="w-full h-full object-contain"
            muted
            autoplay
            @play="playing = true"
            @pause="playing = false"
          ></video>

          <!-- 顶部微光与镜面反射条 -->
          <div class="absolute top-0 left-0 right-0 h-24 bg-gradient-to-b from-white/15 via-white/5 to-transparent" />
          <div class="absolute inset-x-0 top-0 h-[1px] bg-white/30" />
          <div class="absolute inset-x-0 bottom-0 h-[1px] bg-white/10" />
        </div>

        <!-- 中心大播放按钮（毛玻璃圆片） -->
        <div class="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
          <button
            v-motion="{
              initial: { scale: 1 },
              hover: { scale: 1.04 },
              tap: { scale: 0.98 }
            }"
            @click="playing = !playing; videoRef && (videoRef.paused ? videoRef.play() : videoRef.pause())"
            class="group backdrop-blur-xl bg-white/12 border border-white/20 shadow-[inset_0_1px_0_rgba(255,255,255,.25),0_8px_30px_rgba(0,0,0,.35)] rounded-full p-6 flex items-center justify-center"
          >
            <div class="relative size-16 grid place-items-center">
              <div class="absolute inset-0 rounded-full bg-gradient-to-br from-white/40 to-white/10 opacity-70" />
              <div class="absolute inset-0 rounded-full ring-1 ring-white/30" />
              <Pause v-if="playing" class="relative size-8 text-white drop-shadow" />
              <Play v-else class="relative size-8 text-white drop-shadow translate-x-0.5" />
            </div>
          </button>
        </div>

        <!-- 底部控制条（iOS 26 风格毛玻璃 Dock） -->
        <div
          ref="controlsRef"
          class="absolute left-5 right-5 bottom-5"
        >
          <div class="backdrop-blur-2xl bg-white/10 rounded-2xl md:rounded-3xl border border-white/15 shadow-[inset_0_1px_0_rgba(255,255,255,.35),0_12px_60px_rgba(0,0,0,.45)]">
            <!-- 进度条 -->
            <div class="px-4 sm:px-6 pt-4 sm:pt-5">
              <Slider v-model="progress" :max="100" />
              <div class="mt-2 flex items-center justify-between text-[11px] text-white/70">
                <span>00:42</span>
                <span>12:30</span>
              </div>
            </div>

            <!-- 控件行 -->
            <div class="flex flex-wrap items-center gap-2 sm:gap-3 px-3 sm:px-4 py-3">
              <!-- 左侧：播放组 -->
              <div class="flex items-center gap-2 sm:gap-3">
                <GlassIconButton aria-label="后退 10 秒">
                  <SkipBack class="size-4" />
                </GlassIconButton>
                <GlassPillToggle
                  :active="playing"
                  active-label="暂停"
                  inactive-label="播放"
                  @click="playing = !playing; videoRef && (videoRef.paused ? videoRef.play() : videoRef.pause())"
                >
                  <template #iconActive>
                    <Pause class="size-4" />
                  </template>
                  <template #iconInactive>
                    <Play class="size-4 translate-x-[1px]" />
                  </template>
                </GlassPillToggle>
                <GlassIconButton aria-label="前进 10 秒">
                  <SkipForward class="size-4" />
                </GlassIconButton>
              </div>

              <!-- 中部：音量组 -->
              <div class="ml-auto md:ml-6 flex items-center gap-3">
                <GlassIconButton
                  :aria-label="muted ? '取消静音' : '静音'"
                  @click="muted = !muted; if (videoRef) videoRef.muted = muted"
                >
                  <VolumeX v-if="muted" class="size-4" />
                  <Volume2 v-else class="size-4" />
                </GlassIconButton>
                <div class="w-[120px] hidden sm:block">
                  <Slider v-model="volume" :max="100" />
                </div>
              </div>

              <!-- 右侧：功能组 -->
              <div class="ml-auto flex items-center gap-2 sm:gap-3">
                <GlassIconButton aria-label="AirPlay">
                  <Airplay class="size-4" />
                </GlassIconButton>
                <GlassIconButton aria-label="设置">
                  <Settings class="size-4" />
                </GlassIconButton>
                <GlassIconButton aria-label="全屏">
                  <Maximize2 class="size-4" />
                </GlassIconButton>
              </div>
            </div>
          </div>
        </div>

        <!-- 顶部胶囊信息条 -->
        <div class="absolute left-5 right-5 top-5 flex items-center justify-between gap-3">
          <div
            v-if="stats"
            class="backdrop-blur-2xl bg-white/10 border border-white/15 rounded-full px-3 pr-3.5 py-1.5 shadow-[inset_0_1px_0_rgba(255,255,255,.35),0_8px_30px_rgba(0,0,0,.35)] text-white/90 text-sm flex items-center gap-2"
          >
            <span class="inline-block size-2 rounded-full bg-emerald-400 shadow-[0_0_0_2px_rgba(255,255,255,.35)]" />
            {{ stats.width }}x{{ stats.height }} • {{ stats.videoCodecName }}
          </div>
          <div class="hidden md:flex items-center gap-2 text-white/80">
            <span class="text-xs">Now Playing</span>
            <ChevronLight />
          </div>
        </div>
      </div>
    </div>

    <!-- 浮动元素：统计信息 - 右上角 -->
    <div class="fixed top-20 right-4 z-40 flex flex-col gap-4 w-[380px] max-w-[calc(100vw-2rem)] max-h-[calc(100vh-6rem)] overflow-y-auto">
      <!-- 统计信息（默认隐藏，可展开） -->
      <div v-if="stats" class="backdrop-blur-2xl bg-white/10 border border-white/15 rounded-2xl shadow-[inset_0_1px_0_rgba(255,255,255,.35),0_8px_30px_rgba(0,0,0,.35)] overflow-hidden">
        <!-- 展开/收起按钮 -->
        <button
          @click="showStats = !showStats"
          class="w-full p-4 flex items-center justify-between text-white/90 hover:bg-white/5 transition-colors"
        >
          <div class="flex items-center gap-2">
            <Info class="size-5" />
            <span class="font-semibold">视频统计信息</span>
          </div>
          <ChevronUp v-if="showStats" class="size-4" />
          <ChevronDown v-else class="size-4" />
        </button>

        <!-- 统计内容（可展开/收起） -->
        <div
          v-show="showStats"
          class="px-4 pb-4 space-y-3"
        >
          <div
            v-for="(item, index) in [
              { label: '编码格式', value: `${stats.videoCodecName} (${stats.codecType})` },
              { label: '分辨率', value: `${stats.width} x ${stats.height}` },
              { label: '视频流索引', value: stats.videoStreamIndex },
              { label: '总数据包数', value: stats.totalPackets },
              { label: '视频数据包数', value: stats.videoPackets },
              { label: '关键帧数量', value: stats.keyframes },
              { label: '关键帧比例', value: `${stats.keyframeRatio.toFixed(2)}%` },
            ]"
            :key="index"
            class="backdrop-blur-xl bg-white/5 border border-white/10 rounded-xl p-3 flex justify-between items-center hover:bg-white/10 transition-colors"
          >
            <span class="text-white/80 text-sm font-medium">{{ item.label }}</span>
            <span class="text-white/90 text-sm font-mono">{{ item.value }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* 确保 naive-ui 组件样式适配深色背景 */
:deep(.n-upload) {
  color: rgba(255, 255, 255, 0.9);
}

:deep(.n-radio) {
  color: rgba(255, 255, 255, 0.8);
}

:deep(.n-radio--checked) {
  color: rgba(255, 255, 255, 0.95);
}

:deep(.n-radio-group) {
  color: rgba(255, 255, 255, 0.8);
}
</style>
