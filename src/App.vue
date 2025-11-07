<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useFileDemux } from './composeable/useFileDemux';

const { demuxFile, stats, isLoading, error } = useFileDemux();
const videoRef = ref<HTMLVideoElement | null>(null);

onMounted(async () => {
  const source = '/videos/17205035330_20250812235126_20250812235138_告警 (2).ts';
  
  // try {
  //   const result = await demuxFile({
  //     source,
  //     videoEl: videoRef.value!,
  //     onProgress: (progressStats) => {
  //       // 可以在这里处理进度更新
  //       console.log('进度更新:', progressStats);
  //     }
  //   });
    
  //   console.log('解封装完成，统计信息:', result);
  // } catch (err) {
  //   console.error('解封装失败:', err);
  // }

});

</script>

<template>
  <div>
    <h1>TS 视频文件解析器</h1>
    
    <!-- 视频播放器 -->
    <div class="video-container">
      <video 
        ref="videoRef" 
        class="video-player"
        controls
        muted
        autoplay
      ></video>
    </div>
    
    <div v-if="isLoading" class="loading">
      <p>正在解析视频文件...</p>
    </div>
    
    <div v-else-if="error" class="error">
      <p>解析失败: {{ error.message }}</p>
    </div>
    
    <div v-else-if="stats" class="stats">
      <h2>视频统计信息</h2>
      <div class="stats-grid">
        <div class="stat-item">
          <span class="label">编码格式:</span>
          <span class="value">{{ stats.videoCodecName }} ({{ stats.codecType }})</span>
        </div>
        <div class="stat-item">
          <span class="label">分辨率:</span>
          <span class="value">{{ stats.width }} x {{ stats.height }}</span>
        </div>
        <div class="stat-item">
          <span class="label">视频流索引:</span>
          <span class="value">{{ stats.videoStreamIndex }}</span>
        </div>
        <div class="stat-item">
          <span class="label">总数据包数:</span>
          <span class="value">{{ stats.totalPackets }}</span>
        </div>
        <div class="stat-item">
          <span class="label">视频数据包数:</span>
          <span class="value">{{ stats.videoPackets }}</span>
        </div>
        <div class="stat-item">
          <span class="label">关键帧数量:</span>
          <span class="value">{{ stats.keyframes }}</span>
        </div>
        <div class="stat-item">
          <span class="label">关键帧比例:</span>
          <span class="value">{{ stats.keyframeRatio.toFixed(2) }}%</span>
        </div>
      </div>
    </div>
    
    <p class="tip">请打开浏览器控制台查看详细解析过程</p>
  </div>
</template>

<style scoped>
div {
  padding: 20px;
}

h1 {
  color: #42b883;
  margin-bottom: 20px;
}

.video-container {
  width: 100%;
  max-width: 1200px;
  margin: 0 auto 30px;
  background: #000;
  border-radius: 8px;
  overflow: hidden;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
}

.video-player {
  width: 100%;
  height: auto;
  display: block;
  background: #000;
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
  margin: 20px 0;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 15px;
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
}

.tip {
  color: #999;
  font-style: italic;
  text-align: center;
  margin-top: 20px;
}
</style>
