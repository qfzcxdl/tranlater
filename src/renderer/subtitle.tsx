// 字幕窗口入口

import React from 'react'
import ReactDOM from 'react-dom/client'
import { SubtitleWindow } from './src/windows/subtitle/SubtitleWindow'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <SubtitleWindow />
  </React.StrictMode>
)
