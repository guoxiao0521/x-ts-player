import { ref, type Ref } from 'vue';
import IOReader from '@libmedia/common/io/IOReader';
import { IOError, AVPacketFlags } from '@libmedia/avutil/enum';
import * as demux from '@libmedia/avformat/demux';
import { dumpCodecName } from '@libmedia/avformat/dump';
import IMpegtsFormat from '@libmedia/avformat/formats/IMpegtsFormat';
import { createAVIFormatContext } from '@libmedia/avformat/AVFormatContext';
import { createAVPacket, destroyAVPacket } from '@libmedia/avutil/util/avpacket';
import AVPacket from '@libmedia/avutil/struct/avpacket';
import structAccess from '@libmedia/cheap/std/structAccess';
import { mapUint8Array } from '@libmedia/cheap/std/memory';
import { WebcodecPlayer, detectKeyframe } from '../webcodec-player';

export interface DemuxStats {
  videoCodecName: string;
  codecType: 'h264' | 'h265';
  width: number;
  height: number;
  totalPackets: number;
  videoPackets: number;
  keyframes: number;
  keyframeRatio: number;
  videoStreamIndex: number;
}

export interface DemuxOptions {
  source: string;
  videoEl?: HTMLVideoElement;
  onProgress?: (stats: Partial<DemuxStats>) => void;
}

