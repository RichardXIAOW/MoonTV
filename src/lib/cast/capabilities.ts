/* eslint-disable @typescript-eslint/no-explicit-any, no-console */

/**
 * 投屏能力探测
 *
 * 浏览器侧可用的「投屏」通道只有两条，其余（DLNA / 原生 Chromecast SDK）在纯 Web 环境下不可行：
 * 1. AirPlay            —— Safari（macOS / iOS）私有 API：webkitShowPlaybackTargetPicker
 * 2. Remote Playback API —— 标准 API（Chrome / Edge），可发现 Chromecast、部分电视/音箱
 *
 * 无法在浏览器内实现 DLNA 的原因：SSDP 设备发现依赖 UDP 多播，JS 无法发送 UDP 包；
 * 而 Chromecast 官方 SDK 需要加载 gstatic 上的 sender 脚本 + 自建支持 HLS 的 receiver，
 * 在国内网络环境下不可用，故此处不作为默认通道。
 */

export interface CastCapabilities {
  /** Safari 私有 AirPlay 选择器是否可用 */
  airplay: boolean;
  /** 标准 Remote Playback API 是否可用 */
  remotePlayback: boolean;
  /** 浏览器是否自带 HLS 解码（Safari / iOS），决定投屏时能否脱离 hls.js */
  nativeHls: boolean;
  isIOS: boolean;
  isSafari: boolean;
  /** 是否存在任一可用投屏通道 */
  supported: boolean;
}

const EMPTY_CAPABILITIES: CastCapabilities = {
  airplay: false,
  remotePlayback: false,
  nativeHls: false,
  isIOS: false,
  isSafari: false,
  supported: false,
};

let cachedCapabilities: CastCapabilities | null = null;

/** 探测当前浏览器可用的投屏通道（结果缓存，避免重复创建 video 元素） */
export function detectCastCapabilities(): CastCapabilities {
  if (typeof window === 'undefined') return EMPTY_CAPABILITIES;
  if (cachedCapabilities) return cachedCapabilities;

  const ua =
    typeof navigator !== 'undefined' && navigator.userAgent
      ? navigator.userAgent
      : '';

  // iPadOS 13+ 的 UA 与 macOS 一致，需要靠触摸点判断
  const isIOS =
    /iPad|iPhone|iPod/.test(ua) ||
    (/Macintosh/.test(ua) &&
      typeof document !== 'undefined' &&
      'ontouchend' in document);

  const isSafari =
    isIOS ||
    (/safari/i.test(ua) &&
      !/chrome|chromium|crios|fxios|edg|android/i.test(ua));

  // Artplayer 判定 AirPlay 可用性用的是同一个全局对象
  const airplay =
    typeof (window as any).WebKitPlaybackTargetAvailabilityEvent !==
    'undefined';

  let nativeHls = false;
  try {
    nativeHls = !!document
      .createElement('video')
      .canPlayType('application/vnd.apple.mpegurl');
  } catch {
    nativeHls = false;
  }

  let remotePlayback = false;
  try {
    remotePlayback = 'remote' in document.createElement('video');
  } catch {
    remotePlayback = false;
  }

  cachedCapabilities = {
    airplay,
    remotePlayback,
    nativeHls,
    isIOS,
    isSafari,
    supported: airplay || remotePlayback,
  };

  return cachedCapabilities;
}

/** 是否为 HLS（m3u8）地址 */
export function isHlsUrl(url: string): boolean {
  if (!url) return false;
  return /\.m3u8(\?|#|$)/i.test(url) || /\/m3u8\//i.test(url);
}

/**
 * 判断「当前播放源是否必须切到原生 HLS 才能投屏」。
 * hls.js 通过 MSE 把数据喂给 <video>（src 为 blob:），Remote Playback / AirPlay 无法接管 blob，
 * 因此 HLS + hls.js 的场景必须先退回浏览器原生解码。
 */
export function needsNativeHlsForCast(
  url: string,
  caps: CastCapabilities,
  alreadyCastMode: boolean
): boolean {
  if (alreadyCastMode) return false;
  if (!caps.nativeHls) return false;
  return isHlsUrl(url);
}
