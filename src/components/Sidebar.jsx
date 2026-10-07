// src/components/Sidebar.jsx
import React from 'react';
import { NavLink } from 'react-router-dom';
import { LayoutDashboard, Boxes, FileText, CalendarCheck, Shield } from 'lucide-react';
import { motion } from 'framer-motion';

const links = [
  { to: '/dashboard', label: 'Dashboard', icon: <LayoutDashboard size={20} /> },
  { to: '/logistica', label: 'Logística', icon: <Boxes size={20} /> },
  { to: '/pdfhub', label: 'PDF Hub', icon: <FileText size={20} /> },
  { to: '/diario', label: 'Diário de Bordo', icon: <CalendarCheck size={20} /> },
];

const Sidebar = () => {
  return (
    <nav style={{ 
      width: '260px', 
      background: 'rgba(15, 23, 42, 0.7)', 
      backdropFilter: 'blur(10px)',
      borderRight: '1px solid rgba(255, 255, 255, 0.05)',
      display: 'flex', 
      flexDirection: 'column', 
      paddingTop: '2rem',
      zIndex: 20
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '3rem' }}>
        <div style={{ 
          background: 'linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%)',
          padding: '0.5rem',
          borderRadius: '12px',
          marginRight: '0.75rem',
          boxShadow: '0 0 15px rgba(59, 130, 246, 0.5)'
        }}>
          <Shield size={24} color="#fff" />
        </div>
        <h2 style={{ 
          fontSize: '1.4rem', 
          fontWeight: 700, 
          background: 'linear-gradient(to right, #fff, #94a3b8)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          margin: 0
        }}>
          CETIAO Hub
        </h2>
      </div>

      <div style={{ padding: '0 1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        {links.map((link) => (
          <NavLink
            key={link.to}
            to={link.to}
            style={{ textDecoration: 'none' }}
          >
            {({ isActive }) => (
              <motion.div
                whileHover={{ scale: 1.02, x: 5 }}
                whileTap={{ scale: 0.98 }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  padding: '1rem 1.2rem',
                  borderRadius: '12px',
                  color: isActive ? '#fff' : '#94a3b8',
                  background: isActive ? 'rgba(59, 130, 246, 0.15)' : 'transparent',
                  border: isActive ? '1px solid rgba(59, 130, 246, 0.3)' : '1px solid transparent',
                  position: 'relative',
                  overflow: 'hidden'
                }}
              >
                {isActive && (
                  <motion.div
                    layoutId="sidebar-active"
                    style={{
                      position: 'absolute',
                      left: 0,
                      top: 0,
                      bottom: 0,
                      width: '4px',
                      background: '#3b82f6',
                      boxShadow: '0 0 10px rgba(59,130,246,0.8)'
                    }}
                  />
                )}
                <span style={{ 
                  marginRight: '1rem', 
                  color: isActive ? '#3b82f6' : '#64748b',
                  display: 'flex',
                  alignItems: 'center'
                }}>
                  {link.icon}
                </span>
                <span style={{ fontWeight: isActive ? 600 : 500, letterSpacing: '0.3px' }}>
                  {link.label}
                </span>
              </motion.div>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  );
};

export default Sidebar;
