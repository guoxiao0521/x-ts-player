/**
 * 从 H.264 关键帧中提取 SPS/PPS 参数集，构建 WebCodecs description
 * @param data 视频帧数据
 * @returns description 数据，如果提取失败返回 undefined
 */
export function extractH264Description(data: Uint8Array): Uint8Array | undefined {
  const nalUnits: Uint8Array[] = [];
  let i = 0;

  // 查找所有 NAL 单元
  while (i < data.length - 4) {
    let nalStart = -1;

    // 检查 4 字节起始码
    if (data[i] === 0x00 && data[i + 1] === 0x00 && data[i + 2] === 0x00 && data[i + 3] === 0x01) {
      nalStart = i + 4;
    }
    // 检查 3 字节起始码
    else if (data[i] === 0x00 && data[i + 1] === 0x00 && data[i + 2] === 0x01) {
      nalStart = i + 3;
    }

    if (nalStart >= 0) {
      // 找到下一个起始码
      let nalEnd = data.length;
      for (let j = nalStart; j < data.length - 3; j++) {
        if ((data[j] === 0x00 && data[j + 1] === 0x00 && data[j + 2] === 0x01) ||
            (data[j] === 0x00 && data[j + 1] === 0x00 && data[j + 2] === 0x00 && data[j + 3] === 0x01)) {
          nalEnd = j;
          break;
        }
      }

      if (nalStart >= 0 && nalStart < nalEnd && nalStart < data.length) {
        const nalByte = data[nalStart];
        if (nalByte !== undefined) {
          // H.264 NAL 类型在第一个字节的低 5 位
          const nalType = nalByte & 0x1F;
          // SPS (7), PPS (8)
          if (nalType === 7 || nalType === 8) {
            const nalData = data.subarray(nalStart, nalEnd);
            nalUnits.push(nalData);
          }
        }
      }

      i = nalStart;
    } else {
      i++;
    }
  }

  if (nalUnits.length === 0) {
    return undefined;
  }

  // 构建 description：每个 NAL 单元前加上长度（2 字节，big-endian）
  let totalLength = 0;
  for (const nal of nalUnits) {
    totalLength += 2 + nal.length;
  }

  const description = new Uint8Array(totalLength);
  let offset = 0;
  for (const nal of nalUnits) {
    // 写入长度（2 字节，big-endian）
    description[offset] = (nal.length >> 8) & 0xFF;
    description[offset + 1] = nal.length & 0xFF;
    offset += 2;
    // 写入 NAL 单元数据
    description.set(nal, offset);
    offset += nal.length;
  }

  return description;
}

/**
 * 从 H.265 关键帧中提取 VPS/SPS/PPS 参数集，构建 WebCodecs description
 * @param data 视频帧数据
 * @returns description 数据，如果提取失败返回 undefined
 */
export function extractH265Description(data: Uint8Array): Uint8Array | undefined {
  const nalUnits: Uint8Array[] = [];
  let i = 0;

  // 查找所有 NAL 单元
  while (i < data.length - 4) {
    let nalStart = -1;

    // 检查 4 字节起始码
    if (data[i] === 0x00 && data[i + 1] === 0x00 && data[i + 2] === 0x00 && data[i + 3] === 0x01) {
      nalStart = i + 4;
    }
    // 检查 3 字节起始码
    else if (data[i] === 0x00 && data[i + 1] === 0x00 && data[i + 2] === 0x01) {
      nalStart = i + 3;
    }

    if (nalStart >= 0) {
      // 找到下一个起始码
      let nalEnd = data.length;
      for (let j = nalStart; j < data.length - 3; j++) {
        if ((data[j] === 0x00 && data[j + 1] === 0x00 && data[j + 2] === 0x01) ||
            (data[j] === 0x00 && data[j + 1] === 0x00 && data[j + 2] === 0x00 && data[j + 3] === 0x01)) {
          nalEnd = j;
          break;
        }
      }

      if (nalStart >= 0 && nalStart < nalEnd && nalStart < data.length) {
        const nalByte = data[nalStart];
        if (nalByte !== undefined) {
          const nalType = (nalByte >> 1) & 0x3F;
          // VPS (32), SPS (33), PPS (34)
          if (nalType >= 32 && nalType <= 34) {
            const nalData = data.subarray(nalStart, nalEnd);
            nalUnits.push(nalData);
          }
        }
      }

      i = nalStart;
    } else {
      i++;
    }
  }

  if (nalUnits.length === 0) {
    return undefined;
  }

  // 构建 description：每个 NAL 单元前加上长度（2 字节，big-endian）
  let totalLength = 0;
  for (const nal of nalUnits) {
    totalLength += 2 + nal.length;
  }

  const description = new Uint8Array(totalLength);
  let offset = 0;
  for (const nal of nalUnits) {
    // 写入长度（2 字节，big-endian）
    description[offset] = (nal.length >> 8) & 0xFF;
    description[offset + 1] = nal.length & 0xFF;
    offset += 2;
    // 写入 NAL 单元数据
    description.set(nal, offset);
    offset += nal.length;
  }

  return description;
}

