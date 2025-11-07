/**
 * 检测 H.264 关键帧
 * @param data 视频数据
 * @param maxSearchBytes 最大搜索字节数（默认100字节）
 * @returns 是否为关键帧
 */
export function isH264Keyframe(data: Uint8Array, maxSearchBytes: number = 100): boolean {
  const searchLength = Math.min(data.length, maxSearchBytes);
  
  // 查找 NAL 单元起始码 (0x00 0x00 0x00 0x01 或 0x00 0x00 0x01)
  for (let i = 0; i < searchLength - 4; i++) {
    // 检查 4 字节起始码
    if (data[i] === 0x00 && data[i+1] === 0x00 && data[i+2] === 0x00 && data[i+3] === 0x01) {
      const nalStart = i + 4;
      if (nalStart < data.length && data[nalStart] !== undefined) {
        const nalType = data[nalStart] & 0x1F;
        // NAL 类型 5 = IDR 帧（关键帧）
        // NAL 类型 7 = SPS（序列参数集，通常在关键帧前）
        // NAL 类型 8 = PPS（图像参数集，通常在关键帧前）
        if (nalType === 5 || nalType === 7 || nalType === 8) {
          return true;
        }
      }
    }
    // 检查 3 字节起始码
    else if (data[i] === 0x00 && data[i+1] === 0x00 && data[i+2] === 0x01) {
      const nalStart = i + 3;
      if (nalStart < data.length && data[nalStart] !== undefined) {
        const nalType = data[nalStart] & 0x1F;
        if (nalType === 5 || nalType === 7 || nalType === 8) {
          return true;
        }
      }
    }
  }
  
  return false;
}

/**
 * 检测 H.265/HEVC 关键帧
 * @param data 视频数据
 * @param maxSearchBytes 最大搜索字节数（默认100字节）
 * @returns 是否为关键帧
 */
export function isH265Keyframe(data: Uint8Array, maxSearchBytes: number = 100): boolean {
  const searchLength = Math.min(data.length, maxSearchBytes);
  
  // 查找 NAL 单元起始码 (0x00 0x00 0x00 0x01 或 0x00 0x00 0x01)
  for (let i = 0; i < searchLength - 4; i++) {
    // 检查 4 字节起始码
    if (data[i] === 0x00 && data[i+1] === 0x00 && data[i+2] === 0x00 && data[i+3] === 0x01) {
      const nalStart = i + 4;
      if (nalStart < data.length && data[nalStart] !== undefined) {
        // H.265 NAL 单元类型在第一个字节的高 6 位
        const nalType = (data[nalStart] >> 1) & 0x3F;
        // NAL 类型 19-20 = IDR 帧（关键帧）
        // NAL 类型 32 = VPS（视频参数集）
        // NAL 类型 33 = SPS（序列参数集）
        // NAL 类型 34 = PPS（图像参数集）
        if ((nalType >= 19 && nalType <= 20) || (nalType >= 32 && nalType <= 34)) {
          return true;
        }
      }
    }
    // 检查 3 字节起始码
    else if (data[i] === 0x00 && data[i+1] === 0x00 && data[i+2] === 0x01) {
      const nalStart = i + 3;
      if (nalStart < data.length && data[nalStart] !== undefined) {
        const nalType = (data[nalStart] >> 1) & 0x3F;
        if ((nalType >= 19 && nalType <= 20) || (nalType >= 32 && nalType <= 34)) {
          return true;
        }
      }
    }
  }
  
  return false;
}

/**
 * 根据编码类型检测关键帧
 * @param codec 编码类型
 * @param data 视频数据
 * @param maxSearchBytes 最大搜索字节数（默认100字节）
 * @returns 是否为关键帧
 */
export function detectKeyframe(
  codec: 'h264' | 'h265' | 'vp9' | 'vp8',
  data: Uint8Array,
  maxSearchBytes: number = 100
): boolean {
  switch (codec) {
    case 'h264':
      return isH264Keyframe(data, maxSearchBytes);
    case 'h265':
      return isH265Keyframe(data, maxSearchBytes);
    case 'vp9':
    case 'vp8':
      // VP8/VP9 关键帧检测可以在未来添加
      return false;
    default:
      return false;
  }
}

