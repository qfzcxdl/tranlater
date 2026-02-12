// 字幕窗口入口文件

import React from 'react';
import ReactDOM from 'react-dom/client';
import { SubtitleWindow } from './src/windows/subtitle/SubtitleWindow';
import './src/windows/subtitle/subtitle.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <SubtitleWindow />
  </React.StrictMode>
);
