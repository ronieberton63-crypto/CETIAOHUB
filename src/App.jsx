// src/App.jsx
import React from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import Sidebar from './components/Sidebar.jsx';
import Topbar from './components/Topbar.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Logistica from './pages/Logistica.jsx';
import PDFHub from './pages/PDFHub.jsx';
import Diario from './pages/Diario.jsx';
import PageTransition from './components/PageTransition.jsx';
import { DBProvider } from './context/DBContext.jsx';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import './styles/theme.scss';

const AnimatedRoutes = () => {
  const location = useLocation();
  
  return (
    <AnimatePresence mode="wait">
      <Routes location={location} key={location.pathname}>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<PageTransition><Dashboard /></PageTransition>} />
        <Route path="/logistica" element={<PageTransition><Logistica /></PageTransition>} />
        <Route path="/pdfhub" element={<PageTransition><PDFHub /></PageTransition>} />
        <Route path="/diario" element={<PageTransition><Diario /></PageTransition>} />
      </Routes>
    </AnimatePresence>
  );
};

const App = () => {
  React.useEffect(() => {
    if (window.electronAPI) {
      window.electronAPI.onUpdateAvailable(() => {
        toast.info('🚀 Nova atualização encontrada! Baixando em segundo plano...', { autoClose: false, toastId: 'update-avail' });
      });
      window.electronAPI.onUpdateDownloaded(() => {
        toast.success('Atualização baixada! O aplicativo será reiniciado em 5 segundos.', { autoClose: 5000, toastId: 'update-down' });
        setTimeout(() => {
          window.electronAPI.restartApp();
        }, 5000);
      });
      window.electronAPI.onUpdateError((err) => {
        console.error('Update erro:', err);
      });
    }
  }, []);

  return (
    <DBProvider>
      <div className="app-container" style={{ display: 'flex', height: '100vh', width: '100vw', overflow: 'hidden', background: 'var(--bg-color)' }}>
        <Sidebar />
        <div style={{ flexGrow: 1, display: 'flex', flexDirection: 'column', position: 'relative' }}>
          {/* Decorative background glow */}
          <div style={{ position: 'absolute', top: '-10%', left: '-10%', width: '50%', height: '50%', background: 'radial-gradient(circle, rgba(59,130,246,0.1) 0%, transparent 70%)', zIndex: 0, pointerEvents: 'none' }} />
          <div style={{ position: 'absolute', bottom: '-10%', right: '-10%', width: '50%', height: '50%', background: 'radial-gradient(circle, rgba(139,92,246,0.1) 0%, transparent 70%)', zIndex: 0, pointerEvents: 'none' }} />
          
          <Topbar />
          <div style={{ flexGrow: 1, overflowY: 'auto', padding: '2rem 3rem', zIndex: 1, position: 'relative' }}>
            <AnimatedRoutes />
          </div>
        </div>
        <ToastContainer 
          position="top-right" 
          autoClose={3000} 
          hideProgressBar={false} 
          newestOnTop 
          closeOnClick 
          theme="dark"
          toastStyle={{ 
            background: 'rgba(30, 41, 59, 0.9)', 
            backdropFilter: 'blur(10px)', 
            border: '1px solid rgba(255,255,255,0.1)',
            color: '#f8fafc'
          }} 
        />
      </div>
    </DBProvider>
  );
};

export default App;
