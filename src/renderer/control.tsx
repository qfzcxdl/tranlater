// 控制窗口入口文件

import React from 'react';
import ReactDOM from 'react-dom/client';
import { ControlWindow } from './src/windows/control/ControlWindow';
import './src/windows/control/control.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ControlWindow />
  </React.StrictMode>
);
