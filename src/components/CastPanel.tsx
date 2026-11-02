/* eslint-disable @typescript-eslint/no-explicit-any */

'use client';

import { X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

import {
  detectCastCapabilities,
  isHlsUrl,
  needsNativeHlsForCast,
} from '@/lib/cast/capabilities';

export interface CastPanelProps {
  /** 当前播放地址（原始 m3u8 / mp4 地址，不含 blob:） */
  url: string;
  /** 是否已连接到远端设备 */
  connected: boolean;
  /** 是否已切换到原生 HLS 播放（投屏兼容模式） */
  castMode: boolean;
  /** 正在执行投屏动作 */
  busy: boolean;
  /** 面板内的提示信息 */
  message: string | null;
  onClose: () => void;
  onAirPlay: () => void;
  onRemoteCast: () => void;
  onEnterCastMode: () => void;
  onExitCastMode: () => void;
  onStopCast: () => void;
  onCopyUrl: () => void;
}

const CastIcon = ({ className }: { className?: string }) => (
  <svg
    className={className}
    viewBox='0 0 24 24'
    fill='none'
    stroke='currentColor'
    strokeWidth={1.8}
    strokeLinecap='round'
    strokeLinejoin='round'
  >
    <path d='M2 16.1A5 5 0 0 1 5.9 20M2 12.05A9 9 0 0 1 9.95 20M2 8V6a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-6' />
    <line x1='2' y1='20' x2='2.01' y2='20' />
  </svg>
);

export default function CastPanel({
  url,
  connected,
  castMode,
  busy,
  message,
  onClose,
  onAirPlay,
  onRemoteCast,
  onEnterCastMode,
  onExitCastMode,
  onStopCast,
  onCopyUrl,
}: CastPanelProps) {
  const caps = useMemo(() => detectCastCapabilities(), []);
  const [copied, setCopied] = useState(false);

  // 复制成功后 1.5s 复位
  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 1500);
    return () => clearTimeout(timer);
  }, [copied]);

  const mustSwitchNative = needsNativeHlsForCast(url, caps, castMode);
  const isHls = isHlsUrl(url);

  // ESC 关闭面板
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };
    document.addEventListener('keydown', handleKey, true);
    return () => document.removeEventListener('keydown', handleKey, true);
  }, [onClose]);

  const buttonBase =
    'w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed';

  return (
    <div
      className='absolute inset-0 z-[9999] flex items-center justify-center bg-black/70 backdrop-blur-sm'
      onClick={onClose}
    >
      <div
        className='w-[min(92%,400px)] max-h-[92%] overflow-y-auto rounded-2xl border border-gray-200/20 bg-white p-5 text-gray-900 shadow-2xl dark:border-white/10 dark:bg-gray-900 dark:text-gray-100'
        onClick={(e) => e.stopPropagation()}
      >
        {/* 顶部标题 */}
        <div className='flex items-center justify-between mb-4'>
          <div className='flex items-center gap-2'>
            <CastIcon className='w-5 h-5 text-green-500' />
            <h3 className='text-base font-semibold'>投屏播放</h3>
          </div>
          <button
            onClick={onClose}
            className='p-1 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:text-gray-200 dark:hover:bg-gray-800 transition-colors'
            aria-label='关闭'
          >
            <X className='w-5 h-5' />
          </button>
        </div>

        {/* 连接状态 */}
        <div
          className={`mb-4 flex items-center gap-2 rounded-xl px-3 py-2 text-xs ${
            connected
              ? 'bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-300'
              : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
          }`}
        >
          <span
            className={`inline-block w-2 h-2 rounded-full ${
              connected ? 'bg-green-500 animate-pulse' : 'bg-gray-400'
            }`}
          />
          {connected ? '已连接到投屏设备，画面在大屏播放' : '未连接投屏设备'}
        </div>

        {/* 投屏通道 */}
        <div className='space-y-2.5'>
          {caps.airplay && (
            <button
              className={`${buttonBase} bg-gradient-to-r from-green-500 to-emerald-600 text-white hover:from-green-600 hover:to-emerald-700`}
              onClick={onAirPlay}
              disabled={busy}
            >
              <CastIcon className='w-4 h-4' />
              AirPlay 投屏
            </button>
          )}

          {caps.remotePlayback && (
            <button
              className={`${buttonBase} ${
                caps.airplay
                  ? 'bg-gray-100 text-gray-800 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-100 dark:hover:bg-gray-700'
                  : 'bg-gradient-to-r from-green-500 to-emerald-600 text-white hover:from-green-600 hover:to-emerald-700'
              }`}
              onClick={onRemoteCast}
              disabled={busy}
            >
              <CastIcon className='w-4 h-4' />
              系统投屏（Chromecast 等）
            </button>
          )}

          {/* HLS 源需要先退回原生解码才能被远端接管 */}
          {mustSwitchNative && (
            <div className='rounded-xl border border-amber-300/60 bg-amber-50 p-3 text-xs leading-relaxed text-amber-800 dark:border-amber-500/30 dark:bg-amber-900/20 dark:text-amber-200'>
              <p className='font-medium mb-1.5'>当前为 HLS 直连播放</p>
              <p className='mb-2'>
                播放器默认使用 hls.js（MSE）解码，投屏设备无法接管这种数据流。
                点下方按钮切换为浏览器原生解码后再投屏（此模式下「去广告」临时失效）。
              </p>
              <button
                className={`${buttonBase} bg-amber-500 text-white hover:bg-amber-600`}
                onClick={onEnterCastMode}
                disabled={busy}
              >
                切换原生解码并投屏
              </button>
            </div>
          )}

          {castMode && (
            <button
              className={`${buttonBase} border border-gray-300 text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-800`}
              onClick={onExitCastMode}
              disabled={busy}
            >
              退出原生解码模式（恢复去广告）
            </button>
          )}

          {connected && (
            <button
              className={`${buttonBase} border border-red-300 text-red-600 hover:bg-red-50 dark:border-red-500/40 dark:text-red-400 dark:hover:bg-red-900/20`}
              onClick={onStopCast}
              disabled={busy}
            >
              停止投屏
            </button>
          )}
        </div>

        {/* 提示 */}
        {message && (
          <p className='mt-3 rounded-lg bg-gray-100 px-3 py-2 text-xs leading-relaxed text-gray-600 dark:bg-gray-800 dark:text-gray-300'>
            {message}
          </p>
        )}

        {/* 降级方案 */}
        <div className='mt-4 border-t border-gray-200 pt-3 dark:border-gray-700'>
          <button
            className={`${buttonBase} border border-gray-300 text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-800`}
            onClick={() => {
              onCopyUrl();
              setCopied(true);
            }}
          >
            {copied ? '已复制播放地址' : '复制播放地址'}
          </button>
          <p className='mt-2 text-[11px] leading-relaxed text-gray-500 dark:text-gray-400'>
            可把地址粘贴到手机播放器 / TVbox 等客户端推送到电视。
            {isHls && '（HLS 地址需要播放器支持 m3u8）'}
          </p>
        </div>

        {/* 能力说明 */}
        <p className='mt-4 text-[11px] leading-relaxed text-gray-400 dark:text-gray-500'>
          {caps.supported
            ? 'DLNA 无法在网页内实现（浏览器不支持 SSDP 多播发现），如需 DLNA 请使用系统级投屏或第三方播放器。'
            : '当前浏览器不支持网页投屏，请使用 Safari（AirPlay）、Chrome / Edge（Chromecast），或复制地址到其他设备播放。'}
        </p>
      </div>
    </div>
  );
}
