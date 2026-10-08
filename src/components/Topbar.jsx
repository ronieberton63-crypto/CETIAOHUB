// src/components/Topbar.jsx
import React, { useContext, useEffect, useState } from 'react';
import { DBContext } from '../context/DBContext.jsx';
import { Clock, Wifi, WifiOff, RefreshCw, Settings, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const Topbar = () => {
  const { syncStatus, isOnline, serverIp, changeServerIp } = useContext(DBContext);
  const [time, setTime] = useState(new Date());
  const [showSettings, setShowSettings] = useState(false);
  const [ipInput, setIpInput] = useState(serverIp);

  useEffect(() => {
    const interval = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  const handleSaveIp = (e) => {
    e.preventDefault();
    changeServerIp(ipInput.trim() || 'localhost');
    setShowSettings(false);
  };

  const formattedTime = time.toLocaleTimeString('pt-BR', { hour12: false });

  // Compute status details
  let statusColor = '#ef4444'; // Red
  let statusText = 'OFFLINE';
  let Icon = WifiOff;

  if (isOnline) {
    if (syncStatus === 'syncing') {
      statusColor = '#3b82f6'; // Blue
      statusText = 'SINCRONIZANDO';
      Icon = RefreshCw;
    } else if (syncStatus === 'online') {
      statusColor = '#10b981'; // Green
      statusText = 'ONLINE & SINCRONIZADO';
      Icon = Wifi;
    } else {
      statusColor = '#f59e0b'; // Amber
      statusText = 'TENTANDO RECONECTAR';
      Icon = RefreshCw;
    }
  }

  return (
    <>
      <header style={{ 
        height: '60px', 
        background: 'rgba(30, 41, 59, 0.4)', 
        backdropFilter: 'blur(10px)',
        borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'space-between', 
        padding: '0 2rem',
        zIndex: 10
      }}>
        <div style={{ display: 'flex', alignItems: 'center', color: '#94a3b8', fontWeight: 500 }}>
          <Clock size={18} style={{ marginRight: '0.75rem', color: '#3b82f6' }} />
          <span style={{ letterSpacing: '1px' }}>{formattedTime}</span>
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <motion.div 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            style={{ 
              display: 'flex', 
              alignItems: 'center', 
              background: 'rgba(15, 23, 42, 0.6)',
              padding: '0.4rem 1rem',
              borderRadius: '999px',
              border: '1px solid rgba(255, 255, 255, 0.05)'
            }}
          >
            <AnimatePresence mode="wait">
              <motion.div
                key={statusText}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                style={{ display: 'flex', alignItems: 'center' }}
              >
                <motion.div
                  animate={syncStatus === 'syncing' || !isOnline && syncStatus !== 'offline' ? { rotate: 360 } : {}}
                  transition={{ repeat: Infinity, duration: 1.5, ease: "linear" }}
                >
                  <Icon size={16} color={statusColor} style={{ marginRight: '0.5rem' }} />
                </motion.div>
                <span style={{ 
                  color: statusColor, 
                  fontSize: '0.75rem', 
                  fontWeight: 700, 
                  letterSpacing: '0.5px' 
                }}>
                  {statusText}
                </span>
              </motion.div>
            </AnimatePresence>
          </motion.div>

          <motion.button 
            whileHover={{ scale: 1.1, rotate: 90 }}
            whileTap={{ scale: 0.9 }}
            onClick={() => setShowSettings(true)}
            style={{ 
              background: 'transparent', 
              border: 'none', 
              color: '#94a3b8', 
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center'
            }}
          >
            <Settings size={20} />
          </motion.button>
        </div>
      </header>

      {/* Settings Modal */}
      <AnimatePresence>
        {showSettings && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{
              position: 'fixed',
              top: 0, left: 0, right: 0, bottom: 0,
              background: 'rgba(15, 23, 42, 0.8)',
              backdropFilter: 'blur(4px)',
              zIndex: 100,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="card"
              style={{ width: '400px', position: 'relative' }}
            >
              <button 
                onClick={() => setShowSettings(false)}
                style={{ position: 'absolute', top: '1rem', right: '1rem', background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer' }}
              >
                <X size={20} />
              </button>
              
              <h3 style={{ marginBottom: '0.5rem', color: '#f8fafc' }}>Configuração de Rede</h3>
              <p style={{ fontSize: '0.85rem', color: '#94a3b8', marginBottom: '1.5rem' }}>
                Para sincronizar com outros computadores, digite o IP do Servidor (ex: 192.168.1.100).
              </p>

              <form onSubmit={handleSaveIp}>
                <div style={{ marginBottom: '1.5rem' }}>
                  <label>IP do Servidor CouchDB</label>
                  <input 
                    className="form-input" 
                    value={ipInput}
                    onChange={(e) => setIpInput(e.target.value)}
                    placeholder="localhost ou 192.168.X.X"
                    autoFocus
                  />
                </div>
                
                <div style={{ marginBottom: '1.5rem', padding: '1rem', background: 'rgba(255,255,255,0.02)', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
                  <h4 style={{ color: '#f8fafc', marginBottom: '0.5rem', fontSize: '0.9rem' }}>Atualizações do Sistema</h4>
                  <p style={{ fontSize: '0.8rem', color: '#94a3b8', marginBottom: '0.75rem' }}>
                    Verifique se há novas funcionalidades e melhorias disponíveis.
                  </p>
                  <button 
                    type="button" 
                    className="btn-primary" 
                    style={{ width: '100%', justifyContent: 'center' }}
                    onClick={() => {
                      if (window.electronAPI) {
                        window.electronAPI.checkUpdates();
                        toast.info('Verificando atualizações...', { autoClose: 2000 });
                      } else {
                        toast.error('Indisponível no modo de desenvolvimento.');
                      }
                    }}
                  >
                    Verificar Atualizações
                  </button>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                  <button type="button" className="btn-secondary" style={{ background: 'transparent', color: '#94a3b8' }} onClick={() => setShowSettings(false)}>
                    Cancelar
                  </button>
                  <button type="submit" className="btn-primary">
                    Salvar e Reiniciar
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default Topbar;
