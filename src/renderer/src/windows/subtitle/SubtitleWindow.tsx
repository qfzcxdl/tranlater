// 悬浮字幕窗口组件
// 显示双语字幕，支持自动滚动和拖拽移动

import React, { useState, useEffect, useRef, useCallback } from 'react'
import type { SubtitleItem, TranslationResult } from '../../../../shared/types'
import './subtitle.css'

const MAX_SUBTITLES = 20
const SUBTITLE_TTL = 120000  // 字幕显示2分钟后自动消失

export const SubtitleWindow: React.FC = () => {
  const [subtitles, setSubtitles] = useState<SubtitleItem[]>([])
  const [interimResult, setInterimResult] = useState<SubtitleItem | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const dragStartRef = useRef<{ x: number; y: number } | null>(null)

  // 自动滚动到底部
  const scrollToBottom = useCallback(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight
    }
  }, [])

  // 拖拽移动字幕窗口
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!dragStartRef.current) return
      const deltaX = e.screenX - dragStartRef.current.x
      const deltaY = e.screenY - dragStartRef.current.y
      dragStartRef.current = { x: e.screenX, y: e.screenY }
      window.electronAPI.moveSubtitleWindow(deltaX, deltaY)
    }

    const handleMouseUp = () => {
      dragStartRef.current = null
      setIsDragging(false)
    }

    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove)
      window.addEventListener('mouseup', handleMouseUp)
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isDragging])

  const handleDragStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    dragStartRef.current = { x: e.screenX, y: e.screenY }
    setIsDragging(true)
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

    // 监听更新事件（替换最后一条 final 字幕）
    const unsubUpdate = window.electronAPI.onTranslationUpdate((result: TranslationResult) => {
      setSubtitles(prev => {
        if (prev.length === 0) return prev
        // 替换最后一条 final 字幕的内容
        const updated = [...prev]
        const lastIdx = updated.length - 1
        updated[lastIdx] = {
          ...updated[lastIdx],
          original: result.original,
          translated: result.translated,
        }
        return updated
      })

      requestAnimationFrame(scrollToBottom)
    })

    return () => {
      unsubResult()
      unsubInterim()
      unsubUpdate()
    }
  }, [scrollToBottom])

  // 合并最终字幕和中间结果
  const displayItems = [...subtitles]
  if (interimResult) {
    displayItems.push(interimResult)
  }

  const isEmpty = displayItems.length === 0

  return (
    <div className={`subtitle-window ${isDragging ? 'dragging' : ''}`}>
      {/* 拖拽区域 */}
      <div
        className="drag-handle"
        title="拖拽移动字幕位置"
        onMouseDown={handleDragStart}
      />

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
            {item.isFinal && item.translated ? (
              <div className="subtitle-translated">{item.translated}</div>
            ) : item.isFinal && !item.translated ? (
              <div className="subtitle-translated translating">翻译中...</div>
            ) : item.translated ? (
              <div className="subtitle-translated">{item.translated}</div>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  )
}
