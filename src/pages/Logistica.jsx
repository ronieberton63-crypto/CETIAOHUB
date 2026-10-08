// src/pages/Logistica.jsx
import React, { useContext, useEffect, useState } from 'react';
import { DBContext } from '../context/DBContext.jsx';
import { toast } from 'react-toastify';
import { Plus, ArrowUpRight, ArrowDownLeft, Trash2, Package, AlertTriangle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const CATEGORIAS = [
  { value: 'uso_livre', label: 'Uso Livre (giz, papel, etc.)' },
  { value: 'restrito', label: 'Equipamento Restrito (HDMI, Datashow, Chave)' },
];

const Logistica = () => {
  const { db } = useContext(DBContext);
  const [items, setItems] = useState([]);
  const [form, setForm] = useState({ nome: '', categoria: 'uso_livre', quantidade: 1 });
  const [saidaForm, setSaidaForm] = useState({ itemId: '', responsavel: '', quantidadeSaida: 1 });
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
        quantidadeDisponivel: Number(form.quantidade) || 1,
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

    const qtdSaida = Number(saidaForm.quantidadeSaida) || 1;
    const disponivel = item.quantidadeDisponivel ?? item.quantidade;

    if (qtdSaida > disponivel) {
      toast.error(`Quantidade indisponível! Só restam ${disponivel} unidade(s) de "${item.nome}".`);
      return;
    }
    if (item.categoria === 'restrito' && !saidaForm.responsavel.trim()) {
      toast.error('Informe o responsável para itens restritos');
      return;
    }

    try {
      const novaQtdDisponivel = disponivel - qtdSaida;
      await db.put({
        ...item,
        quantidadeDisponivel: novaQtdDisponivel,
        status: novaQtdDisponivel === 0 ? 'emprestado' : 'parcial',
        responsavel: saidaForm.responsavel.trim() || 'N/A',
      });
      await db.post({
        type: 'movement',
        itemId: item._id,
        itemNome: item.nome,
        direction: 'saida',
        quantidade: qtdSaida,
        responsavel: saidaForm.responsavel.trim() || 'N/A',
        date: new Date().toISOString(),
      });
      toast.success(`Saída de ${qtdSaida}x ${item.nome} registrada!`);
      setSaidaForm({ itemId: '', responsavel: '', quantidadeSaida: 1 });
    } catch (err) {
      toast.error('Erro ao registrar saída');
    }
  };

  const handleDevolucao = async (item) => {
    try {
      await db.put({
        ...item,
        quantidadeDisponivel: item.quantidade,
        status: 'disponivel',
        responsavel: '',
      });
      await db.post({
        type: 'movement',
        itemId: item._id,
        itemNome: item.nome,
        direction: 'devolucao',
        quantidade: item.quantidade - (item.quantidadeDisponivel ?? 0),
        responsavel: item.responsavel,
        date: new Date().toISOString(),
      });
      toast.success(`Devolvido: ${item.nome} (estoque completo)`);
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
  const selectedDisponivel = selectedItem ? (selectedItem.quantidadeDisponivel ?? selectedItem.quantidade) : 0;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h1 className="page-title" style={{ marginBottom: 0 }}>Controle Logístico</h1>
        <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} className="btn-primary" onClick={() => setShowCadastro(!showCadastro)}>
          <Plus size={16} /> Cadastrar Item
        </motion.button>
      </div>

      {/* Formulário de cadastro */}
      <AnimatePresence>
        {showCadastro && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="card" style={{ marginBottom: '1rem' }}>
            <h3 style={{ marginBottom: '0.75rem', color: 'var(--text-primary)' }}>Novo Item</h3>
            <form onSubmit={handleCadastro} style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
              <div style={{ flex: 2, minWidth: 200 }}>
                <label>Nome</label>
                <input className="form-input" value={form.nome} onChange={e => setForm({ ...form, nome: e.target.value })} placeholder="Ex: Cabo HDMI" />
              </div>
              <div style={{ flex: 1, minWidth: 180 }}>
                <label>Categoria</label>
                <select className="form-input" value={form.categoria} onChange={e => setForm({ ...form, categoria: e.target.value })}>
                  {CATEGORIAS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>
              </div>
              <div style={{ flex: 0, minWidth: 80 }}>
                <label>Qtd Total</label>
                <input className="form-input" type="number" min="1" value={form.quantidade} onChange={e => setForm({ ...form, quantidade: e.target.value })} />
              </div>
              <button className="btn-success" type="submit">Salvar</button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Painel de Saída */}
      <div className="card" style={{ marginBottom: '1rem' }}>
        <h3 style={{ marginBottom: '0.75rem', color: 'var(--text-primary)' }}>Registrar Saída</h3>
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div style={{ flex: 2, minWidth: 200 }}>
            <label>Item</label>
            <select className="form-input" value={saidaForm.itemId} onChange={e => setSaidaForm({ ...saidaForm, itemId: e.target.value, quantidadeSaida: 1 })}>
              <option value="">Selecione...</option>
              {items.filter(i => (i.quantidadeDisponivel ?? i.quantidade) > 0).map(i => (
                <option key={i._id} value={i._id}>
                  {i.nome} — {i.quantidadeDisponivel ?? i.quantidade}/{i.quantidade} disponíveis
                </option>
              ))}
            </select>
          </div>
          {selectedItem && (
            <div style={{ flex: 0, minWidth: 120 }}>
              <label>Quantidade</label>
              <input
                className="form-input"
                type="number"
                min="1"
                max={selectedDisponivel}
                value={saidaForm.quantidadeSaida}
                onChange={e => setSaidaForm({ ...saidaForm, quantidadeSaida: e.target.value })}
              />
              <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                Máx: {selectedDisponivel}
              </span>
            </div>
          )}
          {selectedItem && selectedItem.categoria === 'restrito' && (
            <div style={{ flex: 1, minWidth: 200 }}>
              <label>Responsável *</label>
              <input className="form-input" value={saidaForm.responsavel} onChange={e => setSaidaForm({ ...saidaForm, responsavel: e.target.value })} placeholder="Ex: Prof. Marcos" />
            </div>
          )}
          <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} className="btn-primary" onClick={handleSaida}>
            <ArrowUpRight size={16} /> Registrar Saída
          </motion.button>
        </div>
      </div>

      {/* Lista de Itens */}
      <div className="card">
        <h3 style={{ marginBottom: '0.75rem', color: 'var(--text-primary)' }}>Inventário</h3>
        {items.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '3rem' }}>
            <Package size={48} style={{ color: 'var(--text-secondary)', marginBottom: '1rem' }} />
            <p style={{ color: 'var(--text-secondary)' }}>Nenhum item cadastrado ainda.</p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid rgba(255,255,255,0.1)', textAlign: 'left' }}>
                  <th style={{ padding: '0.6rem' }}>Item</th>
                  <th style={{ padding: '0.6rem' }}>Categoria</th>
                  <th style={{ padding: '0.6rem' }}>Estoque</th>
                  <th style={{ padding: '0.6rem' }}>Status</th>
                  <th style={{ padding: '0.6rem' }}>Responsável</th>
                  <th style={{ padding: '0.6rem' }}>Ações</th>
                </tr>
              </thead>
              <tbody>
                <AnimatePresence>
                  {items.map(item => {
                    const disponivel = item.quantidadeDisponivel ?? item.quantidade;
                    const statusLabel = disponivel === 0
                      ? 'Esgotado'
                      : disponivel < item.quantidade
                        ? 'Parcial'
                        : 'Disponível';
                    const statusClass = disponivel === 0
                      ? 'badge-red'
                      : disponivel < item.quantidade
                        ? 'badge-amber'
                        : 'badge-green';

                    return (
                      <motion.tr
                        key={item._id}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}
                      >
                        <td style={{ padding: '0.6rem', fontWeight: 600 }}>{item.nome}</td>
                        <td style={{ padding: '0.6rem' }}>
                          <span className={`badge ${item.categoria === 'restrito' ? 'badge-amber' : 'badge-blue'}`}>
                            {item.categoria === 'restrito' ? 'Restrito' : 'Uso Livre'}
                          </span>
                        </td>
                        <td style={{ padding: '0.6rem' }}>
                          <span style={{ fontWeight: 700, color: disponivel === 0 ? '#ef4444' : 'var(--text-primary)' }}>
                            {disponivel}
                          </span>
                          <span style={{ color: 'var(--text-secondary)' }}> / {item.quantidade}</span>
                        </td>
                        <td style={{ padding: '0.6rem' }}>
                          <span className={`badge ${statusClass}`}>
                            {disponivel === 0 && <AlertTriangle size={12} style={{ marginRight: 4 }} />}
                            {statusLabel}
                          </span>
                        </td>
                        <td style={{ padding: '0.6rem' }}>{item.responsavel || '—'}</td>
                        <td style={{ padding: '0.6rem', display: 'flex', gap: '0.5rem' }}>
                          {disponivel < item.quantidade && (
                            <motion.button whileTap={{ scale: 0.95 }} className="btn-success" style={{ padding: '0.3rem 0.6rem', fontSize: '0.8rem' }} onClick={() => handleDevolucao(item)}>
                              <ArrowDownLeft size={14} /> Devolver Tudo
                            </motion.button>
                          )}
                          <motion.button whileTap={{ scale: 0.95 }} className="btn-danger" style={{ padding: '0.3rem 0.6rem', fontSize: '0.8rem' }} onClick={() => handleDelete(item)}>
                            <Trash2 size={14} />
                          </motion.button>
                        </td>
                      </motion.tr>
                    );
                  })}
                </AnimatePresence>
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default Logistica;
