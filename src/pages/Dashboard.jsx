// src/pages/Dashboard.jsx
import React, { useContext, useEffect, useState } from 'react';
import { DBContext } from '../context/DBContext.jsx';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Package, FileText, ClipboardList, ArrowRightLeft } from 'lucide-react';

import { motion } from 'framer-motion';

const StatCard = ({ icon, label, value, color, delay }) => (
  <motion.div 
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ delay, duration: 0.4 }}
    className="card" 
    style={{ display: 'flex', alignItems: 'center', gap: '1rem', position: 'relative', overflow: 'hidden' }}
  >
    <div style={{ position: 'absolute', right: '-10%', top: '-20%', width: '100px', height: '100px', background: `radial-gradient(circle, ${color}20 0%, transparent 70%)`, pointerEvents: 'none' }} />
    <div style={{ width: 56, height: 56, borderRadius: '14px', backgroundColor: color + '15', display: 'flex', alignItems: 'center', justifyContent: 'center', color, border: `1px solid ${color}30` }}>
      {icon}
    </div>
    <div>
      <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 500, letterSpacing: '0.5px', textTransform: 'uppercase' }}>{label}</div>
      <div style={{ fontSize: '1.8rem', fontWeight: 700, color: 'var(--text-primary)' }}>{value}</div>
    </div>
  </motion.div>
);

const Dashboard = () => {
  const { db } = useContext(DBContext);
  const [stats, setStats] = useState({ items: 0, borrowed: 0, pdfs: 0, logs: 0 });
  const [chartData, setChartData] = useState([]);

  useEffect(() => {
    if (!db) return;

    const fetchStats = async () => {
      try {
        const allDocs = await db.allDocs({ include_docs: true });
        const docs = allDocs.rows.map(r => r.doc).filter(d => d && !d._id.startsWith('_'));

        const items = docs.filter(d => d.type === 'item');
        const borrowed = items.filter(d => d.status === 'emprestado');
        const pdfs = docs.filter(d => d.type === 'pdf_usage');
        const logs = docs.filter(d => d.type === 'log');

        setStats({
          items: items.length,
          borrowed: borrowed.length,
          pdfs: pdfs.length,
          logs: logs.length,
        });

        // Build chart data from last 7 days
        const now = new Date();
        const days = [];
        for (let i = 6; i >= 0; i--) {
          const d = new Date(now);
          d.setDate(d.getDate() - i);
          const key = d.toISOString().slice(0, 10);
          const label = d.toLocaleDateString('pt-BR', { weekday: 'short' });
          const saidas = docs.filter(doc => doc.type === 'movement' && doc.direction === 'saida' && doc.date && doc.date.startsWith(key)).length;
          const devolucoes = docs.filter(doc => doc.type === 'movement' && doc.direction === 'devolucao' && doc.date && doc.date.startsWith(key)).length;
          days.push({ name: label, Saídas: saidas, Devoluções: devolucoes });
        }
        setChartData(days);
      } catch (err) {
        console.error('Dashboard fetch error:', err);
      }
    };

    fetchStats();
    const changes = db.changes({ since: 'now', live: true }).on('change', fetchStats);
    return () => changes.cancel();
  }, [db]);

  return (
    <div>
      <h1 className="page-title">Dashboard</h1>
      <div className="grid-4" style={{ marginBottom: '2rem' }}>
        <StatCard icon={<Package size={24} />} label="Total de Itens" value={stats.items} color="#3b82f6" delay={0.1} />
        <StatCard icon={<ArrowRightLeft size={24} />} label="Itens Emprestados" value={stats.borrowed} color="#f59e0b" delay={0.2} />
        <StatCard icon={<FileText size={24} />} label="PDFs Gerados" value={stats.pdfs} color="#10b981" delay={0.3} />
        <StatCard icon={<ClipboardList size={24} />} label="Registros no Diário" value={stats.logs} color="#8b5cf6" delay={0.4} />
      </div>

      <motion.div 
        className="card"
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.5, duration: 0.5 }}
      >
        <h3 style={{ marginBottom: '1.5rem', color: 'var(--text-primary)', fontWeight: 600 }}>Movimentação dos Últimos 7 Dias</h3>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
            <XAxis dataKey="name" tick={{ fill: '#64748b', fontSize: 12 }} />
            <YAxis allowDecimals={false} tick={{ fill: '#64748b', fontSize: 12 }} />
            <Tooltip cursor={{ fill: 'rgba(255,255,255,0.05)' }} contentStyle={{ borderRadius: 12, backgroundColor: 'rgba(30,41,59,0.9)', border: '1px solid rgba(255,255,255,0.1)', color: '#f8fafc', boxShadow: '0 4px 20px rgba(0,0,0,0.5)' }} />
            <Bar dataKey="Saídas" fill="#3b82f6" radius={[4, 4, 0, 0]} />
            <Bar dataKey="Devoluções" fill="#10b981" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </motion.div>
    </div>
  );
};

export default Dashboard;
