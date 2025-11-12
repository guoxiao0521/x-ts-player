<script setup lang="ts">
import { ref } from 'vue';
import { NUpload, type UploadFileInfo } from 'naive-ui';
import { Upload } from 'lucide-vue-next';

const props = defineProps<{
  fileList: UploadFileInfo[];
  isLoading: boolean;
  error: Error | null;
  stats: any;
}>();

const emit = defineEmits<{
  'update:fileList': [value: UploadFileInfo[]];
  'change': [options: { file: UploadFileInfo; fileList: UploadFileInfo[] }];
  'remove': [];
}>();

const localFileList = ref(props.fileList);

const handleFileChange = (options: { file: UploadFileInfo; fileList: UploadFileInfo[] }) => {
  localFileList.value = options.fileList;
  emit('update:fileList', options.fileList);
  emit('change', options);
};

const handleRemove = () => {
  localFileList.value = [];
  emit('update:fileList', []);
  emit('remove');
};
</script>

<template>
  <div class="fixed top-0 left-0 right-0 z-50 p-4">
    <div class="max-w-[min(1200px,92vw)] mx-auto">
      <!-- 主上传栏 -->
      <div class="backdrop-blur-2xl bg-white/10 rounded-2xl border border-white/15 shadow-[inset_0_1px_0_rgba(255,255,255,.35),0_8px_30px_rgba(0,0,0,.35)]">
        <div class="flex items-center justify-between gap-4 px-5 py-3">
          <!-- 左侧：标题和上传按钮 -->
          <div class="flex items-center gap-4">
            <div class="flex items-center gap-2 text-white/90">
              <Upload class="size-5" />
              <span class="font-semibold hidden sm:inline w-20">视频文件</span>
            </div>
            
            <n-upload
              :file-list="localFileList"
              :default-upload="false"
              accept="video/*,.ts,.mp4,.mkv,.avi,.mov"
              @change="handleFileChange"
              @remove="handleRemove"
              :max="1"
            >
              <button class="backdrop-blur-xl bg-white/10 hover:bg-white/15 border border-white/15 hover:border-white/20 shadow-[inset_0_1px_0_rgba(255,255,255,.35),0_4px_16px_rgba(0,0,0,.25)] text-white/90 px-4 py-1.5 rounded-xl transition-all text-sm">
                选择文件
              </button>
            </n-upload>
          </div>

          <!-- 中间：文件名显示 -->
          <div v-if="localFileList.length > 0" class="flex-1 min-w-0 hidden md:block">
            <p class="text-white/80 text-sm truncate">
              {{ localFileList[0]?.name }}
            </p>
          </div>

          <!-- 右侧：状态和设置按钮 -->
          <div class="flex items-center gap-3">
            <!-- 加载状态 -->
            <div v-if="isLoading" class="flex items-center gap-2">
              <span class="inline-block size-2 rounded-full bg-blue-400 animate-pulse" />
              <span class="text-white/80 text-sm hidden sm:inline">解析中...</span>
            </div>

            <!-- 错误状态 -->
            <div v-else-if="error" class="flex items-center gap-2">
              <span class="inline-block size-2 rounded-full bg-red-400" />
              <span class="text-red-300 text-sm hidden sm:inline">解析失败</span>
            </div>

            <!-- 成功状态 -->
            <div v-else-if="stats" class="flex items-center gap-2">
              <span class="inline-block size-2 rounded-full bg-emerald-400" />
              <span class="text-white/80 text-sm hidden sm:inline">{{ stats.width }}x{{ stats.height }}</span>
            </div>
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
</style>

