// src/utils/pdfUtils.js
import { PDFDocument } from 'pdf-lib';
import jsPDF from 'jspdf';

/**
 * Convert an array of image File objects into a single PDF blob.
 * @param {File[]} imageFiles - Array of image files (JPG/PNG)
 * @param {boolean} compress - Whether to compress the images to reduce file size
 * @returns {Promise<Blob>} PDF blob
 */
export async function imagesToPdf(imageFiles, compress = false) {
  const doc = new jsPDF();
  for (let i = 0; i < imageFiles.length; i++) {
    const file = imageFiles[i];
    let dataUrl = await readFileAsDataURL(file);
    const img = await loadImage(dataUrl);

    if (compress) {
      const canvas = document.createElement('canvas');
      const MAX_WIDTH = 1200;
      const MAX_HEIGHT = 1600;
      let width = img.width;
      let height = img.height;

      if (width > height) {
        if (width > MAX_WIDTH) {
          height *= MAX_WIDTH / width;
          width = MAX_WIDTH;
        }
      } else {
        if (height > MAX_HEIGHT) {
          width *= MAX_HEIGHT / height;
          height = MAX_HEIGHT;
        }
      }
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      // Fill with white so PNGs with transparency don't become black
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, width, height);
      ctx.drawImage(img, 0, 0, width, height);
      // Force JPEG compression at 0.7 quality
      dataUrl = canvas.toDataURL('image/jpeg', 0.7);
    }

    const format = compress ? 'JPEG' : (file.type === 'image/png' ? 'PNG' : 'JPEG');

    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const ratio = Math.min(pageWidth / img.width, pageHeight / img.height);
    const imgWidth = img.width * ratio;
    const imgHeight = img.height * ratio;
    const x = (pageWidth - imgWidth) / 2;
    const y = (pageHeight - imgHeight) / 2;
    if (i > 0) doc.addPage();
    doc.addImage(dataUrl, format, x, y, imgWidth, imgHeight);
  }
  return doc.output('blob');
}

/**
 * Convert plain text content into a PDF blob using jsPDF.
 * @param {string} text - The text content
 * @param {string} title - Title for the document
 * @returns {Blob} PDF blob
 */
export function textToPdf(text, title = 'Documento') {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  doc.setFontSize(16);
  doc.text(title, pageWidth / 2, 20, { align: 'center' });
  doc.setFontSize(11);
  const lines = doc.splitTextToSize(text, pageWidth - 30);
  let y = 35;
  const lineHeight = 6;
  const pageHeight = doc.internal.pageSize.getHeight();
  for (const line of lines) {
    if (y + lineHeight > pageHeight - 15) {
      doc.addPage();
      y = 20;
    }
    doc.text(line, 15, y);
    y += lineHeight;
  }
  return doc.output('blob');
}

/**
 * Merge multiple PDF File objects into a single PDF blob using pdf-lib.
 * @param {File[]} pdfFiles - Array of PDF files
 * @returns {Promise<Blob>} Merged PDF blob
 */
export async function mergePdfs(pdfFiles) {
  const mergedPdf = await PDFDocument.create();
  for (const file of pdfFiles) {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await PDFDocument.load(arrayBuffer);
    const copiedPages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
    copiedPages.forEach((page) => mergedPdf.addPage(page));
  }
  const mergedBytes = await mergedPdf.save();
  return new Blob([mergedBytes], { type: 'application/pdf' });
}

/**
 * Trigger browser download for a Blob.
 * @param {Blob} blob
 * @param {string} filename
 */
export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ── Helpers ──
function readFileAsDataURL(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}
