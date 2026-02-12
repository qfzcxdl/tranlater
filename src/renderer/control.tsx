// 控制面板窗口入口

import React from 'react'
import ReactDOM from 'react-dom/client'
import { ControlWindow } from './src/windows/control/ControlWindow'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ControlWindow />
  </React.StrictMode>
)
