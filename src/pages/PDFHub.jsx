// src/pages/PDFHub.jsx
import React, { useState, useContext, useEffect } from 'react';
import { toast } from 'react-toastify';
import { imagesToPdf, textToPdf, mergePdfs, downloadBlob } from '../utils/pdfUtils.js';
import { DBContext } from '../context/DBContext.jsx';
import { Image, FileText, Combine, Download, History, Trash2, Clock } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const TOOL_LABELS = {
  imagem_para_pdf: '🖼️ Imagem → PDF',
  texto_para_pdf: '📝 Texto → PDF',
  merge_pdf: '📎 Merge de PDFs',
};

const PDFHub = () => {
  const { db } = useContext(DBContext);
  const [activeTab, setActiveTab] = useState('images');

  // ── Image to PDF state ──
  const [imageFiles, setImageFiles] = useState([]);

  // ── Text to PDF state ──
  const [docTitle, setDocTitle] = useState('');
  const [docText, setDocText] = useState('');

  // ── Merge state ──
  const [pdfFiles, setPdfFiles] = useState([]);

  // ── History state ──
  const [history, setHistory] = useState([]);

  const fetchHistory = async () => {
    if (!db) return;
    try {
      const result = await db.allDocs({ include_docs: true, attachments: true, binary: true });
      const items = result.rows
        .map(r => r.doc)
        .filter(d => d && d.type === 'pdf_history')
        .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
      setHistory(items);
    } catch (err) {
      console.error('Error fetching history:', err);
    }
  };

  useEffect(() => {
    fetchHistory();
    if (!db) return;
    const changes = db.changes({ since: 'now', live: true }).on('change', fetchHistory);
    return () => changes.cancel();
  }, [db]);

  // Save generated PDF to PouchDB as attachment so it can be re-downloaded
  const savePdfToHistory = async (blob, filename, tool) => {
    if (!db) return;
    try {
      const doc = {
        _id: `pdf_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        type: 'pdf_history',
        filename,
        tool,
        sizeBytes: blob.size,
        createdAt: new Date().toISOString(),
        _attachments: {
          [filename]: {
            content_type: 'application/pdf',
            data: blob,
          }
        }
      };
      await db.put(doc);
      // Also log usage for dashboard stats
      await db.post({ type: 'pdf_usage', tool, date: new Date().toISOString() });
    } catch (err) {
      console.error('Error saving to history:', err);
    }
  };

  const handleRedownload = async (item) => {
    try {
      const doc = await db.get(item._id, { attachments: true, binary: true });
      const attachment = doc._attachments[item.filename];
      if (!attachment) { toast.error('Arquivo não encontrado'); return; }
      const blob = attachment.data instanceof Blob
        ? attachment.data
        : new Blob([attachment.data], { type: 'application/pdf' });
      downloadBlob(blob, item.filename);
      toast.success(`Baixando: ${item.filename}`);
    } catch (err) {
      console.error(err);
      toast.error('Erro ao baixar o arquivo');
    }
  };

  const handleDeleteHistory = async (item) => {
    try {
      await db.remove(item);
      toast.info('Registro removido do histórico');
    } catch (err) {
      toast.error('Erro ao remover');
    }
  };

  // ── Handlers ──
  const handleImageToPdf = async () => {
    if (imageFiles.length === 0) { toast.error('Selecione pelo menos uma imagem'); return; }
    try {
      toast.info('Gerando PDF...');
      const blob = await imagesToPdf(imageFiles);
      const filename = `imagens-${Date.now()}.pdf`;
      downloadBlob(blob, filename);
      await savePdfToHistory(blob, filename, 'imagem_para_pdf');
      toast.success('PDF gerado com sucesso!');
      setImageFiles([]);
    } catch (err) {
      console.error(err);
      toast.error('Erro ao gerar PDF');
    }
  };

  const handleTextToPdf = async () => {
    if (!docText.trim()) { toast.error('Digite algum conteúdo'); return; }
    try {
      const blob = textToPdf(docText, docTitle || 'Documento');
      const filename = (docTitle || 'documento').replace(/[^a-zA-Z0-9À-ÿ\s\-_]/g, '') + '.pdf';
      downloadBlob(blob, filename);
      await savePdfToHistory(blob, filename, 'texto_para_pdf');
      toast.success('PDF gerado com sucesso!');
      setDocTitle('');
      setDocText('');
    } catch (err) {
      console.error(err);
      toast.error('Erro ao gerar PDF');
    }
  };

  const handleMerge = async () => {
    if (pdfFiles.length < 2) { toast.error('Selecione pelo menos 2 arquivos PDF'); return; }
    try {
      toast.info('Mesclando PDFs...');
      const blob = await mergePdfs(pdfFiles);
      const filename = `mesclado-${Date.now()}.pdf`;
      downloadBlob(blob, filename);
      await savePdfToHistory(blob, filename, 'merge_pdf');
      toast.success('PDFs mesclados com sucesso!');
      setPdfFiles([]);
    } catch (err) {
      console.error(err);
      toast.error('Erro ao mesclar PDFs');
    }
  };

  const formatDate = (iso) => {
    if (!iso) return '';
    const d = new Date(iso);
    return d.toLocaleDateString('pt-BR') + ' às ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  };

  const formatSize = (bytes) => {
    if (!bytes) return '';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const tabs = [
    { key: 'images', label: 'Imagem → PDF', icon: <Image size={16} /> },
    { key: 'text', label: 'Texto → PDF', icon: <FileText size={16} /> },
    { key: 'merge', label: 'Juntar PDFs', icon: <Combine size={16} /> },
    { key: 'history', label: `Histórico (${history.length})`, icon: <History size={16} /> },
  ];

  return (
    <div>
      <h1 className="page-title">Hub de Documentos PDF</h1>
      <p style={{ color: 'var(--text-secondary)', marginBottom: '1rem', fontSize: '0.85rem' }}>
        Todas as operações são processadas localmente. Nenhum arquivo é enviado para a internet.
      </p>

      <div className="tabs">
        {tabs.map(t => (
          <button key={t.key} className={`tab ${activeTab === t.key ? 'active' : ''}`} onClick={() => setActiveTab(t.key)}>
            {t.icon} <span style={{ marginLeft: 6 }}>{t.label}</span>
          </button>
        ))}
      </div>

      {/* ── Imagem → PDF ── */}
      {activeTab === 'images' && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="card">
          <h3 style={{ marginBottom: '0.75rem', color: 'var(--text-primary)' }}>Converter Imagens em PDF</h3>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.75rem' }}>
            Selecione fotos (JPG/PNG) de documentos de alunos e gere um PDF único.
          </p>
          <input
            type="file"
            accept="image/jpeg,image/png"
            multiple
            onChange={e => setImageFiles(Array.from(e.target.files))}
            style={{ marginBottom: '0.75rem', color: 'var(--text-secondary)' }}
          />
          {imageFiles.length > 0 && (
            <p style={{ fontSize: '0.85rem', color: 'var(--text-primary)', marginBottom: '0.75rem' }}>
              {imageFiles.length} imagem(ns) selecionada(s): {imageFiles.map(f => f.name).join(', ')}
            </p>
          )}
          <button className="btn-primary" onClick={handleImageToPdf}>
            <Download size={16} /> Gerar PDF
          </button>
        </motion.div>
      )}

      {/* ── Texto → PDF ── */}
      {activeTab === 'text' && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="card">
          <h3 style={{ marginBottom: '0.75rem', color: 'var(--text-primary)' }}>Criar Documento PDF a partir de Texto</h3>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.75rem' }}>
            Digite declarações escolares, comunicados ou qualquer texto e salve diretamente em PDF.
          </p>
          <div style={{ marginBottom: '0.75rem' }}>
            <label>Título do Documento</label>
            <input className="form-input" value={docTitle} onChange={e => setDocTitle(e.target.value)} placeholder="Ex: Declaração de Matrícula" />
          </div>
          <div style={{ marginBottom: '0.75rem' }}>
            <label>Conteúdo</label>
            <textarea
              className="form-input"
              rows={10}
              value={docText}
              onChange={e => setDocText(e.target.value)}
              placeholder="Digite o conteúdo do documento aqui..."
            />
          </div>
          <button className="btn-primary" onClick={handleTextToPdf}>
            <Download size={16} /> Gerar PDF
          </button>
        </motion.div>
      )}

      {/* ── Juntar PDFs ── */}
      {activeTab === 'merge' && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="card">
          <h3 style={{ marginBottom: '0.75rem', color: 'var(--text-primary)' }}>Mesclar Múltiplos PDFs</h3>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.75rem' }}>
            Selecione vários arquivos PDF e combine-os em um único documento organizado.
          </p>
          <input
            type="file"
            accept="application/pdf"
            multiple
            onChange={e => setPdfFiles(Array.from(e.target.files))}
            style={{ marginBottom: '0.75rem', color: 'var(--text-secondary)' }}
          />
          {pdfFiles.length > 0 && (
            <p style={{ fontSize: '0.85rem', color: 'var(--text-primary)', marginBottom: '0.75rem' }}>
              {pdfFiles.length} PDF(s) selecionado(s): {pdfFiles.map(f => f.name).join(', ')}
            </p>
          )}
          <button className="btn-primary" onClick={handleMerge}>
            <Combine size={16} /> Mesclar PDFs
          </button>
        </motion.div>
      )}

      {/* ── Histórico ── */}
      {activeTab === 'history' && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          {history.length === 0 ? (
            <div className="card" style={{ textAlign: 'center', padding: '3rem' }}>
              <History size={48} style={{ color: 'var(--text-secondary)', marginBottom: '1rem' }} />
              <p style={{ color: 'var(--text-secondary)' }}>Nenhum PDF gerado ainda. Use as ferramentas acima para criar seu primeiro documento.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <AnimatePresence>
                {history.map((item, idx) => (
                  <motion.div
                    key={item._id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 20 }}
                    transition={{ delay: idx * 0.05 }}
                    className="card"
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1rem 1.5rem' }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flex: 1, minWidth: 0 }}>
                      <div style={{
                        width: 44, height: 44, borderRadius: '12px',
                        background: 'rgba(59, 130, 246, 0.15)',
                        border: '1px solid rgba(59, 130, 246, 0.3)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        flexShrink: 0
                      }}>
                        <FileText size={20} style={{ color: '#3b82f6' }} />
                      </div>
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.95rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {item.filename}
                        </div>
                        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', marginTop: '0.25rem', flexWrap: 'wrap' }}>
                          <span className="badge badge-blue">{TOOL_LABELS[item.tool] || item.tool}</span>
                          <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                            <Clock size={12} /> {formatDate(item.createdAt)}
                          </span>
                          <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                            {formatSize(item.sizeBytes)}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem', flexShrink: 0, marginLeft: '1rem' }}>
                      <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        className="btn-primary"
                        style={{ padding: '0.5rem 1rem', fontSize: '0.85rem' }}
                        onClick={() => handleRedownload(item)}
                      >
                        <Download size={14} /> Baixar
                      </motion.button>
                      <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        className="btn-danger"
                        style={{ padding: '0.5rem 0.75rem', fontSize: '0.85rem' }}
                        onClick={() => handleDeleteHistory(item)}
                      >
                        <Trash2 size={14} />
                      </motion.button>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          )}
        </motion.div>
      )}
    </div>
  );
};

export default PDFHub;
