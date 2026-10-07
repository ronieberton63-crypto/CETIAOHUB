// src/context/DBContext.jsx
import React, { createContext, useEffect, useState } from 'react';
import PouchDB from 'pouchdb';
import findPlugin from 'pouchdb-find';

PouchDB.plugin(findPlugin);

const LOCAL_DB_NAME = 'cetiao_hub_local';

export const DBContext = createContext({
  db: null,
  syncStatus: 'offline', // PouchDB sync status
  isOnline: true,        // Browser network status
  serverIp: 'localhost',
  changeServerIp: () => {},
});

export const DBProvider = ({ children }) => {
  const [db, setDb] = useState(null);
  const [syncStatus, setSyncStatus] = useState('offline');
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [serverIp, setServerIp] = useState(() => localStorage.getItem('cetiao_server_ip') || '10.32.145.97');

  const changeServerIp = (ip) => {
    localStorage.setItem('cetiao_server_ip', ip);
    setServerIp(ip);
    window.location.reload(); // Reload to re-initialize PouchDB sync with new IP
  };

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    const localDb = new PouchDB(LOCAL_DB_NAME);
    setDb(localDb);

    // URL com as credenciais do CouchDB configuradas no servidor
    const REMOTE_DB_URL = `http://CETIAO:CETIAOHUB@${serverIp}:5984/cetiao_hub_remote`;
    const remoteDb = new PouchDB(REMOTE_DB_URL);
    
    // Live synchronization with retry
    const syncHandler = localDb.sync(remoteDb, {
      live: true,
      retry: true,
    })
      .on('change', () => setSyncStatus('syncing'))
      .on('paused', () => setSyncStatus('online')) // Paused usually means "caught up and waiting"
      .on('active', () => setSyncStatus('syncing'))
      .on('error', (err) => {
        console.error('Sync error:', err);
        setSyncStatus('error');
      });

    return () => {
      syncHandler.cancel();
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [serverIp]);

  return (
    <DBContext.Provider value={{ db, syncStatus, isOnline, serverIp, changeServerIp }}>
      {children}
    </DBContext.Provider>
  );
};
