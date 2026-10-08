import React, { useState, useContext, useEffect } from 'react';
import { DBContext } from '../context/DBContext.jsx';
import { imagesToPdf, textToPdf, mergePdfs, downloadBlob } from '../utils/pdfUtils.js';
import { toast } from 'react-toastify';
import { Image as ImageIcon, FileText, Combine, Download, History, Trash2, ArrowUp, ArrowDown, X, CheckSquare, Plus } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const PDFHub = () => {
  const { db } = useContext(DBContext);
  const [activeTab, setActiveTab] = useState('images');

  // ── Image to PDF state ──
  const [imageFiles, setImageFiles] = useState([]);
  const [imageDocName, setImageDocName] = useState('');
  const [compressImages, setCompressImages] = useState(true);

  // ── Text to PDF state ──
  const [docTitle, setDocTitle] = useState('');
  const [docText, setDocText] = useState('');

  // ── Merge state ──
  const [pdfFiles, setPdfFiles] = useState([]);
  const [mergeDocName, setMergeDocName] = useState('');

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
      toast.info('Registro removido');
    } catch (err) {
      toast.error('Erro ao remover');
    }
  };

  // ── Array Reorder Helpers ──
  const moveUp = (array, setArray, index) => {
    if (index === 0) return;
    const newArr = [...array];
    [newArr[index - 1], newArr[index]] = [newArr[index], newArr[index - 1]];
    setArray(newArr);
  };

  const moveDown = (array, setArray, index) => {
    if (index === array.length - 1) return;
    const newArr = [...array];
    [newArr[index + 1], newArr[index]] = [newArr[index], newArr[index + 1]];
    setArray(newArr);
  };

  const removeFile = (array, setArray, index) => {
    const newArr = [...array];
    newArr.splice(index, 1);
    setArray(newArr);
  };

  // ── Handlers ──
  const handleImageToPdf = async () => {
    if (imageFiles.length === 0) { toast.error('Selecione imagens'); return; }
    try {
      toast.info('Gerando PDF... Aguarde.');
      const blob = await imagesToPdf(imageFiles, compressImages);
      const baseName = imageDocName.trim() || `imagens-${Date.now()}`;
      const filename = baseName.replace(/[^a-zA-Z0-9À-ÿ\s\-_]/g, '') + '.pdf';
      downloadBlob(blob, filename);
      await savePdfToHistory(blob, filename, 'imagem_para_pdf');
      toast.success('PDF gerado com sucesso!');
      setImageFiles([]);
      setImageDocName('');
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
      const baseName = mergeDocName.trim() || `mesclado-${Date.now()}`;
      const filename = baseName.replace(/[^a-zA-Z0-9À-ÿ\s\-_]/g, '') + '.pdf';
      downloadBlob(blob, filename);
      await savePdfToHistory(blob, filename, 'merge_pdf');
      toast.success('PDFs mesclados com sucesso!');
      setPdfFiles([]);
      setMergeDocName('');
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
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const tabs = [
    { key: 'images', label: 'Imagens → PDF', icon: <ImageIcon size={16} /> },
    { key: 'text', label: 'Texto → PDF', icon: <FileText size={16} /> },
    { key: 'merge', label: 'Juntar PDFs', icon: <Combine size={16} /> },
    { key: 'history', label: `Histórico (${history.length})`, icon: <History size={16} /> },
  ];

  return (
    <div>
      <h1 className="page-title">Hub de Documentos PDF</h1>
      <p style={{ color: 'var(--text-secondary)', marginBottom: '1rem', fontSize: '0.85rem' }}>
        Todas as operações são processadas localmente. Adicione arquivos de várias pastas e organize a ordem!
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
            Selecione fotos (JPG/PNG) para gerar um PDF. Você pode clicar no botão várias vezes para pegar arquivos de pastas diferentes.
          </p>
          
          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
            <div style={{ flex: 1, minWidth: 200 }}>
              <label>Nome do Documento</label>
              <input className="form-input" value={imageDocName} onChange={e => setImageDocName(e.target.value)} placeholder="Ex: Documentos do Aluno João Silva" />
            </div>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: '1rem' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', color: 'var(--text-primary)' }}>
                <input type="checkbox" checked={compressImages} onChange={e => setCompressImages(e.target.checked)} style={{ width: 18, height: 18 }} />
                Comprimir Imagens (Reduz o tamanho)
              </label>
            </div>
          </div>

          <div style={{ marginBottom: '1rem' }}>
            <label htmlFor="image-upload" className="btn-secondary" style={{ display: 'inline-flex', cursor: 'pointer' }}>
              <Plus size={16} /> Adicionar Imagens
            </label>
            <input
              id="image-upload"
              type="file"
              accept="image/jpeg,image/png"
              multiple
              onChange={e => {
                if (e.target.files) {
                  setImageFiles(prev => [...prev, ...Array.from(e.target.files)]);
                }
                e.target.value = null;
              }}
              style={{ display: 'none' }}
            />
          </div>

          {imageFiles.length > 0 && (
            <div style={{ marginBottom: '1rem', background: 'rgba(255,255,255,0.02)', padding: '0.5rem', borderRadius: 8 }}>
              <h4 style={{ fontSize: '0.85rem', color: 'var(--text-primary)', marginBottom: '0.5rem' }}>{imageFiles.length} Imagem(ns) na fila:</h4>
              {imageFiles.map((f, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.4rem', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                  <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{i + 1}. {f.name}</span>
                  <div style={{ display: 'flex', gap: '0.25rem' }}>
                    <button type="button" className="btn-secondary" style={{ padding: '0.2rem' }} onClick={() => moveUp(imageFiles, setImageFiles, i)} disabled={i === 0}><ArrowUp size={14}/></button>
                    <button type="button" className="btn-secondary" style={{ padding: '0.2rem' }} onClick={() => moveDown(imageFiles, setImageFiles, i)} disabled={i === imageFiles.length - 1}><ArrowDown size={14}/></button>
                    <button type="button" className="btn-danger" style={{ padding: '0.2rem' }} onClick={() => removeFile(imageFiles, setImageFiles, i)}><X size={14}/></button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <motion.button whileTap={{ scale: 0.95 }} className="btn-primary" onClick={handleImageToPdf} disabled={imageFiles.length === 0}>
            <CheckSquare size={16} /> Gerar PDF
          </motion.button>
        </motion.div>
      )}

      {/* ── Texto → PDF ── */}
      {activeTab === 'text' && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="card">
          <h3 style={{ marginBottom: '0.75rem', color: 'var(--text-primary)' }}>Gerar PDF de Texto</h3>
          <div style={{ marginBottom: '0.75rem' }}>
            <label>Título do Documento</label>
            <input
              className="form-input"
              value={docTitle}
              onChange={e => setDocTitle(e.target.value)}
              placeholder="Ex: Ata de Reunião"
            />
          </div>
          <div style={{ marginBottom: '0.75rem' }}>
            <label>Conteúdo</label>
            <textarea
              className="form-input"
              style={{ height: '200px', resize: 'vertical' }}
              value={docText}
              onChange={e => setDocText(e.target.value)}
              placeholder="Digite o conteúdo do documento aqui..."
            />
          </div>
          <motion.button whileTap={{ scale: 0.95 }} className="btn-primary" onClick={handleTextToPdf}>
            <Download size={16} /> Gerar PDF
          </motion.button>
        </motion.div>
      )}

      {/* ── Juntar PDFs ── */}
      {activeTab === 'merge' && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="card">
          <h3 style={{ marginBottom: '0.75rem', color: 'var(--text-primary)' }}>Mesclar Múltiplos PDFs</h3>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.75rem' }}>
            Adicione vários PDFs, mude a ordem de cada um, e gere um documento final.
          </p>
          
          <div style={{ marginBottom: '0.75rem' }}>
            <label>Nome do Documento Final</label>
            <input className="form-input" value={mergeDocName} onChange={e => setMergeDocName(e.target.value)} placeholder="Ex: Prontuário Completo - Maria" />
          </div>

          <div style={{ marginBottom: '1rem' }}>
            <label htmlFor="pdf-upload" className="btn-secondary" style={{ display: 'inline-flex', cursor: 'pointer' }}>
              <Plus size={16} /> Adicionar PDFs
            </label>
            <input
              id="pdf-upload"
              type="file"
              accept="application/pdf"
              multiple
              onChange={e => {
                if (e.target.files) {
                  setPdfFiles(prev => [...prev, ...Array.from(e.target.files)]);
                }
                e.target.value = null;
              }}
              style={{ display: 'none' }}
            />
          </div>

          {pdfFiles.length > 0 && (
            <div style={{ marginBottom: '1rem', background: 'rgba(255,255,255,0.02)', padding: '0.5rem', borderRadius: 8 }}>
              <h4 style={{ fontSize: '0.85rem', color: 'var(--text-primary)', marginBottom: '0.5rem' }}>{pdfFiles.length} PDF(s) na fila:</h4>
              {pdfFiles.map((f, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.4rem', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                  <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{i + 1}. {f.name}</span>
                  <div style={{ display: 'flex', gap: '0.25rem' }}>
                    <button type="button" className="btn-secondary" style={{ padding: '0.2rem' }} onClick={() => moveUp(pdfFiles, setPdfFiles, i)} disabled={i === 0}><ArrowUp size={14}/></button>
                    <button type="button" className="btn-secondary" style={{ padding: '0.2rem' }} onClick={() => moveDown(pdfFiles, setPdfFiles, i)} disabled={i === pdfFiles.length - 1}><ArrowDown size={14}/></button>
                    <button type="button" className="btn-danger" style={{ padding: '0.2rem' }} onClick={() => removeFile(pdfFiles, setPdfFiles, i)}><X size={14}/></button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <motion.button whileTap={{ scale: 0.95 }} className="btn-primary" onClick={handleMerge} disabled={pdfFiles.length < 2}>
            <Combine size={16} /> Mesclar e Baixar
          </motion.button>
        </motion.div>
      )}

      {/* ── Histórico ── */}
      {activeTab === 'history' && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="card">
          <h3 style={{ marginBottom: '0.75rem', color: 'var(--text-primary)' }}>Histórico de Documentos Gerados</h3>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
            Os PDFs gerados recentemente ficam salvos no banco de dados para download.
          </p>
          {history.length === 0 ? (
            <p style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: '2rem' }}>Nenhum documento gerado ainda.</p>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)', textAlign: 'left', color: 'var(--text-secondary)' }}>
                    <th style={{ padding: '0.5rem' }}>Arquivo</th>
                    <th style={{ padding: '0.5rem' }}>Operação</th>
                    <th style={{ padding: '0.5rem' }}>Tamanho</th>
                    <th style={{ padding: '0.5rem' }}>Data</th>
                    <th style={{ padding: '0.5rem' }}>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  <AnimatePresence>
                    {history.map(item => (
                      <motion.tr 
                        key={item._id} 
                        initial={{ opacity: 0 }} 
                        animate={{ opacity: 1 }} 
                        exit={{ opacity: 0 }}
                        style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}
                      >
                        <td style={{ padding: '0.5rem', fontWeight: 600, color: 'var(--text-primary)' }}>{item.filename}</td>
                        <td style={{ padding: '0.5rem', color: 'var(--text-secondary)' }}>
                          {item.tool === 'imagem_para_pdf' ? 'Imagens' : item.tool === 'texto_para_pdf' ? 'Texto' : 'Merge'}
                        </td>
                        <td style={{ padding: '0.5rem', color: 'var(--text-secondary)' }}>{formatSize(item.sizeBytes)}</td>
                        <td style={{ padding: '0.5rem', color: 'var(--text-secondary)' }}>{formatDate(item.createdAt)}</td>
                        <td style={{ padding: '0.5rem', display: 'flex', gap: '0.5rem' }}>
                          <motion.button whileTap={{ scale: 0.9 }} className="btn-primary" style={{ padding: '0.3rem 0.5rem' }} onClick={() => handleRedownload(item)}>
                            <Download size={14} />
                          </motion.button>
                          <motion.button whileTap={{ scale: 0.9 }} className="btn-danger" style={{ padding: '0.3rem 0.5rem' }} onClick={() => handleDeleteHistory(item)}>
                            <Trash2 size={14} />
                          </motion.button>
                        </td>
                      </motion.tr>
                    ))}
                  </AnimatePresence>
                </tbody>
              </table>
            </div>
          )}
        </motion.div>
      )}
    </div>
  );
};

export default PDFHub;
