// src/pages/Logistica.jsx
import React, { useContext, useEffect, useState } from 'react';
import { DBContext } from '../context/DBContext.jsx';
import { toast } from 'react-toastify';
import { Plus, ArrowUpRight, ArrowDownLeft, Trash2 } from 'lucide-react';

const CATEGORIAS = [
  { value: 'uso_livre', label: 'Uso Livre (giz, papel, etc.)' },
  { value: 'restrito', label: 'Equipamento Restrito (HDMI, Datashow, Chave)' },
];

const Logistica = () => {
  const { db } = useContext(DBContext);
  const [items, setItems] = useState([]);
  const [form, setForm] = useState({ nome: '', categoria: 'uso_livre', quantidade: 1 });
  const [saidaForm, setSaidaForm] = useState({ itemId: '', responsavel: '' });
  const [showCadastro, setShowCadastro] = useState(false);

  const fetchItems = async () => {
    if (!db) return;
    try {
      const result = await db.allDocs({ include_docs: true });
      const allItems = result.rows
        .map(r => r.doc)
        .filter(d => d && d.type === 'item');
      setItems(allItems);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchItems();
    if (!db) return;
    const changes = db.changes({ since: 'now', live: true }).on('change', fetchItems);
    return () => changes.cancel();
  }, [db]);

  const handleCadastro = async (e) => {
    e.preventDefault();
    if (!form.nome.trim()) { toast.error('Informe o nome do item'); return; }
    try {
      await db.post({
        type: 'item',
        nome: form.nome.trim(),
        categoria: form.categoria,
        quantidade: Number(form.quantidade) || 1,
        status: 'disponivel',
        responsavel: '',
        createdAt: new Date().toISOString(),
      });
      toast.success('Item cadastrado!');
      setForm({ nome: '', categoria: 'uso_livre', quantidade: 1 });
      setShowCadastro(false);
    } catch (err) {
      toast.error('Erro ao cadastrar item');
    }
  };

  const handleSaida = async () => {
    if (!saidaForm.itemId) { toast.error('Selecione um item'); return; }
    const item = items.find(i => i._id === saidaForm.itemId);
    if (!item) return;
    if (item.categoria === 'restrito' && !saidaForm.responsavel.trim()) {
      toast.error('Informe o responsável para itens restritos');
      return;
    }
    try {
      await db.put({ ...item, status: 'emprestado', responsavel: saidaForm.responsavel.trim() || 'N/A' });
      await db.post({
        type: 'movement',
        itemId: item._id,
        itemNome: item.nome,
        direction: 'saida',
        responsavel: saidaForm.responsavel.trim() || 'N/A',
        date: new Date().toISOString(),
      });
      toast.success(`Saída registrada: ${item.nome}`);
      setSaidaForm({ itemId: '', responsavel: '' });
    } catch (err) {
      toast.error('Erro ao registrar saída');
    }
  };

  const handleDevolucao = async (item) => {
    try {
      await db.put({ ...item, status: 'disponivel', responsavel: '' });
      await db.post({
        type: 'movement',
        itemId: item._id,
        itemNome: item.nome,
        direction: 'devolucao',
        responsavel: item.responsavel,
        date: new Date().toISOString(),
      });
      toast.success(`Devolvido: ${item.nome}`);
    } catch (err) {
      toast.error('Erro na devolução');
    }
  };

  const handleDelete = async (item) => {
    try {
      await db.remove(item);
      toast.info(`Removido: ${item.nome}`);
    } catch (err) {
      toast.error('Erro ao remover');
    }
  };

  const selectedItem = items.find(i => i._id === saidaForm.itemId);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h1 className="page-title" style={{ marginBottom: 0 }}>Controle Logístico</h1>
        <button className="btn-primary" onClick={() => setShowCadastro(!showCadastro)}>
          <Plus size={16} /> Cadastrar Item
        </button>
      </div>

      {/* Formulário de cadastro */}
      {showCadastro && (
        <div className="card" style={{ marginBottom: '1rem' }}>
          <h3 style={{ marginBottom: '0.75rem', color: '#334155' }}>Novo Item</h3>
          <form onSubmit={handleCadastro} style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <div style={{ flex: 2, minWidth: 200 }}>
              <label style={{ fontSize: '0.8rem', color: '#64748b', display: 'block', marginBottom: 4 }}>Nome</label>
              <input className="form-input" value={form.nome} onChange={e => setForm({ ...form, nome: e.target.value })} placeholder="Ex: Cabo HDMI" />
            </div>
            <div style={{ flex: 1, minWidth: 180 }}>
              <label style={{ fontSize: '0.8rem', color: '#64748b', display: 'block', marginBottom: 4 }}>Categoria</label>
              <select className="form-input" value={form.categoria} onChange={e => setForm({ ...form, categoria: e.target.value })}>
                {CATEGORIAS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </div>
            <div style={{ flex: 0, minWidth: 80 }}>
              <label style={{ fontSize: '0.8rem', color: '#64748b', display: 'block', marginBottom: 4 }}>Qtd</label>
              <input className="form-input" type="number" min="1" value={form.quantidade} onChange={e => setForm({ ...form, quantidade: e.target.value })} />
            </div>
            <button className="btn-success" type="submit">Salvar</button>
          </form>
        </div>
      )}

      {/* Painel de Saída */}
      <div className="card" style={{ marginBottom: '1rem' }}>
        <h3 style={{ marginBottom: '0.75rem', color: '#334155' }}>Registrar Saída</h3>
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div style={{ flex: 2, minWidth: 200 }}>
            <label style={{ fontSize: '0.8rem', color: '#64748b', display: 'block', marginBottom: 4 }}>Item</label>
            <select className="form-input" value={saidaForm.itemId} onChange={e => setSaidaForm({ ...saidaForm, itemId: e.target.value })}>
              <option value="">Selecione...</option>
              {items.filter(i => i.status === 'disponivel').map(i => (
                <option key={i._id} value={i._id}>{i.nome} ({CATEGORIAS.find(c => c.value === i.categoria)?.label || i.categoria})</option>
              ))}
            </select>
          </div>
          {selectedItem && selectedItem.categoria === 'restrito' && (
            <div style={{ flex: 1, minWidth: 200 }}>
              <label style={{ fontSize: '0.8rem', color: '#64748b', display: 'block', marginBottom: 4 }}>Responsável *</label>
              <input className="form-input" value={saidaForm.responsavel} onChange={e => setSaidaForm({ ...saidaForm, responsavel: e.target.value })} placeholder="Ex: Prof. Marcos" />
            </div>
          )}
          <button className="btn-primary" onClick={handleSaida}><ArrowUpRight size={16} /> Registrar Saída</button>
        </div>
      </div>

      {/* Lista de Itens */}
      <div className="card">
        <h3 style={{ marginBottom: '0.75rem', color: '#334155' }}>Inventário</h3>
        {items.length === 0 ? (
          <p style={{ color: '#94a3b8', textAlign: 'center', padding: '2rem' }}>Nenhum item cadastrado ainda.</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #e2e8f0', textAlign: 'left' }}>
                  <th style={{ padding: '0.6rem' }}>Item</th>
                  <th style={{ padding: '0.6rem' }}>Categoria</th>
                  <th style={{ padding: '0.6rem' }}>Qtd</th>
                  <th style={{ padding: '0.6rem' }}>Status</th>
                  <th style={{ padding: '0.6rem' }}>Responsável</th>
                  <th style={{ padding: '0.6rem' }}>Ações</th>
                </tr>
              </thead>
              <tbody>
                {items.map(item => (
                  <tr key={item._id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '0.6rem', fontWeight: 600 }}>{item.nome}</td>
                    <td style={{ padding: '0.6rem' }}>
                      <span className={`badge ${item.categoria === 'restrito' ? 'badge-amber' : 'badge-blue'}`}>
                        {item.categoria === 'restrito' ? 'Restrito' : 'Uso Livre'}
                      </span>
                    </td>
                    <td style={{ padding: '0.6rem' }}>{item.quantidade}</td>
                    <td style={{ padding: '0.6rem' }}>
                      <span className={`badge ${item.status === 'emprestado' ? 'badge-red' : 'badge-green'}`}>
                        {item.status === 'emprestado' ? 'Emprestado' : 'Disponível'}
                      </span>
                    </td>
                    <td style={{ padding: '0.6rem' }}>{item.responsavel || '—'}</td>
                    <td style={{ padding: '0.6rem', display: 'flex', gap: '0.5rem' }}>
                      {item.status === 'emprestado' && (
                        <button className="btn-success" style={{ padding: '0.3rem 0.6rem', fontSize: '0.8rem' }} onClick={() => handleDevolucao(item)}>
                          <ArrowDownLeft size={14} /> Devolver
                        </button>
                      )}
                      <button className="btn-danger" style={{ padding: '0.3rem 0.6rem', fontSize: '0.8rem' }} onClick={() => handleDelete(item)}>
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default Logistica;
