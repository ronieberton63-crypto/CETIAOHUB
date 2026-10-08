// src/pages/Logistica.jsx
import React, { useContext, useEffect, useState, useRef } from 'react';
import { DBContext } from '../context/DBContext.jsx';
import { toast } from 'react-toastify';
import { Plus, ArrowUpRight, ArrowDownLeft, Trash2, Package, AlertTriangle, Search, Filter, Download, Camera, History, List } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import jsPDF from 'jspdf';
import 'jspdf-autotable';

const Logistica = () => {
  const { db } = useContext(DBContext);
  const [activeTab, setActiveTab] = useState('inventory'); // 'inventory' | 'history'
  const [items, setItems] = useState([]);
  const [movements, setMovements] = useState([]);
  const [categorias, setCategorias] = useState([
    { value: 'uso_livre', label: 'Uso Livre' },
    { value: 'restrito', label: 'Equipamento Restrito' },
  ]);
  
  // States do Formulário
  const [form, setForm] = useState({ nome: '', categoria: 'uso_livre', quantidade: 1, limiteAlerta: 0, foto: null });
  const [novaCategoria, setNovaCategoria] = useState('');
  
  // States de Saída
  const [saidaForm, setSaidaForm] = useState({ itemId: '', responsavel: '', quantidadeSaida: 1 });
  
  // States da Tela
  const [showCadastro, setShowCadastro] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategoria, setFilterCategoria] = useState('');

  const fileInputRef = useRef(null);

  const fetchData = async () => {
    if (!db) return;
    try {
      const result = await db.allDocs({ include_docs: true });
      const docs = result.rows.map(r => r.doc).filter(d => d);
      
      const allItems = docs.filter(d => d.type === 'item');
      setItems(allItems);

      const allMovements = docs.filter(d => d.type === 'movement').sort((a, b) => b.date.localeCompare(a.date));
      setMovements(allMovements);

      // Checar notificações de estoque baixo
      const lowStockItems = allItems.filter(i => (i.quantidadeDisponivel ?? i.quantidade) <= (i.limiteAlerta || 0));
      if (lowStockItems.length > 0 && !window.hasAlertedLowStock) {
        toast.warning(`${lowStockItems.length} item(ns) estão com estoque baixo!`, { autoClose: 5000 });
        window.hasAlertedLowStock = true;
      }

      const cats = docs.filter(d => d.type === 'categoria_logistica');
      if (cats.length > 0) {
        setCategorias([
          { value: 'uso_livre', label: 'Uso Livre' },
          { value: 'restrito', label: 'Equipamento Restrito' },
          ...cats.map(c => ({ value: c.value, label: c.label }))
        ]);
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchData();
    if (!db) return;
    const changes = db.changes({ since: 'now', live: true }).on('change', fetchData);
    return () => changes.cancel();
  }, [db]);

  const resizeImage = (file) => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const MAX_WIDTH = 200;
          const scaleSize = MAX_WIDTH / img.width;
          canvas.width = MAX_WIDTH;
          canvas.height = img.height * scaleSize;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          resolve(canvas.toDataURL('image/jpeg', 0.8));
        };
        img.src = e.target.result;
      };
      reader.readAsDataURL(file);
    });
  };

  const handleFileChange = async (e) => {
    if (e.target.files && e.target.files[0]) {
      const resizedBase64 = await resizeImage(e.target.files[0]);
      setForm({ ...form, foto: resizedBase64 });
    }
  };

  const handleAdicionarCategoria = async () => {
    if (!novaCategoria.trim()) return;
    const val = novaCategoria.trim().toLowerCase().replace(/[^a-z0-9]/g, '_');
    try {
      await db.post({
        type: 'categoria_logistica',
        value: val,
        label: novaCategoria.trim()
      });
      setForm({ ...form, categoria: val });
      setNovaCategoria('');
      toast.success('Categoria adicionada!');
    } catch (err) {
      toast.error('Erro ao adicionar categoria');
    }
  };

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
        limiteAlerta: Number(form.limiteAlerta) || 0,
        foto: form.foto,
        status: 'disponivel',
        responsavel: '',
        createdAt: new Date().toISOString(),
      });
      toast.success('Item cadastrado!');
      setForm({ nome: '', categoria: 'uso_livre', quantidade: 1, limiteAlerta: 0, foto: null });
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
      toast.error(`Só restam ${disponivel} unidade(s)!`);
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
      toast.success(`Saída registrada!`);
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
      toast.success(`Devolvido com sucesso`);
    } catch (err) {
      toast.error('Erro na devolução');
    }
  };

  const handleDelete = async (item) => {
    try {
      await db.remove(item);
      toast.info(`Item removido`);
    } catch (err) {
      toast.error('Erro ao remover');
    }
  };

  const exportPDF = () => {
    const doc = new jsPDF();
    doc.text('Relatório de Inventário - Logística', 14, 15);
    
    const tableData = filteredItems.map(i => [
      i.nome,
      categorias.find(c => c.value === i.categoria)?.label || i.categoria,
      `${i.quantidadeDisponivel ?? i.quantidade} / ${i.quantidade}`,
      (i.quantidadeDisponivel ?? i.quantidade) <= (i.limiteAlerta || 0) ? 'BAIXO ESTOQUE' : 'OK',
      i.responsavel || '-'
    ]);

    doc.autoTable({
      startY: 25,
      head: [['Item', 'Categoria', 'Estoque', 'Status Alerta', 'Responsável']],
      body: tableData,
    });
    
    doc.save(`inventario-${new Date().toISOString().split('T')[0]}.pdf`);
    toast.success('Relatório em PDF gerado!');
  };

  const selectedItem = items.find(i => i._id === saidaForm.itemId);
  const selectedDisponivel = selectedItem ? (selectedItem.quantidadeDisponivel ?? selectedItem.quantidade) : 0;

  const filteredItems = items.filter(i => {
    const matchSearch = i.nome.toLowerCase().includes(searchTerm.toLowerCase());
    const matchCat = filterCategoria ? i.categoria === filterCategoria : true;
    return matchSearch && matchCat;
  });

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '1rem' }}>
        <h1 className="page-title" style={{ marginBottom: 0 }}>Controle Logístico</h1>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} className="btn-secondary" onClick={exportPDF}>
            <Download size={16} /> Relatório PDF
          </motion.button>
        </div>
      </div>

      <div className="tabs" style={{ marginBottom: '1rem' }}>
        <button className={`tab ${activeTab === 'inventory' ? 'active' : ''}`} onClick={() => setActiveTab('inventory')}>
          <List size={16} style={{ marginRight: 6 }} /> Inventário
        </button>
        <button className={`tab ${activeTab === 'history' ? 'active' : ''}`} onClick={() => setActiveTab('history')}>
          <History size={16} style={{ marginRight: 6 }} /> Histórico de Movimentações
        </button>
      </div>

      {activeTab === 'inventory' && (
        <>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '1rem' }}>
            <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} className="btn-primary" onClick={() => setShowCadastro(!showCadastro)}>
              <Plus size={16} /> Cadastrar Novo Item
            </motion.button>
          </div>

          {/* Formulário de cadastro */}
          <AnimatePresence>
            {showCadastro && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="card" style={{ marginBottom: '1rem', overflow: 'hidden' }}>
                <h3 style={{ marginBottom: '0.75rem', color: 'var(--text-primary)' }}>Novo Item</h3>
                <form onSubmit={handleCadastro} style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'flex-start' }}>
                  
                  <div style={{ flex: 2, minWidth: 200 }}>
                    <label>Nome do Item</label>
                    <input className="form-input" value={form.nome} onChange={e => setForm({ ...form, nome: e.target.value })} placeholder="Ex: Cabo HDMI, Giz..." required />
                  </div>

                  <div style={{ flex: 1, minWidth: 180 }}>
                    <label>Categoria</label>
                    <select className="form-input" value={form.categoria} onChange={e => setForm({ ...form, categoria: e.target.value })}>
                      {categorias.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                    </select>
                    <div style={{ display: 'flex', gap: '0.25rem', marginTop: '0.5rem' }}>
                      <input className="form-input" style={{ padding: '0.2rem 0.5rem', fontSize: '0.8rem' }} placeholder="Nova categoria..." value={novaCategoria} onChange={e => setNovaCategoria(e.target.value)} />
                      <button type="button" className="btn-secondary" style={{ padding: '0.2rem 0.5rem' }} onClick={handleAdicionarCategoria}><Plus size={14}/></button>
                    </div>
                  </div>

                  <div style={{ flex: 0, minWidth: 80 }}>
                    <label>Qtd Total</label>
                    <input className="form-input" type="number" min="1" value={form.quantidade} onChange={e => setForm({ ...form, quantidade: e.target.value })} />
                  </div>

                  <div style={{ flex: 0, minWidth: 100 }}>
                    <label>Alerta Baixa</label>
                    <input className="form-input" type="number" min="0" value={form.limiteAlerta} onChange={e => setForm({ ...form, limiteAlerta: e.target.value })} placeholder="Ex: 5" />
                  </div>

                  <div style={{ flex: 1, minWidth: 150 }}>
                    <label>Foto (Opcional)</label>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <button type="button" className="btn-secondary" onClick={() => fileInputRef.current.click()}>
                        <Camera size={16} /> Tirar/Escolher
                      </button>
                      {form.foto && <img src={form.foto} alt="Preview" style={{ width: 32, height: 32, borderRadius: 4, objectFit: 'cover' }} />}
                    </div>
                    <input type="file" accept="image/*" capture="environment" ref={fileInputRef} style={{ display: 'none' }} onChange={handleFileChange} />
                  </div>

                  <div style={{ width: '100%', display: 'flex', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
                    <button className="btn-success" type="submit">Salvar Item</button>
                  </div>
                </form>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Painel de Saída */}
          <div className="card" style={{ marginBottom: '1rem' }}>
            <h3 style={{ marginBottom: '0.75rem', color: 'var(--text-primary)' }}>Registrar Saída / Empréstimo</h3>
            <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
              <div style={{ flex: 2, minWidth: 200 }}>
                <label>Item</label>
                <select className="form-input" value={saidaForm.itemId} onChange={e => setSaidaForm({ ...saidaForm, itemId: e.target.value, quantidadeSaida: 1 })}>
                  <option value="">Selecione...</option>
                  {items.filter(i => (i.quantidadeDisponivel ?? i.quantidade) > 0).map(i => (
                    <option key={i._id} value={i._id}>
                      {i.nome} — {i.quantidadeDisponivel ?? i.quantidade}/{i.quantidade} disp.
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
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Máx: {selectedDisponivel}</span>
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

          {/* Barra de Busca e Filtros */}
          <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: 200, position: 'relative' }}>
              <Search size={16} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
              <input className="form-input" style={{ paddingLeft: '2.5rem' }} placeholder="Buscar itens..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
            </div>
            <div style={{ flex: 0, minWidth: 200, position: 'relative' }}>
              <Filter size={16} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
              <select className="form-input" style={{ paddingLeft: '2.5rem' }} value={filterCategoria} onChange={(e) => setFilterCategoria(e.target.value)}>
                <option value="">Todas as Categorias</option>
                {categorias.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </div>
          </div>

          {/* Lista de Itens */}
          <div className="card">
            {filteredItems.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '3rem' }}>
                <Package size={48} style={{ color: 'var(--text-secondary)', marginBottom: '1rem' }} />
                <p style={{ color: 'var(--text-secondary)' }}>Nenhum item encontrado.</p>
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid rgba(255,255,255,0.1)', textAlign: 'left' }}>
                      <th style={{ padding: '0.6rem' }}>Foto</th>
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
                      {filteredItems.map(item => {
                        const disponivel = item.quantidadeDisponivel ?? item.quantidade;
                        const alertaBaixo = disponivel <= (item.limiteAlerta || 0);
                        
                        let statusLabel = 'Disponível';
                        let statusClass = 'badge-green';
                        
                        if (disponivel === 0) {
                          statusLabel = 'Esgotado';
                          statusClass = 'badge-red';
                        } else if (disponivel < item.quantidade) {
                          statusLabel = 'Parcial';
                          statusClass = 'badge-amber';
                        }

                        return (
                          <motion.tr
                            key={item._id}
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', backgroundColor: alertaBaixo ? 'rgba(239, 68, 68, 0.05)' : 'transparent' }}
                          >
                            <td style={{ padding: '0.6rem' }}>
                              {item.foto ? <img src={item.foto} alt="Item" style={{ width: 40, height: 40, borderRadius: 6, objectFit: 'cover' }} /> : <div style={{ width: 40, height: 40, borderRadius: 6, background: 'rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Package size={16} color="var(--text-secondary)" /></div>}
                            </td>
                            <td style={{ padding: '0.6rem', fontWeight: 600 }}>
                              {item.nome}
                              {alertaBaixo && <span style={{ marginLeft: 8, fontSize: '0.7rem', color: '#ef4444' }}><AlertTriangle size={12} style={{ verticalAlign: 'middle', marginRight: 2 }} />Baixo</span>}
                            </td>
                            <td style={{ padding: '0.6rem' }}>
                              <span className="badge badge-blue">
                                {categorias.find(c => c.value === item.categoria)?.label || item.categoria}
                              </span>
                            </td>
                            <td style={{ padding: '0.6rem' }}>
                              <span style={{ fontWeight: 700, color: alertaBaixo ? '#ef4444' : 'var(--text-primary)' }}>
                                {disponivel}
                              </span>
                              <span style={{ color: 'var(--text-secondary)' }}> / {item.quantidade}</span>
                            </td>
                            <td style={{ padding: '0.6rem' }}>
                              <span className={`badge ${statusClass}`}>
                                {statusLabel}
                              </span>
                            </td>
                            <td style={{ padding: '0.6rem' }}>{item.responsavel || '—'}</td>
                            <td style={{ padding: '0.6rem', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                              {disponivel < item.quantidade && (
                                <motion.button whileTap={{ scale: 0.95 }} className="btn-success" style={{ padding: '0.3rem 0.6rem', fontSize: '0.8rem' }} onClick={() => handleDevolucao(item)}>
                                  <ArrowDownLeft size={14} /> Devolver
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
        </>
      )}

      {/* Taba de Histórico */}
      {activeTab === 'history' && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="card">
          <h3 style={{ marginBottom: '1rem', color: 'var(--text-primary)' }}>Auditoria de Movimentações</h3>
          {movements.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '3rem' }}>
              <History size={48} style={{ color: 'var(--text-secondary)', marginBottom: '1rem' }} />
              <p style={{ color: 'var(--text-secondary)' }}>Nenhuma movimentação registrada.</p>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid rgba(255,255,255,0.1)', textAlign: 'left', color: 'var(--text-secondary)' }}>
                    <th style={{ padding: '0.6rem' }}>Data e Hora</th>
                    <th style={{ padding: '0.6rem' }}>Operação</th>
                    <th style={{ padding: '0.6rem' }}>Item</th>
                    <th style={{ padding: '0.6rem' }}>Quantidade</th>
                    <th style={{ padding: '0.6rem' }}>Responsável</th>
                  </tr>
                </thead>
                <tbody>
                  {movements.map(m => {
                    const isSaida = m.direction === 'saida';
                    return (
                      <tr key={m._id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                        <td style={{ padding: '0.6rem', color: 'var(--text-secondary)' }}>{new Date(m.date).toLocaleString('pt-BR')}</td>
                        <td style={{ padding: '0.6rem' }}>
                          <span className={`badge ${isSaida ? 'badge-amber' : 'badge-green'}`}>
                            {isSaida ? <><ArrowUpRight size={12} style={{marginRight:4}}/> Saída</> : <><ArrowDownLeft size={12} style={{marginRight:4}}/> Devolução</>}
                          </span>
                        </td>
                        <td style={{ padding: '0.6rem', fontWeight: 600 }}>{m.itemNome}</td>
                        <td style={{ padding: '0.6rem' }}>{m.quantidade || 1} unid.</td>
                        <td style={{ padding: '0.6rem' }}>{m.responsavel}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </motion.div>
      )}

    </div>
  );
};

export default Logistica;
