/* eslint-disable @typescript-eslint/no-explicit-any, no-console */

/**
 * 播放目标的接管封装：AirPlay（Safari 私有） + Remote Playback API（标准）
 */

export type RemoteCastFailure =
  | 'unsupported' // 浏览器无 Remote Playback API
  | 'canceled' // 用户在设备选择器里取消
  | 'not-supported-source' // 当前媒体源不可投（典型：MSE / blob）
  | 'error';

export interface RemoteCastResult {
  ok: boolean;
  reason?: RemoteCastFailure;
  message?: string;
}

/** 取出 video 元素上的 RemotePlayback 实例 */
export function getRemotePlayback(
  video: HTMLVideoElement | null
): RemotePlayback | null {
  if (!video) return null;
  const remote = (video as any).remote as RemotePlayback | undefined;
  return remote && typeof remote.prompt === 'function' ? remote : null;
}

/** 元素是否具备 Remote Playback 能力 */
export function hasRemotePlayback(video: HTMLVideoElement | null): boolean {
  return !!getRemotePlayback(video);
}

/** 让 video 元素允许被远端接管（AirPlay / Remote Playback 的前置条件） */
export function prepareVideoForCasting(video: HTMLVideoElement | null): void {
  if (!video) return;
  try {
    video.disableRemotePlayback = false;
    if (video.hasAttribute('disableRemotePlayback')) {
      video.removeAttribute('disableRemotePlayback');
    }
    // iOS / Safari 原生控件与 AirPlay 白名单
    video.setAttribute('x-webkit-airplay', 'allow');
  } catch (err) {
    console.warn('准备 video 投屏属性失败:', err);
  }
}

/** 唤起 Safari 的 AirPlay 设备选择器，返回是否成功发起 */
export function showAirPlayPicker(video: HTMLVideoElement | null): boolean {
  if (!video) return false;
  const picker = (video as any).webkitShowPlaybackTargetPicker;
  if (typeof picker !== 'function') return false;
  try {
    prepareVideoForCasting(video);
    picker.call(video);
    return true;
  } catch (err) {
    console.warn('唤起 AirPlay 选择器失败:', err);
    return false;
  }
}

/** 唤起标准 Remote Playback 设备选择器（Chrome / Edge 可发现 Chromecast 等） */
export async function promptRemotePlayback(
  video: HTMLVideoElement | null
): Promise<RemoteCastResult> {
  const remote = getRemotePlayback(video);
  if (!remote || !video) return { ok: false, reason: 'unsupported' };

  try {
    prepareVideoForCasting(video);
    // Chrome 要求媒体源为直连 URL；MSE(blob) 会抛 NotSupportedError
    await remote.prompt();
    return { ok: true };
  } catch (err: any) {
    const name: string = err && err.name ? err.name : '';
    if (name === 'NotAllowedError') return { ok: false, reason: 'canceled' };
    if (name === 'NotSupportedError' || name === 'NotSupported')
      return { ok: false, reason: 'not-supported-source' };
    return {
      ok: false,
      reason: 'error',
      message: (err && err.message) || String(err),
    };
  }
}

/** 结束当前投屏会话（尽力而为，失败不抛出） */
export async function stopCasting(
  video: HTMLVideoElement | null
): Promise<void> {
  const remote = getRemotePlayback(video);
  if (!remote) return;
  const cancel = (remote as any).cancel;
  if (typeof cancel !== 'function') return;
  try {
    await cancel.call(remote);
  } catch (err) {
    console.warn('结束投屏失败:', err);
  }
}

/** 当前是否已连接到远端播放设备 */
export function isCasting(video: HTMLVideoElement | null): boolean {
  if (!video) return false;
  const remote = getRemotePlayback(video);
  if (remote && remote.state === 'connected') return true;
  // Safari：webkitCurrentPlaybackTargetIsWireless 在投屏中为 true
  return !!(video as any).webkitCurrentPlaybackTargetIsWireless;
}

/**
 * 监听投屏连接状态变化。
 * 同时覆盖 Safari 的 webkitplaybacktargetstatechanged 与标准 RemotePlayback 事件。
 * @returns 取消监听的函数
 */
export function watchCastTarget(
  video: HTMLVideoElement | null,
  onChange: (connected: boolean) => void
): () => void {
  if (!video) return () => undefined;

  const remote = getRemotePlayback(video);

  const handleConnect = () => onChange(true);
  const handleDisconnect = () => onChange(false);

  // Safari：AirPlay 状态事件
  const handleWebkitState = (event: any) => {
    const state = event && event.state ? event.state : '';
    if (state === 'connected') onChange(true);
    else if (state === 'disconnected') onChange(false);
  };

  if (remote) {
    remote.addEventListener('connect', handleConnect);
    remote.addEventListener('disconnect', handleDisconnect);
    if (remote.state === 'connected') onChange(true);
  }

  video.addEventListener(
    'webkitplaybacktargetstatechanged' as any,
    handleWebkitState
  );

  return () => {
    if (remote) {
      remote.removeEventListener('connect', handleConnect);
      remote.removeEventListener('disconnect', handleDisconnect);
    }
    video.removeEventListener(
      'webkitplaybacktargetstatechanged' as any,
      handleWebkitState
    );
  };
}
