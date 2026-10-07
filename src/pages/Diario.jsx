// src/pages/Diario.jsx
import React, { useContext, useEffect, useState } from 'react';
import { DBContext } from '../context/DBContext.jsx';
import { toast } from 'react-toastify';
import { Plus, Trash2 } from 'lucide-react';

const TIPOS = [
  { value: 'merenda', label: '🍽️ Merenda' },
  { value: 'material', label: '📦 Chegada de Material' },
  { value: 'ocorrencia', label: '⚠️ Ocorrência' },
  { value: 'geral', label: '📝 Anotação Geral' },
];

const Diario = () => {
  const { db } = useContext(DBContext);
  const [logs, setLogs] = useState([]);
  const [form, setForm] = useState({ tipo: 'geral', texto: '' });

  const fetchLogs = async () => {
    if (!db) return;
    try {
      const result = await db.allDocs({ include_docs: true });
      const allLogs = result.rows
        .map(r => r.doc)
        .filter(d => d && d.type === 'log')
        .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
      setLogs(allLogs);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchLogs();
    if (!db) return;
    const changes = db.changes({ since: 'now', live: true }).on('change', fetchLogs);
    return () => changes.cancel();
  }, [db]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.texto.trim()) { toast.error('Escreva algo antes de salvar'); return; }
    try {
      await db.post({
        type: 'log',
        tipo: form.tipo,
        texto: form.texto.trim(),
        createdAt: new Date().toISOString(),
      });
      toast.success('Registro salvo!');
      setForm({ tipo: 'geral', texto: '' });
    } catch (err) {
      toast.error('Erro ao salvar registro');
    }
  };

  const handleDelete = async (log) => {
    try {
      await db.remove(log);
      toast.info('Registro removido');
    } catch (err) {
      toast.error('Erro ao remover');
    }
  };

  const formatDate = (iso) => {
    if (!iso) return '';
    const d = new Date(iso);
    return d.toLocaleDateString('pt-BR') + ' às ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div>
      <h1 className="page-title">Diário de Bordo</h1>

      {/* Formulário */}
      <div className="card" style={{ marginBottom: '1rem' }}>
        <h3 style={{ marginBottom: '0.75rem', color: '#334155' }}>Nova Anotação</h3>
        <form onSubmit={handleSubmit} style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div style={{ minWidth: 180 }}>
            <label style={{ fontSize: '0.8rem', color: '#64748b', display: 'block', marginBottom: 4 }}>Tipo</label>
            <select className="form-input" value={form.tipo} onChange={e => setForm({ ...form, tipo: e.target.value })}>
              {TIPOS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
          <div style={{ flex: 1, minWidth: 250 }}>
            <label style={{ fontSize: '0.8rem', color: '#64748b', display: 'block', marginBottom: 4 }}>Descrição</label>
            <input className="form-input" value={form.texto} onChange={e => setForm({ ...form, texto: e.target.value })} placeholder="Ex: Merenda entregue às 10h — 200 unidades de leite." />
          </div>
          <button className="btn-primary" type="submit"><Plus size={16} /> Salvar</button>
        </form>
      </div>

      {/* Timeline */}
      <div className="card">
        <h3 style={{ marginBottom: '1rem', color: '#334155' }}>Linha do Tempo</h3>
        {logs.length === 0 ? (
          <p style={{ color: '#94a3b8', textAlign: 'center', padding: '2rem' }}>Nenhum registro ainda. Comece adicionando uma anotação acima.</p>
        ) : (
          <div className="timeline">
            {logs.map(log => {
              const tipo = TIPOS.find(t => t.value === log.tipo);
              return (
                <div className="timeline-item" key={log._id}>
                  <div className="timeline-time">{formatDate(log.createdAt)}</div>
                  <div className="timeline-content" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <span className="badge badge-gray" style={{ marginRight: '0.5rem' }}>{tipo ? tipo.label : log.tipo}</span>
                      {log.texto}
                    </div>
                    <button onClick={() => handleDelete(log)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', flexShrink: 0, marginLeft: '0.5rem' }}>
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default Diario;
