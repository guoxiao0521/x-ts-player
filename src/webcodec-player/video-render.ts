/**
 * 用 video 元素渲染 videoFrame, 还可以控制一些 视频功能相关的方法
 * @author guo xiao
 */

// 为 MediaStreamTrackGenerator 添加类型声明
declare global {
    class MediaStreamTrackGenerator extends MediaStreamTrack {
        constructor(options: { kind: 'video' | 'audio' });
        readonly writable: WritableStream<VideoFrame | AudioData>;
    }
}

export interface VideoRenderOptions {
    width: number;
    height: number;
    videoEl: HTMLVideoElement;
}

export class VideoRender {
    private options: VideoRenderOptions;
    private videoElement: HTMLVideoElement | null = null;
    private videoTrackGenerator: MediaStreamTrackGenerator | null = null;
    private videoWriter: WritableStreamDefaultWriter<VideoFrame> | null = null;

    /**
     * 构造函数
     * @param options - 渲染配置选项
     */
    constructor(options: VideoRenderOptions) {
        this.options = Object.assign({}, options);
        const { videoEl } = this.options;

        if (!videoEl) {
            console.error("video element can't is null");
            return;
        }

        if (!(window as any)['MediaStreamTrackGenerator']) {
            console.error(
                'sry, this browser not support MediaStreamTrackGenerator'
            );
            return;
        }

        this.init();
    }

    /**
     * 初始化视频渲染器
     */
    private init(): void {
        console.log('[VideoRender] Initializing video render');
        const { width, height, videoEl } = this.options;

        this.videoElement = videoEl;
        this.videoElement.width = width;
        this.videoElement.height = height;
        this.videoElement.muted = true;
        this.videoElement.autoplay = true;

        try {
            this.videoTrackGenerator = new MediaStreamTrackGenerator({ kind: 'video' });
            this.videoElement.srcObject = new MediaStream([this.videoTrackGenerator]);
            this.videoWriter = this.videoTrackGenerator.writable.getWriter();
            console.log('[VideoRender] Video render initialized successfully');
        } catch (error) {
            console.error('[VideoRender] Failed to initialize:', error);
        }
    }

    /**
     * 渲染视频帧
     * @param videoFrame - VideoFrame 对象
     */
    public render(videoFrame: VideoFrame): void {
        console.log(videoFrame)
        if (this.videoWriter) {
            try {
                this.videoWriter.write(videoFrame);
            } catch (error) {
                console.error('[VideoRender] Failed to write frame:', error);
                videoFrame?.close?.();
            }
        } else {
            console.warn('[VideoRender] videoWriter not initialized');
            videoFrame?.close?.();
        }
    }

    /**
     * VideoRender 不支持 ImageData 渲染，因为它依赖于 MediaStreamTrackGenerator
     * 在低版本浏览器中应该使用 CanvasRender
     * @param _data - ImageData 对象
     */
    public renderImageData(_data: ImageData): void {
        console.warn('VideoRender does not support ImageData rendering. Please use CanvasRender for compatibility with older browsers.');
    }

    /**
     * 销毁渲染器，释放资源
     */
    public destroy(): void {
        if (this.videoTrackGenerator) {
            this.videoTrackGenerator.stop();
            if (this.videoElement && this.videoElement.srcObject) {
                try {
                    (this.videoElement.srcObject as MediaStream).removeTrack(
                        this.videoTrackGenerator
                    );
                    this.videoElement.srcObject = null;
                } catch (e) {
                    console.error(e);
                }
            }
        }

        this.videoTrackGenerator = null;
        this.videoElement = null;
        this.videoWriter = null;
    }
}