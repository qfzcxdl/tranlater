// 悬浮字幕窗口组件
// 显示双语字幕，支持自动滚动和拖拽移动

import React, { useState, useEffect, useRef, useCallback } from 'react'
import type { SubtitleItem, TranslationResult } from '../../../../shared/types'
import './subtitle.css'

const MAX_SUBTITLES = 8
const SUBTITLE_TTL = 30000

export const SubtitleWindow: React.FC = () => {
  const [subtitles, setSubtitles] = useState<SubtitleItem[]>([])
  const [interimResult, setInterimResult] = useState<SubtitleItem | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  // 自动滚动到底部
  const scrollToBottom = useCallback(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight
    }
  }, [])

  useEffect(() => {
    // 监听最终翻译结果
    const unsubResult = window.electronAPI.onTranslationResult((result: TranslationResult) => {
      const newSubtitle: SubtitleItem = {
        id: `${result.timestamp}-${Math.random().toString(36).slice(2, 8)}`,
        original: result.original,
        translated: result.translated,
        timestamp: result.timestamp,
        isFinal: true,
      }

      setSubtitles(prev => {
        // 清除中间结果
        setInterimResult(null)

        // 添加新字幕，保持最大条数限制
        const updated = [...prev, newSubtitle]
        return updated.slice(-MAX_SUBTITLES)
      })

      // 设置自动消失定时器
      setTimeout(() => {
        setSubtitles(prev => prev.filter(s => s.id !== newSubtitle.id))
      }, SUBTITLE_TTL)

      // 滚动到底部
      requestAnimationFrame(scrollToBottom)
    })

    // 监听中间结果
    const unsubInterim = window.electronAPI.onTranslationInterim((result: TranslationResult) => {
      setInterimResult({
        id: 'interim',
        original: result.original,
        translated: result.translated,
        timestamp: result.timestamp,
        isFinal: false,
      })

      requestAnimationFrame(scrollToBottom)
    })

    return () => {
      unsubResult()
      unsubInterim()
    }
  }, [scrollToBottom])

  // 合并最终字幕和中间结果
  const displayItems = [...subtitles]
  if (interimResult) {
    displayItems.push(interimResult)
  }

  const isEmpty = displayItems.length === 0

  return (
    <div className="subtitle-window">
      {/* 拖拽区域 */}
      <div className="drag-handle" title="拖拽移动字幕位置" />

      {/* 字幕容器 */}
      <div className="subtitle-container" ref={containerRef}>
        {isEmpty && (
          <div className="subtitle-placeholder">
            等待语音输入...
          </div>
        )}

        {displayItems.map((item, index) => (
          <div
            key={item.id}
            className={`subtitle-item ${item.isFinal ? 'final' : 'interim'} ${
              index === displayItems.length - 1 ? 'latest' : ''
            }`}
          >
            <div className="subtitle-original">{item.original}</div>
            {item.translated && item.translated !== item.original && (
              <div className="subtitle-translated">{item.translated}</div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
