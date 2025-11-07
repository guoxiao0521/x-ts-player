import { VideoRender } from "./video-render";

interface WebcodecPlayerOptions {
    codec: 'h264' | 'h265' | 'vp9' | 'vp8';
    width: number;
    height: number;
    videoEl: HTMLVideoElement;
}

const CodecRecord: Record<string, string> = {
    'h264': 'avc1.42001e',
    'h265': 'hev1.1.6.1L120.B0',
} as const;

export class WebcodecPlayer {
    private options: WebcodecPlayerOptions;
    private videoRender: VideoRender | null;
    private decoderProfile: VideoDecoderConfig | null;
    private decoder: VideoDecoder | null;
    private frameCount: number = 0;

    constructor(options: WebcodecPlayerOptions) {
        this.options = options;
        
        console.log('[WebcodecPlayer] Initializing with options:', {
            codec: options.codec,
            width: options.width,
            height: options.height,
            hasVideoEl: !!options.videoEl
        });
        
        this.videoRender = new VideoRender({
            width: options.width,
            height: options.height,
            videoEl: options.videoEl,
        });
        this.decoderProfile = null;
        this.decoder = null;

        this.createDecoder();
    }

    private async createDecoder() {
        const codecString = this.getCodecString();
        
        if (!codecString) {
            console.error(`[WebcodecPlayer] Unsupported codec: ${this.options.codec}`);
            return;
        }

        this.decoderProfile = {
            codedWidth: this.options.width,
            codedHeight: this.options.height,
            codec: codecString,
        } as VideoDecoderConfig;
        
        // 检查浏览器是否支持该编解码器
        try {
            const support = await VideoDecoder.isConfigSupported(this.decoderProfile);
            if (!support.supported) {
                console.error(`[WebcodecPlayer] Codec not supported by browser: ${codecString}`);
                console.error('Support info:', support);
                return;
            }
            console.log(`[WebcodecPlayer] Codec supported: ${codecString}`);
        } catch (error) {
            console.warn('[WebcodecPlayer] Could not check codec support:', error);
        }
        
        // 创建解码器
        this.decoder = new VideoDecoder({
           output: (videoFrame: VideoFrame) => {
                // 渲染视频帧
                if (this.videoRender) {
                    this.videoRender.render(videoFrame);
                } else {
                    videoFrame.close();
                }
           },
           error: (error) => {
                console.error('[WebcodecPlayer] Decoder error:', error);
           },
        });
        
        try {
            // 配置解码器
            this.decoder.configure(this.decoderProfile);
            console.log(`[WebcodecPlayer] Decoder configured successfully: ${this.options.codec}, ${codecString}`);
        } catch (error) {
            console.error(`[WebcodecPlayer] Failed to configure decoder:`, error);
        }
    }

    private getCodecString() {
        return CodecRecord[this.options.codec];
    }

    /**
     * 解码视频数据（通过速度控制器）
     * @param encodeVideoBuffer 编码后的视频数据
     * @param isKeyframe 是否是关键帧
     */
    decode(encodeVideoBuffer: Uint8Array, isKeyframe: boolean) {
        // 创建 EncodedVideoChunk 并添加到速度控制队列
        const encodedVideoChunk = new EncodedVideoChunk({
            data: encodeVideoBuffer,
            type: isKeyframe ? 'key' : 'delta',
            timestamp: 0
        });
        this.decodeChunk(encodedVideoChunk);
        this.frameCount++;
        // 每100帧输出一次调试信息
        if (this.frameCount % 100 === 0) {
            console.log(`[WebcodecPlayer] Received ${this.frameCount} frames`);
        }
    }

    /**
     * 实际解码视频帧（由速度控制器调用）
     * @param encodedVideoChunk 编码后的视频数据块
     */
    private decodeChunk(encodedVideoChunk: EncodedVideoChunk) {
        if (!this.decoder) {
            console.warn('[WebcodecPlayer] Decoder not initialized');
            return;
        }

        try {
            // console.log('[WebcodecPlayer] Decoding chunk:', encodedVideoChunk);
            this.decoder.decode(encodedVideoChunk);
        } catch (error) {
            console.error(`[WebcodecPlayer] decode error:`, error);
        }
    }

    destroy() {
        this.decoder?.close();
        this.decoder = null;
        this.decoderProfile = null;
        this.videoRender?.destroy();
        this.videoRender = null;
    }
    
}