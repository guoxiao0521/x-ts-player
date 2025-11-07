export class SpeedControl {
    private encodeVideoChunkQueue: EncodedVideoChunk[] = [];
    private onFrame: (frame: EncodedVideoChunk) => void;
    private preTime: number = 0;
    private reqId: number = 0;
    private frameInterval: number = 35; // 每40ms输出一帧
    private firstFrameTime: number = 0;
    private paused: boolean = false;

    constructor(onFrame: (frame: EncodedVideoChunk) => void) {
        this.encodeVideoChunkQueue = [];
        this.onFrame = onFrame;
        
        const reqFrame = (time: number) => {
            try {
                // 等待第一帧到达后才开始计时
                if (this.firstFrameTime) {
                    const offset = time - this.preTime;
                    
                    // 如果时间间隔超过1.5倍的目标间隔，消费两帧追赶进度
                    if (offset >= 1.5 * this.frameInterval) {
                        this.preTime = time;
                        if (!this.paused) {
                            this.consume();
                            this.consume();
                        }
                    } 
                    // 如果时间间隔达到目标间隔，消费一帧
                    else if (offset >= this.frameInterval) {
                        this.preTime = this.preTime + this.frameInterval;
                        if (!this.paused) {
                            this.consume();
                        }
                    }
                }
            } catch (error) {
                console.error('[SpeedControl] requestAnimationFrame error:', error);
            } finally {
                this.reqId = requestAnimationFrame(reqFrame);
            }
        };
        
        this.reqId = requestAnimationFrame(reqFrame);
    }

    /**
     * 添加编码后的视频数据到队列
     * @param encodeVideoChunk 编码后的视频数据
     */
    addEncodeVideoChunk(encodeVideoChunk: EncodedVideoChunk) {
        this.encodeVideoChunkQueue.push(encodeVideoChunk);
        console.log('addEncodeVideoChunk', encodeVideoChunk);
        // 记录第一帧到达时间
        if (!this.firstFrameTime) {
            console.log('firstFrameTime', performance.now());
            this.firstFrameTime = performance.now();
            this.preTime = this.firstFrameTime;
        }
    }

    /**
     * 消费一帧编码数据
     */
    private consume() {
        const encodeVideoChunk = this.encodeVideoChunkQueue.shift();
        if (encodeVideoChunk) {
            this.onFrame(encodeVideoChunk);
        }
    }

    /**
     * 设置暂停状态
     * @param paused 是否暂停
     */
    setPausedState(paused: boolean) {
        this.paused = paused;
    }

    /**
     * 获取当前队列长度
     */
    getQueueSize(): number {
        return this.encodeVideoChunkQueue.length;
    }

    /**
     * 销毁并释放资源
     */
    destroy() {
        if (this.reqId) {
            cancelAnimationFrame(this.reqId);
            this.reqId = 0;
        }
        
        this.encodeVideoChunkQueue = [];
        this.onFrame = null as any;
    }
}