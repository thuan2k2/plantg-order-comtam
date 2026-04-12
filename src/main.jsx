import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';

// Import file CSS chứa cấu hình Tailwind
import './index.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);