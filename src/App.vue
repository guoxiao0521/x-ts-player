<script setup lang="ts">
import { ref } from 'vue';
import { NUpload, NButton, type UploadFileInfo } from 'naive-ui';
import { useVideoDemuxDecoder } from './composeable/useVideoDemuxDecoder';

const { processVideoFile, stats, isLoading, error } = useVideoDemuxDecoder();
const videoRef = ref<HTMLVideoElement | null>(null);
const fileList = ref<UploadFileInfo[]>([]);

const handleFileChange = async (options: { file: UploadFileInfo; fileList: UploadFileInfo[] }) => {
  const { file } = options;
  fileList.value = options.fileList;

  // 只处理新添加的文件（status 为 pending）
  if (file.status === 'pending' && file.file) {
    try {
      // 调用 processVideoFile 处理文件
      const result = await processVideoFile({
        source: file.file,
        videoEl: videoRef.value!,
        onProgress: (progressStats) => {
          // 可以在这里处理进度更新
          console.log('进度更新:', progressStats);
        }
      });

      console.log('解封装和解码完成，统计信息:', result);
    } catch (err) {
      console.error('解封装和解码失败:', err);
    }
  }
};

const handleRemove = () => {
  // 文件移除时清空统计信息和状态
  fileList.value = [];
  // 重置解码器状态
  stats.value = null;
  error.value = null;
  isLoading.value = false;
};

</script>

<template>
  <div class="app-container">
    <h1>🎬 TS 视频文件播放器</h1>

    <div class="main-layout">
      <!-- 左侧：视频播放器 -->
      <div class="left-panel">
        <div class="video-container">
          <video ref="videoRef" class="video-player" controls muted autoplay></video>
        </div>
        <p class="tip">💡 请打开浏览器控制台查看详细解析过程</p>
      </div>

      <!-- 右侧：上传和统计信息 -->
      <div class="right-panel">
        <div class="upload-section">
          <h2>📤 上传视频文件</h2>
          <n-upload
            :file-list="fileList"
            :default-upload="false"
            accept="video/*,.ts,.mp4,.mkv,.avi,.mov"
            @change="handleFileChange"
            @remove="handleRemove"
            :max="1"
          >
            <n-button>选择视频文件</n-button>
          </n-upload>
          <p class="upload-tip">支持 TS、MP4、MKV、AVI、MOV 等视频格式</p>
        </div>

        <div v-if="isLoading" class="loading">
          <p>⏳ 正在解析视频文件...</p>
        </div>

        <div v-else-if="error" class="error">
          <p>❌ 解析失败: {{ error.message }}</p>
        </div>

        <div v-else-if="stats" class="stats">
          <h2>📊 视频统计信息</h2>
          <div class="stats-grid">
            <div class="stat-item">
              <span class="label">🎥 编码格式:</span>
              <span class="value">{{ stats.videoCodecName }} ({{ stats.codecType }})</span>
            </div>
            <div class="stat-item">
              <span class="label">📐 分辨率:</span>
              <span class="value">{{ stats.width }} x {{ stats.height }}</span>
            </div>
            <div class="stat-item">
              <span class="label">🔢 视频流索引:</span>
              <span class="value">{{ stats.videoStreamIndex }}</span>
            </div>
            <div class="stat-item">
              <span class="label">📦 总数据包数:</span>
              <span class="value">{{ stats.totalPackets }}</span>
            </div>
            <div class="stat-item">
              <span class="label">🎞️ 视频数据包数:</span>
              <span class="value">{{ stats.videoPackets }}</span>
            </div>
            <div class="stat-item">
              <span class="label">🔑 关键帧数量:</span>
              <span class="value">{{ stats.keyframes }}</span>
            </div>
            <div class="stat-item">
              <span class="label">📈 关键帧比例:</span>
              <span class="value">{{ stats.keyframeRatio.toFixed(2) }}%</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.app-container {
  padding: 20px;
  max-width: 1600px;
  margin: 0 auto;
}

h1 {
  color: #42b883;
  margin-bottom: 20px;
  text-align: center;
}

.main-layout {
  display: grid;
  gap: 20px;
  align-items: flex-start;
  grid-template-columns: 1000px 400px;
}

.left-panel {
  flex: 1;
  min-width: 0;
}

.right-panel {
  min-height: 100%;
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.upload-section {
  background: #f9f9f9;
  border-radius: 8px;
  padding: 20px;
  border: 1px solid #e0e0e0;
}

.upload-section h2 {
  color: #35495e;
  font-size: 1.3em;
  margin-bottom: 15px;
  margin-top: 0;
}

.upload-tip {
  color: #999;
  font-size: 0.85em;
  margin-top: 10px;
  text-align: center;
  font-style: italic;
}

.video-container {
  width: 100%;
  aspect-ratio: 16 / 9;
  background: #000;
  border-radius: 8px;
  overflow: hidden;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  position: relative;
}

.video-player {
  width: 100%;
  height: 100%;
  display: block;
  background: #000;
  object-fit: contain;
}

.tip {
  color: #999;
  font-style: italic;
  text-align: center;
  margin-top: 15px;
  font-size: 0.9em;
}

h2 {
  color: #35495e;
  font-size: 1.5em;
  margin-bottom: 15px;
}

.loading {
  padding: 30px;
  text-align: center;
  background: #f0f9ff;
  border-radius: 8px;
  border: 2px solid #42b883;
}

.loading p {
  color: #42b883;
  font-size: 1.2em;
  font-weight: 500;
}

.error {
  padding: 20px;
  background: #fee;
  border-radius: 8px;
  border: 2px solid #f44;
}

.error p {
  color: #c33;
  font-weight: 500;
}

.stats {
  background: #f9f9f9;
  border-radius: 8px;
  padding: 20px;
}

.stats-grid {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.stat-item {
  background: white;
  padding: 15px;
  border-radius: 6px;
  border: 1px solid #e0e0e0;
  display: flex;
  justify-content: space-between;
  align-items: center;
  transition: transform 0.2s, box-shadow 0.2s;
}

.stat-item:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
}

.stat-item .label {
  font-weight: 600;
  color: #35495e;
}

.stat-item .value {
  color: #42b883;
  font-weight: 500;
  font-family: 'Courier New', monospace;
  text-align: right;
  word-break: break-all;
}

/* 响应式设计 */
@media (max-width: 1024px) {
  .main-layout {
    flex-direction: column;
  }

  .right-panel {
    flex: 1;
    width: 100%;
  }

  .stats-grid {
    grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  }
}
</style>
