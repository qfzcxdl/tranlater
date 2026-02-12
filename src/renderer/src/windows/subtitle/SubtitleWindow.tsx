// 字幕窗口主组件

import React, { useState, useEffect } from 'react';
import { SubtitleItem } from '../../../shared/types';

declare global {
  interface Window {
    electronAPI: any;
  }
}

const MAX_SUBTITLES = 3;
const SUBTITLE_DURATION = 10000; // 10秒

export const SubtitleWindow: React.FC = () => {
  const [subtitles, setSubtitles] = useState<SubtitleItem[]>([]);
  const [interimResult, setInterimResult] = useState<SubtitleItem | null>(null);

  useEffect(() => {
    // 监听最终翻译结果
    const unsubscribeResult = window.electronAPI.onTranslationResult((result: any) => {
      const newSubtitle: SubtitleItem = {
        id: `${result.timestamp}-${Math.random()}`,
        original: result.original,
        translated: result.translated,
        timestamp: result.timestamp,
        isFinal: true,
      };

      setSubtitles((prev) => {
        // 清除中间结果
        setInterimResult(null);

        // 添加新字幕，保持最新的 MAX_SUBTITLES 条
        const updated = [...prev, newSubtitle];
        return updated.slice(-MAX_SUBTITLES);
      });

      // 设置定时器自动移除
      setTimeout(() => {
        setSubtitles((prev) => prev.filter((s) => s.id !== newSubtitle.id));
      }, SUBTITLE_DURATION);
    });

    // 监听中间结果
    const unsubscribeInterim = window.electronAPI.onTranslationInterim((result: any) => {
      setInterimResult({
        id: 'interim',
        original: result.original,
        translated: result.translated,
        timestamp: result.timestamp,
        isFinal: false,
      });
    });

    return () => {
      unsubscribeResult();
      unsubscribeInterim();
    };
  }, []);

  const displayItems = [...subtitles];
  if (interimResult) {
    displayItems.push(interimResult);
  }

  return (
    <div className="subtitle-window">
      <div className="subtitle-container">
        {displayItems.map((item) => (
          <div
            key={item.id}
            className={`subtitle-item ${item.isFinal ? 'final' : 'interim'}`}
          >
            <div className="subtitle-original">{item.original}</div>
            <div className="subtitle-translated">{item.translated}</div>
          </div>
        ))}
      </div>
    </div>
  );
};