export function useFileDemux() {
  const stats: Ref<DemuxStats | null> = ref(null);
  const isLoading = ref(false);
  const error = ref<Error | null>(null);

  async function demuxFile(options: DemuxOptions) {
    isLoading.value = true;
    error.value = null;
    
    const { source, videoEl, onProgress } = options;
    
    const iformatContext = createAVIFormatContext();
    const ioReader = new IOReader();

    // use mpegts for example
    const iformat = new IMpegtsFormat();
    iformatContext.ioReader = ioReader;
    iformatContext.iformat = iformat;

    const avpacket = createAVPacket();
    let readPos = 0;
    let fileSize: bigint = BigInt(0);
    let fileData: Uint8Array | null = null;

    // 先获取文件大小
    try {
      const headResponse = await fetch(source, { method: 'HEAD' });
      const contentLength = headResponse.headers.get('content-length');
      fileSize = contentLength ? BigInt(contentLength) : BigInt(0);

      // 如果文件较小，一次性加载到内存
      const maxFileSize = 200 * 1024 * 1024; // 200MB
      if (fileSize && fileSize < BigInt(maxFileSize)) {
        console.log('Loading entire file into memory...');
        const response = await fetch(source);
        const arrayBuffer = await response.arrayBuffer();
        fileData = new Uint8Array(arrayBuffer);
        fileSize = BigInt(arrayBuffer.byteLength);
      }
    } catch (err) {
      console.error('Error getting file size:', err);
      error.value = err as Error;
    }

    ioReader.onFlush = async (buffer: Uint8Array) => {
      if (readPos >= Number(fileSize)) {
        return IOError.END;
      }

      // 如果文件已完全加载到内存
      if (fileData) {
        const len = Math.min(buffer.length, fileData.length - readPos);
        if (len <= 0) {
          return IOError.END;
        }
        buffer.set(fileData.subarray(readPos, readPos + len), 0);
        readPos += len;
        return len;
      }

      // 从 URL 加载数据
      const len = Math.min(buffer.length, Number(fileSize) - readPos);
      if (len <= 0) {
        return IOError.END;
      }

      try {
        const endPos = readPos + len - 1;
        const response = await fetch(source, {
          headers: {
            'Range': `bytes=${readPos}-${endPos}`
          }
        });

        if (!response.ok && response.status !== 206) {
          return IOError.END;
        }

        const arrayBuffer = await response.arrayBuffer();
        const data = new Uint8Array(arrayBuffer);
        const actualLen = Math.min(len, data.length);
        buffer.set(data.subarray(0, actualLen), 0);
        readPos += actualLen;
        return actualLen;
      } catch (err) {
        console.error('Error loading data:', err);
        return IOError.END;
      }
    };

    ioReader.onSeek = (pos: bigint) => {
      readPos = Number(pos);
      return 0;
    };

    ioReader.onSize = () => {
      return fileSize;
    };

    try {
      await demux.open(iformatContext);
      await demux.analyzeStreams(iformatContext);

      // got stream info from iformatContext.streams
      console.log('stream info:', iformatContext.streams);

      // 打印所有流的详细信息
      console.log('\n=== 流信息 ===');
      for (let i = 0; i < iformatContext.streams.length; i++) {
        const stream = iformatContext.streams[i];
        if (stream) {
          const codecName = dumpCodecName(stream.codecpar.codecType, stream.codecpar.codecId);
          const streamType = stream.codecpar.codecType === 0 ? 'VIDEO' : stream.codecpar.codecType === 1 ? 'AUDIO' : 'OTHER';
          console.log(`流 ${i} [${streamType}]: codecType=${stream.codecpar.codecType}, codecId=${stream.codecpar.codecId}, 编码格式=${codecName}`);

          // 如果是视频流，显示更多信息
          if (stream.codecpar.codecType === 0 && stream.codecpar.width && stream.codecpar.height) {
            console.log(`  分辨率: ${stream.codecpar.width}x${stream.codecpar.height}`);
            if (stream.codecpar.framerate && stream.codecpar.framerate.num > 0) {
              const fps = Number(stream.codecpar.framerate.num) / Number(stream.codecpar.framerate.den);
              console.log(`  帧率: ${fps.toFixed(2)} fps`);
            }
          }
        }
      }

      // 找到视频流的索引 - AVMEDIA_TYPE_VIDEO = 0
      let videoStreamIndex = -1;
      let videoCodecName = '';
      for (let i = 0; i < iformatContext.streams.length; i++) {
        const stream = iformatContext.streams[i];
        if (stream && stream.codecpar.codecType === 0) { // 0 = AVMEDIA_TYPE_VIDEO
          videoStreamIndex = i;
          videoCodecName = dumpCodecName(stream.codecpar.codecType, stream.codecpar.codecId);
          console.log(`\n找到视频流索引: ${i}, 编码ID: ${stream.codecpar.codecId}, 编码格式: ${videoCodecName}`);
          break;
        }
      }

      if (videoStreamIndex === -1) {
        console.warn('警告: 未找到视频流！');
        throw new Error('未找到视频流');
      }

      // 创建 WebcodecPlayer 实例
      const videoStream = iformatContext.streams[videoStreamIndex];
      if (!videoStream) {
        throw new Error('无法获取视频流信息');
      }

      const codecType = videoCodecName.toLowerCase() === 'h264' ? 'h264' : 'h265';
      
      // 如果没有提供 videoEl，创建一个临时的 video 元素用于解码
      const targetVideoEl = videoEl || document.createElement('video');
      
      const player = new WebcodecPlayer({
        codec: codecType,
        width: videoStream.codecpar.width || 1920,
        height: videoStream.codecpar.height || 1080,
        videoEl: targetVideoEl,
      });

      console.log(`\n创建 WebcodecPlayer: ${videoCodecName}, ${videoStream.codecpar.width}x${videoStream.codecpar.height}`);
      console.log(`编码类型: ${codecType}`);
      console.log(`AVPacketFlags.AV_PKT_FLAG_KEY = ${AVPacketFlags.AV_PKT_FLAG_KEY}`);

      let packetCount = 0;
      let keyframeCount = 0;
      let videoPacketCount = 0;

      console.log('\n=== 开始读取数据包 ===\n');

      while (1) {
        let ret = await demux.readAVPacket(iformatContext, avpacket);
        if (ret !== 0) {
          if (ret === IOError.END) {
            iformatContext.destroy();
            destroyAVPacket(avpacket);
          }
          break;
        }

        // 使用 structAccess 将指针转换为可访问的对象
        const pkt = structAccess(avpacket, AVPacket);
        packetCount++;

        const isVideoPacket = videoStreamIndex >= 0 && pkt.streamIndex === videoStreamIndex;
        let isKeyframe = !!(pkt.flags & AVPacketFlags.AV_PKT_FLAG_KEY);

        if (isVideoPacket) {
          videoPacketCount++;

          // 使用工具函数检测关键帧（支持 H.264 和 H.265）
          if (pkt.data && pkt.size > 4) {
            const videoData = mapUint8Array(pkt.data, Math.min(pkt.size, 100)); // 只读取前100字节用于检测
            const detectedKeyframe = detectKeyframe(codecType, videoData);

            // 如果工具函数检测到关键帧，则更新标志
            if (detectedKeyframe) {
              isKeyframe = true;
            }
          }

          if (isKeyframe) {
            keyframeCount++;
          }

          // 显示详细的包信息来调试关键帧检测
          if (videoPacketCount <= 100) {
            const streamType = isVideoPacket ? 'VIDEO' : 'AUDIO';
            const keyframeInfo = isKeyframe ? '🔑 KEYFRAME' : '';
            // console.log(`[${streamType}] packet #${videoPacketCount}, flags: ${pkt.flags}, size: ${pkt.size}, dts: ${pkt.dts}, pts: ${pkt.pts} ${keyframeInfo}`);
          }

          // 进度回调
          if (onProgress && videoPacketCount % 100 === 0) {
            onProgress({
              videoPackets: videoPacketCount,
              keyframes: keyframeCount,
              totalPackets: packetCount,
            });
          }
        }

        // 如果是视频包，使用 WebcodecPlayer 解码
        if (isVideoPacket && pkt.data && pkt.size > 0) {
          try {
            // 将 AVPacket 的数据转换为 Uint8Array
            const videoData = mapUint8Array(pkt.data, pkt.size);

            // 解码视频帧
            player.decode(videoData, isKeyframe);

            if (videoPacketCount <= 99999 || isKeyframe) {
              // console.log(`✅ 解码视频帧 #${videoPacketCount}, size: ${pkt.size}, ${isKeyframe ? '关键帧' : '普通帧'}`);
            }
          } catch (err) {
            console.error(`❌ 解码视频帧失败 #${videoPacketCount}:`, err);
          }
        }
      }

      // 清理资源
      player.destroy();

      // 计算统计信息
      const demuxStats: DemuxStats = {
        videoCodecName,
        codecType,
        width: videoStream.codecpar.width || 0,
        height: videoStream.codecpar.height || 0,
        totalPackets: packetCount,
        videoPackets: videoPacketCount,
        keyframes: keyframeCount,
        keyframeRatio: videoPacketCount > 0 ? (keyframeCount / videoPacketCount * 100) : 0,
        videoStreamIndex,
      };

      stats.value = demuxStats;

      console.log(`\n=== 统计信息 ===`);
      console.log(`视频编码格式: ${videoCodecName}`);
      console.log(`分辨率: ${demuxStats.width}x${demuxStats.height}`);
      console.log(`总数据包数: ${packetCount}`);
      console.log(`视频数据包数: ${videoPacketCount}`);
      console.log(`关键帧数量: ${keyframeCount}`);
      console.log(`关键帧比例: ${demuxStats.keyframeRatio.toFixed(2)}%`);

      isLoading.value = false;
      return demuxStats;
    } catch (err) {
      console.error('解封装过程出错:', err);
      error.value = err as Error;
      isLoading.value = false;
      throw err;
    }
  }

  return {
    demuxFile,
    stats,
    isLoading,
    error,
  };
}