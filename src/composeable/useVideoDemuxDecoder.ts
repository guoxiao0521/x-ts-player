import { ref, type Ref } from 'vue';
import IOReader from '@libmedia/common/io/IOReader';
import { IOError, AVPacketFlags } from '@libmedia/avutil/enum';
import * as demux from '@libmedia/avformat/demux';
import { dumpCodecName } from '@libmedia/avformat/dump';
import IMpegtsFormat from '@libmedia/avformat/formats/IMpegtsFormat';
import IIsobmffFormat from '@libmedia/avformat/formats/IIsobmffFormat';
import type IFormat from '@libmedia/avformat/formats/IFormat';
import { createAVIFormatContext } from '@libmedia/avformat/AVFormatContext';
import { createAVPacket, destroyAVPacket } from '@libmedia/avutil/util/avpacket';
import AVPacket from '@libmedia/avutil/struct/avpacket';
import structAccess from '@libmedia/cheap/std/structAccess';
import { mapUint8Array } from '@libmedia/cheap/std/memory';
import { WebcodecPlayer, detectKeyframe } from '../webcodec-player';
import { SpeedControl } from '../webcodec-player/speed-control';
import { extractH264Description, extractH265Description } from '../webcodec-player/codec-description';

export interface VideoDemuxDecoderStats {
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

export interface VideoDemuxDecoderOptions {
  source: string | File;
  videoEl?: HTMLVideoElement;
  onProgress?: (stats: Partial<VideoDemuxDecoderStats>) => void;
  forceCodecType?: 'h264' | 'h265'; // 强制指定编码格式（用于修复错误的编码格式信息）
}

/**
 * 根据文件扩展名或文件名选择正确的解封装格式
 */
function selectFormat(source: string | File): IFormat {
  let fileName = '';
  
  if (source instanceof File) {
    fileName = source.name.toLowerCase();
  } else {
    // 从 URL 中提取文件名
    try {
      const url = new URL(source);
      fileName = url.pathname.toLowerCase();
    } catch {
      // 如果不是有效的 URL，直接使用字符串作为文件名
      fileName = source.toLowerCase();
    }
  }
  
  // 根据文件扩展名选择格式
  if (fileName.endsWith('.mp4') || fileName.endsWith('.m4v') || fileName.endsWith('.mov')) {
    console.log(`检测到 MP4 格式文件，使用 IIsobmffFormat`);
    return new IIsobmffFormat();
  } else if (fileName.endsWith('.ts') || fileName.endsWith('.m2ts') || fileName.endsWith('.mts')) {
    console.log(`检测到 MPEG-TS 格式文件，使用 IMpegtsFormat`);
    return new IMpegtsFormat();
  } else {
    // 默认使用 MPEG-TS 格式（向后兼容）
    console.log(`未识别的文件格式，默认使用 IMpegtsFormat`);
    return new IMpegtsFormat();
  }
}

export function useVideoDemuxDecoder() {
  const stats: Ref<VideoDemuxDecoderStats | null> = ref(null);
  const isLoading = ref(false);
  const error = ref<Error | null>(null);

  async function processVideoFile(options: VideoDemuxDecoderOptions) {
    isLoading.value = true;
    error.value = null;
    
    const { source, videoEl, onProgress, forceCodecType } = options;
    
    const iformatContext = createAVIFormatContext();
    const ioReader = new IOReader();

    // 根据文件类型自动选择解封装格式
    const iformat = selectFormat(source);
    iformatContext.ioReader = ioReader;
    iformatContext.iformat = iformat;

    const avpacket = createAVPacket();
    let readPos = 0;
    let fileSize: bigint = BigInt(0);
    let fileData: Uint8Array | null = null;

    // 处理文件源：支持 File 对象或字符串 URL
    try {
      if (source instanceof File) {
        // 如果是 File 对象，直接读取到内存
        console.log('Loading File object into memory...');
        fileSize = BigInt(source.size);
        const arrayBuffer = await source.arrayBuffer();
        fileData = new Uint8Array(arrayBuffer);
        fileSize = BigInt(arrayBuffer.byteLength);
        console.log(`File loaded: ${source.name}, size: ${fileSize} bytes`);
      } else {
        // 如果是字符串 URL，使用原有逻辑
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
      }
    } catch (err) {
      console.error('Error getting file size:', err);
      error.value = err as Error;
      isLoading.value = false;
      throw err;
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

      // 从 URL 加载数据（仅当 source 是字符串时）
      if (typeof source === 'string') {
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
      } else {
        // File 对象应该已经在 fileData 中，不应该走到这里
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

      // 立即保存视频流的宽高信息，避免后续 iformatContext.destroy() 后无法访问
      const videoWidth = videoStream.codecpar.width || 0;
      const videoHeight = videoStream.codecpar.height || 0;

      // 如果强制指定了编码格式，使用强制指定的值；否则根据检测到的编码格式自动判断
      const codecType = forceCodecType || (videoCodecName.toLowerCase() === 'h264' ? 'h264' : 'h265');
      
      if (forceCodecType) {
        console.log(`⚠️ 强制使用 ${forceCodecType.toUpperCase()} 编码格式（检测到的格式: ${videoCodecName}）`);
      }
      
      // 提取 extradata/description（用于 H.264 和 H.265）
      let description: Uint8Array | undefined = undefined;
      try {
        // 尝试从 codecpar 中获取 extradata
        if (videoStream.codecpar.extradata && videoStream.codecpar.extradataSize > 0) {
          const extradataSize = Number(videoStream.codecpar.extradataSize);
          const extradataView = mapUint8Array(videoStream.codecpar.extradata, extradataSize);
          // Clone data because mapUint8Array only returns a view into libmedia's WASM memory.
          description = new Uint8Array(extradataView);
          console.log(`提取到 extradata，大小: ${extradataSize} 字节`);
        } else {
          console.log('未找到 extradata，将在第一个关键帧中提取');
        }
      } catch (err) {
        console.warn('提取 extradata 时出错:', err);
      }
      
      // 如果没有提供 videoEl，创建一个临时的 video 元素用于解码
      const targetVideoEl = videoEl || document.createElement('video');
      
      // 先创建 player，但如果 H.264/H.265 且没有 description，需要延迟配置
      let player: WebcodecPlayer | null = null;
      
      // 如果 H.264/H.265 且没有 description，先不创建 player，等找到第一个关键帧后再创建
      if ((codecType === 'h264' || codecType === 'h265') && !description) {
        console.log(`${codecType.toUpperCase()} 未找到 extradata，将在找到第一个关键帧后提取 description`);
      } else {
        player = new WebcodecPlayer({
          codec: codecType,
          width: videoWidth || 1920,
          height: videoHeight || 1080,
          videoEl: targetVideoEl,
          description: description, // 传递 description 给解码器
        });
      }

      console.log(`\n创建 WebcodecPlayer: ${videoCodecName}, ${videoWidth}x${videoHeight}`);
      console.log(`编码类型: ${codecType}`);
      console.log(`AVPacketFlags.AV_PKT_FLAG_KEY = ${AVPacketFlags.AV_PKT_FLAG_KEY}`);

      let packetCount = 0;
      let keyframeCount = 0;
      let videoPacketCount = 0;

      // 缓存所有视频帧数据
      interface VideoFrameData {
        data: Uint8Array;
        isKeyframe: boolean;
        packetIndex: number;
      }
      const videoFrameCache: VideoFrameData[] = [];

      console.log('\n=== 开始读取数据包 ===\n');

      // 第一步：读取所有数据包并缓存视频帧
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
          // if (videoPacketCount <= 100) {
          //   const streamType = isVideoPacket ? 'VIDEO' : 'AUDIO';
          //   const keyframeInfo = isKeyframe ? '🔑 KEYFRAME' : '';
          //   console.log(`[${streamType}] packet #${videoPacketCount}, flags: ${pkt.flags}, size: ${pkt.size}, dts: ${pkt.dts}, pts: ${pkt.pts} ${keyframeInfo}`);
          // }

          // 进度回调
          if (onProgress && videoPacketCount % 100 === 0) {
            onProgress({
              videoPackets: videoPacketCount,
              keyframes: keyframeCount,
              totalPackets: packetCount,
            });
          }

          // 如果是 H.264/H.265 且还没有 description，尝试从第一个关键帧中提取
          if ((codecType === 'h264' || codecType === 'h265') && !description && isKeyframe && pkt.data && pkt.size > 0) {
            try {
              const videoData = mapUint8Array(pkt.data, pkt.size);
              if (codecType === 'h264') {
                description = extractH264Description(videoData);
              } else {
                description = extractH265Description(videoData);
              }
              if (description) {
                console.log(`从第一个关键帧提取到 ${codecType.toUpperCase()} description，大小: ${description.length} 字节`);
                // 现在创建 player
                if (!player) {
                  player = new WebcodecPlayer({
                    codec: codecType,
                    width: videoWidth || 1920,
                    height: videoHeight || 1080,
                    videoEl: targetVideoEl,
                    description: description,
                  });
                }
              }
            } catch (err) {
              console.warn('从关键帧提取 description 时出错:', err);
            }
          }

          // 缓存视频帧数据（复制数据，因为 AVPacket 会被重用）
          if (pkt.data && pkt.size > 0) {
            const videoData = mapUint8Array(pkt.data, pkt.size);
            // 创建数据副本
            const dataCopy = new Uint8Array(videoData.length);
            dataCopy.set(videoData);
            
            videoFrameCache.push({
              data: dataCopy,
              isKeyframe,
              packetIndex: videoPacketCount,
            });
          }
        }
      }

      console.log(`\n=== 数据包读取完成 ===`);
      console.log(`总数据包数: ${packetCount}`);
      console.log(`视频数据包数: ${videoPacketCount}`);
      console.log(`缓存的视频帧数: ${videoFrameCache.length}`);
      console.log(`关键帧数量: ${keyframeCount}`);

      // 如果 H.264/H.265 且还没有创建 player（说明没有找到 extradata 且第一个关键帧也没有提取到 description）
      if ((codecType === 'h264' || codecType === 'h265') && !player) {
        console.warn(`警告: ${codecType.toUpperCase()} 未找到 description，尝试从缓存的第一个关键帧中提取`);
        // 查找第一个关键帧
        for (const frameData of videoFrameCache) {
          if (frameData.isKeyframe) {
            if (codecType === 'h264') {
              description = extractH264Description(frameData.data);
            } else {
              description = extractH265Description(frameData.data);
            }
            if (description) {
              console.log(`从缓存的关键帧提取到 ${codecType.toUpperCase()} description，大小: ${description.length} 字节`);
              player = new WebcodecPlayer({
                codec: codecType,
                width: videoWidth || 1920,
                height: videoHeight || 1080,
                videoEl: targetVideoEl,
                description: description,
              });
              break;
            }
          }
        }
        
        // 如果仍然没有创建 player，使用空 description 创建（可能会失败，但至少尝试）
        if (!player) {
          console.warn(`警告: 无法提取 ${codecType.toUpperCase()} description，尝试使用空 description`);
          player = new WebcodecPlayer({
            codec: codecType,
            width: videoWidth || 1920,
            height: videoHeight || 1080,
            videoEl: targetVideoEl,
          });
        }
      }

      // 解封装完成后立即计算并显示统计信息
      const demuxStats: VideoDemuxDecoderStats = {
        videoCodecName,
        codecType,
        width: videoWidth,
        height: videoHeight,
        totalPackets: packetCount,
        videoPackets: videoPacketCount,
        keyframes: keyframeCount,
        keyframeRatio: videoPacketCount > 0 ? (keyframeCount / videoPacketCount * 100) : 0,
        videoStreamIndex,
      };

      // 更新统计信息，让 UI 立即显示
      stats.value = demuxStats;
      
      // 解封装完成，设置加载状态为 false，让 UI 显示统计信息
      isLoading.value = false;

      console.log(`\n=== 解封装统计信息 ===`);
      console.log(`视频编码格式: ${videoCodecName}`);
      console.log(`分辨率: ${demuxStats.width}x${demuxStats.height}`);
      console.log(`总数据包数: ${packetCount}`);
      console.log(`视频数据包数: ${videoPacketCount}`);
      console.log(`关键帧数量: ${keyframeCount}`);
      console.log(`关键帧比例: ${demuxStats.keyframeRatio.toFixed(2)}%`);

      // 第二步：使用 SpeedControl 控制解码速度（后台异步进行）
      console.log(`\n=== 开始解码视频帧 ===\n`);
      
      let decodedFrameCount = 0;
      
      // 确保 player 已创建
      if (!player) {
        throw new Error('Player 未创建，无法继续解码');
      }

      // 创建 SpeedControl 实例来控制解码速度
      const speedControl = new SpeedControl((encodedChunk: any) => {
        // SpeedControl 消费回调：执行实际的解码操作
        const frameData = encodedChunk as VideoFrameData;
        try {
          player!.decode(frameData.data, frameData.isKeyframe);
          decodedFrameCount++;
          
          // if (decodedFrameCount <= 100 || frameData.isKeyframe) {
          //   console.log(`✅ 解码视频帧 #${frameData.packetIndex}, size: ${frameData.data.length}, ${frameData.isKeyframe ? '关键帧' : '普通帧'}`);
          // }
        } catch (err) {
          console.error(`❌ 解码视频帧失败 #${frameData.packetIndex}:`, err);
        }
      });

      // 将所有缓存的视频帧添加到 SpeedControl 队列
      console.log(`正在将 ${videoFrameCache.length} 个视频帧添加到 SpeedControl 队列...`);
      for (const frameData of videoFrameCache) {
        // 将帧数据作为 EncodedVideoChunk 添加到队列
        // SpeedControl 会按照设定的速度（40ms/帧）自动消费
        speedControl.addEncodeVideoChunk(frameData as any);
      }

      // 等待所有帧解码完成
      // 计算预期的总时间：帧数 * 40ms
      const expectedDuration = videoFrameCache.length * 40;
      console.log(`预计解码时间: ${(expectedDuration / 1000).toFixed(2)} 秒`);
      
      // 等待解码完成（留一些余量）
      await new Promise<void>((resolve) => {
        const checkInterval = setInterval(() => {
          const queueSize = speedControl.getQueueSize();
          // console.log(`解码进度: ${decodedFrameCount}/${videoFrameCache.length}, 队列剩余: ${queueSize}`);
          
          // 当队列为空且所有帧都已解码时，完成
          if (queueSize === 0 && decodedFrameCount >= videoFrameCache.length) {
            clearInterval(checkInterval);
            resolve();
          }
        }, 1000); // 每秒检查一次进度
        
        // 设置超时保护（最多等待预期时间的2倍）
        setTimeout(() => {
          clearInterval(checkInterval);
          resolve();
        }, expectedDuration * 2 + 5000);
      });

      console.log(`\n=== 解码完成 ===`);
      console.log(`已解码帧数: ${decodedFrameCount}/${videoFrameCache.length}`);

      // 清理资源
      speedControl.destroy();
      player?.destroy();

      // 统计信息已在解封装完成后更新，这里直接返回
      return demuxStats;
    } catch (err) {
      console.error('解封装和解码过程出错:', err);
      error.value = err as Error;
      isLoading.value = false;
      throw err;
    }
  }

  return {
    processVideoFile,
    stats,
    isLoading,
    error,
  };
}

