/**
 * Contrôleur pour la gestion des bons de commande
 * ================================================
 * 
 * Opérations CRUD et génération PDF
 */

const fs = require('fs');
const path = require('path');
const PDFDocument = require('pdfkit');
const { AppError } = require('../middleware/errorHandler');
const { query } = require('../config/database');
const { v4: uuidv4 } = require('uuid');
const { COMPANY_INFO, PAYMENT_TERMS, DELIVERY_TERMS, QUOTE_VALIDITY } = require('../config/company');

const formatDate = (value) => {
  if (!value) return new Date().toLocaleDateString('fr-FR');

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
      const [year, month, day] = trimmed.split('-').map(Number);
      return new Date(year, month - 1, day).toLocaleDateString('fr-FR');
    }

    if (/^\d{4}-\d{2}-\d{2}T/.test(trimmed)) {
      const parsed = new Date(trimmed);
      if (!Number.isNaN(parsed.getTime())) {
        return parsed.toLocaleDateString('fr-FR');
      }
    }
  }

  const parsed = new Date(value);
  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toLocaleDateString('fr-FR');
  }

  return new Date().toLocaleDateString('fr-FR');
};

const calculateLineTotal = (article) => {
  const quantity = Number(article?.quantite ?? 0);
  const unitPrice = Number(article?.prix_unitaire ?? 0);
  const total = Number.isFinite(quantity) && Number.isFinite(unitPrice) ? quantity * unitPrice : 0;
  return Number.isFinite(total) ? total : 0;
};

const parseBonDescription = (descriptionValue) => {
  const fallback = {
    description: '',
    articles: [],
    contactPhone: '-',
    contactEmail: '-',
    contactAddress: ''
  };

  if (!descriptionValue) return fallback;

  if (typeof descriptionValue === 'object') {
    return {
      description: descriptionValue.description || '',
      articles: Array.isArray(descriptionValue.articles) ? descriptionValue.articles : [],
      contactPhone: descriptionValue.fournisseur_telephone || descriptionValue.contactPhone || '-',
      contactEmail: descriptionValue.fournisseur_email || descriptionValue.contactEmail || '-',
      contactAddress: descriptionValue.fournisseur_adresse || descriptionValue.contactAddress || ''
    };
  }

  if (typeof descriptionValue !== 'string') return fallback;

  try {
    const parsed = JSON.parse(descriptionValue);
    if (parsed && typeof parsed === 'object') {
      return {
        description: parsed.description || '',
        articles: Array.isArray(parsed.articles) ? parsed.articles : [],
        contactPhone: parsed.fournisseur_telephone || parsed.contactPhone || '-',
        contactEmail: parsed.fournisseur_email || parsed.contactEmail || '-',
        contactAddress: parsed.fournisseur_adresse || parsed.contactAddress || ''
      };
    }
  } catch {
    // fallback to plain text description
  }

  return {
    ...fallback,
    description: descriptionValue
  };
};

/**
 * Liste tous les bons de commande
 */
const listBons = async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, parseInt(req.query.limit) || 20);
    const offset = (page - 1) * limit;

    const result = await query(
      `SELECT * FROM bons_commande 
       ORDER BY created_at DESC 
       LIMIT $1 OFFSET $2`,
      [limit, offset]
    );

    const countResult = await query('SELECT COUNT(*) FROM bons_commande');
    const total = parseInt(countResult.rows[0].count);

    res.json({
      success: true,
      data: result.rows,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Récupère un bon de commande par ID
 */
const getBon = async (req, res, next) => {
  try {
    const { id } = req.params;

    const result = await query(
      'SELECT * FROM bons_commande WHERE id = $1',
      [id]
    );

    if (result.rows.length === 0) {
      throw new AppError('Bon de commande non trouvé', 404);
    }

    res.json({
      success: true,
      data: result.rows[0]
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Crée un nouveau bon de commande
 */
const createBon = async (req, res, next) => {
  try {
    const {
      numero,
      fournisseur,
      fournisseur_nom,
      montant,
      description,
      articles = [],
      fournisseur_telephone,
      fournisseur_email,
      fournisseur_adresse,
      date_commande
    } = req.body;
    const fournisseurValue = (fournisseur || fournisseur_nom || '').toString().trim();
    const parsedMontant = montant !== undefined
      ? Number(montant)
      : Array.isArray(articles)
        ? articles.reduce((sum, article) => sum + ((Number(article.quantite) || 0) * (Number(article.prix_unitaire) || 0)), 0)
        : undefined;

    if (!numero || !fournisseurValue || parsedMontant === undefined || Number.isNaN(parsedMontant)) {
      throw new AppError('Champs requis: numero, fournisseur, montant', 400);
    }

    const descriptionPayload = JSON.stringify({
      description: description || '',
      articles: Array.isArray(articles) ? articles : [],
      fournisseur_telephone: (fournisseur_telephone || '').toString().trim(),
      fournisseur_email: (fournisseur_email || '').toString().trim(),
      fournisseur_adresse: (fournisseur_adresse || '').toString().trim()
    });

    const id = uuidv4();
    await query(
      `INSERT INTO bons_commande (id, numero, fournisseur, montant, description, statut, date_commande, created_at, user_id) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), $8)`,
      [id, numero, fournisseurValue, parsedMontant, descriptionPayload, 'EN_ATTENTE', date_commande || null, req.user.id]
    );

    const created = await query('SELECT * FROM bons_commande WHERE id = $1', [id]);

    res.status(201).json({
      success: true,
      message: 'Bon de commande créé avec succès',
      data: created.rows[0]
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Modifie un bon de commande
 */
const updateBon = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { numero, fournisseur, montant, description, statut, date_commande } = req.body;

    const existingResult = await query(
      'SELECT * FROM bons_commande WHERE id = $1',
      [id]
    );

    if (existingResult.rows.length === 0) {
      throw new AppError('Bon de commande non trouvé', 404);
    }

    const updates = [];
    const values = [];
    let paramCount = 1;

    if (numero !== undefined) {
      updates.push(`numero = $${paramCount++}`);
      values.push(numero);
    }
    if (fournisseur !== undefined) {
      updates.push(`fournisseur = $${paramCount++}`);
      values.push(fournisseur);
    }
    if (montant !== undefined) {
      updates.push(`montant = $${paramCount++}`);
      values.push(montant);
    }
    if (description !== undefined) {
      updates.push(`description = $${paramCount++}`);
      values.push(description);
    }
    if (statut !== undefined) {
      updates.push(`statut = $${paramCount++}`);
      values.push(statut);
    }
    if (date_commande !== undefined) {
      updates.push(`date_commande = $${paramCount++}`);
      values.push(date_commande);
    }

    if (updates.length === 0) {
      throw new AppError('Aucun champ à mettre à jour', 400);
    }

    updates.push('updated_at = NOW()');
    values.push(id);

    await query(
      `UPDATE bons_commande SET ${updates.join(', ')} WHERE id = $${paramCount}`,
      values
    );

    const updated = await query('SELECT * FROM bons_commande WHERE id = $1', [id]);

    res.json({
      success: true,
      message: 'Bon de commande modifié avec succès',
      data: updated.rows[0]
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Supprime un bon de commande
 */
const deleteBon = async (req, res, next) => {
  try {
    const { id } = req.params;

    const result = await query(
      'DELETE FROM bons_commande WHERE id = $1',
      [id]
    );

    if (result.rowCount === 0) {
      throw new AppError('Bon de commande non trouvé', 404);
    }

    res.json({
      success: true,
      message: 'Bon de commande supprimé avec succès'
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Génère un PDF du bon de commande
 */
const generatePDF = async (req, res, next) => {
  try {
    const { id } = req.params;

    const result = await query(
      'SELECT * FROM bons_commande WHERE id = $1',
      [id]
    );

    if (result.rows.length === 0) {
      throw new AppError('Bon de commande non trouvé', 404);
    }

    const bon = result.rows[0];
    const montantHT = Number(bon.montant || 0);
    const montantTVA = 0;
    const montantTTC = montantHT;

    const formatPrice = (num) => {
      const text = new Intl.NumberFormat('fr-FR', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      }).format(num);
      return text.replace(/\u202f/g, ' ');
    };

    const orderDate = bon.date_commande || bon.created_at;
    const clientName = bon.fournisseur || '-';
    const parsedDescription = parseBonDescription(bon.description);
    const contactEmail = parsedDescription.contactEmail || '-';
    const contactPhone = parsedDescription.contactPhone || '-';
    let storedArticles = parsedDescription.articles || [];

    const items = storedArticles.length > 0 ? storedArticles : [{
      designation: bon.description || 'Montant du bon de commande',
      unite: 'forfait',
      quantite: 1,
      prix_unitaire: montantHT,
      total_ligne: montantHT
    }];

    const logoPath = path.resolve(__dirname, '../../public', COMPANY_INFO.logo.replace(/^\//, ''));
    const hasLogo = fs.existsSync(logoPath);

    const doc = new PDFDocument({ size: 'A4', layout: 'portrait', margin: 28 });
    const fileName = `Bon_de_commande_${bon.numero}.pdf`;
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.setHeader('Content-Type', 'application/pdf');
    doc.pipe(res);

    const colors = {
      primary: '#000000',
      accent: '#F59E0B',
      light: '#FFF8E8',
      border: '#F59E0B',
      text: '#111111',
      muted: '#5F5A4D',
      white: '#FFFFFF'
    };

    const leftX = 28;
    const rightX = doc.page.width - 28;
    const contentWidth = rightX - leftX;
    const topY = 28;
    const pageHeaderHeight = 86;

    doc
      .rect(leftX, topY, contentWidth, pageHeaderHeight)
      .fill('#F5F1E8')
      .stroke({ color: colors.accent, width: 3 });

    if (hasLogo) {
      doc.image(logoPath, rightX - 110, topY + 14, { fit: [90, 60], align: 'right' });
    }

    doc
      .font('Helvetica-Bold')
      .fontSize(34)
      .fillColor(colors.primary)
      .text('BON DE COMMANDE', leftX + 14, topY + 18);

    doc
      .font('Helvetica')
      .fontSize(10)
      .fillColor(colors.text)
      .text(`N° ${bon.numero}`, leftX + 14, topY + 62)
      .text(`Date : ${formatDate(orderDate)}`, leftX + 220, topY + 62);

    const companyBoxY = topY + pageHeaderHeight + 12;
    const companyBoxH = 128;
    const companyBoxW = Math.round((contentWidth - 12) / 2);
    const companyBoxX = leftX;
    const clientBoxX = leftX + companyBoxW + 12;
    const clientBoxW = contentWidth - companyBoxW - 12;
    const clientBoxY = companyBoxY;
    const clientBoxH = companyBoxH;

    doc
      .rect(companyBoxX, companyBoxY, companyBoxW, companyBoxH)
      .fill(colors.white)
      .stroke(colors.border);

    doc
      .font('Helvetica-Bold')
      .fontSize(14)
      .fillColor(colors.primary)
      .text('Société', companyBoxX + 10, companyBoxY + 10);

    doc
      .font('Helvetica-Bold')
      .fontSize(11)
      .fillColor(colors.text)
      .text(COMPANY_INFO.name, companyBoxX + 10, companyBoxY + 28, { width: companyBoxW - 20 });

    doc
      .font('Helvetica-Bold')
      .fontSize(9)
      .fillColor(colors.text)
      .text('RC :', companyBoxX + 10, companyBoxY + 49);
    const rcFontPath = 'C:/Windows/Fonts/arial.ttf';
    doc.registerFont('rc-font', rcFontPath);

    const rcText = '14 B0188021';

    doc
      .font('rc-font')
      .fontSize(9)
      .fillColor(colors.muted)
      .text(rcText, companyBoxX + 35, companyBoxY + 49, { width: companyBoxW - 45 });

    doc
      .font('Helvetica-Bold')
      .fontSize(9)
      .fillColor(colors.text)
      .text('NIF :', companyBoxX + 10, companyBoxY + 62);
    doc
      .font('Helvetica')
      .fontSize(9)
      .fillColor(colors.muted)
      .text('001406018802120', companyBoxX + 35, companyBoxY + 62, { width: companyBoxW - 45 });

    doc
      .font('Helvetica-Bold')
      .fontSize(9)
      .fillColor(colors.text)
      .text('NIS :', companyBoxX + 10, companyBoxY + 75);
    doc
      .font('Helvetica')
      .fontSize(9)
      .fillColor(colors.muted)
      .text('0 014 0633 00075 61', companyBoxX + 35, companyBoxY + 75, { width: companyBoxW - 45 });

    doc
      .font('Helvetica-Bold')
      .fontSize(9)
      .fillColor(colors.text)
      .text('Tél :', companyBoxX + 10, companyBoxY + 90);
    doc
      .font('Helvetica')
      .fontSize(9)
      .fillColor(colors.muted)
      .text(`${COMPANY_INFO.phone} / ${COMPANY_INFO.mobile1} / ${COMPANY_INFO.mobile2}`, companyBoxX + 35, companyBoxY + 90, { width: companyBoxW - 45 });

    doc
      .font('Helvetica-Bold')
      .fontSize(9)
      .fillColor(colors.text)
      .text('Email :', companyBoxX + 10, companyBoxY + 104);
    doc
      .font('Helvetica')
      .fontSize(9)
      .fillColor(colors.muted)
      .text(` ${COMPANY_INFO.email || '-'}`, companyBoxX + 50, companyBoxY + 104, { width: companyBoxW - 60 });

    doc
      .font('Helvetica')
      .fontSize(9)
      .fillColor(colors.muted)
      .text(COMPANY_INFO.address, companyBoxX + 10, companyBoxY + 118, { width: companyBoxW - 20, lineGap: 1 });

    doc
      .rect(clientBoxX, clientBoxY, clientBoxW, clientBoxH)
      .fill(colors.white)
      .stroke(colors.border);

    doc
      .font('Helvetica-Bold')
      .fontSize(14)
      .fillColor(colors.primary)
      .text('Fournisseur', clientBoxX + 10, clientBoxY + 10);

    doc
      .font('Helvetica-Bold')
      .fontSize(12)
      .fillColor(colors.text)
      .text(clientName, clientBoxX + 10, clientBoxY + 32, { width: clientBoxW - 20 });

    doc
      .font('Helvetica-Bold')
      .fontSize(10)
      .fillColor(colors.text)
      .text('Tél :', clientBoxX + 10, clientBoxY + 56);
    doc
      .font('Helvetica')
      .fontSize(10)
      .fillColor(colors.muted)
      .text(contactPhone, clientBoxX + 42, clientBoxY + 56, { width: clientBoxW - 52 });

    doc
      .font('Helvetica-Bold')
      .fontSize(10)
      .fillColor(colors.text)
      .text('Email :', clientBoxX + 10, clientBoxY + 72);
    doc
      .font('Helvetica')
      .fontSize(10)
      .fillColor(colors.muted)
      .text(contactEmail, clientBoxX + 52, clientBoxY + 72, { width: clientBoxW - 62 });

    const tableTop = clientBoxY + clientBoxH + 14;
    const rowHeight = 18;
    const tableHeaderHeight = 24;
    const pageBottom = doc.page.height - 28;

    doc
      .rect(leftX, tableTop, contentWidth, tableHeaderHeight)
      .fill(colors.primary);

    const cols = {
      no: leftX + 8,
      desc: leftX + 36,
      unit: leftX + 268,
      qty: leftX + 312,
      pu: leftX + 354,
      total: leftX + 442
    };

    doc
      .font('Helvetica-Bold')
      .fontSize(9)
      .fillColor(colors.white)
      .text('N°', cols.no, tableTop + 8, { width: 24, align: 'center' })
      .text('Désignation', cols.desc, tableTop + 8, { width: 228 })
      .text('Unité', cols.unit, tableTop + 8, { width: 40, align: 'center' })
      .text('Qté', cols.qty, tableTop + 8, { width: 34, align: 'center' })
      .text('P.U.', cols.pu, tableTop + 8, { width: 80, align: 'right' })
      .text('Total', cols.total, tableTop + 8, { width: 90, align: 'right' });

    let rowY = tableTop + tableHeaderHeight;
    const tableFontSize = 8;

    if (items.length === 0) {
      doc
        .rect(leftX, rowY, contentWidth, rowHeight)
        .fill(colors.light)
        .stroke(colors.border);
      doc
        .font('Helvetica')
        .fontSize(9)
        .fillColor(colors.muted)
        .text('Aucun article', cols.desc, rowY + 8);
      rowY += rowHeight;
    } else {
      items.forEach((article, index) => {
        const rowColor = index % 2 === 0 ? colors.white : colors.light;
        doc
          .rect(leftX, rowY, contentWidth, rowHeight)
          .fill(rowColor)
          .stroke(colors.border);

        const descriptionText = article.designation.length > 42
          ? `${article.designation.substring(0, 39)}...`
          : article.designation;

        const lineTotal = calculateLineTotal(article);
        const safeUnitPrice = Number(article.prix_unitaire ?? 0);
        const safeQuantity = Number(article.quantite ?? 0);

        doc
          .font('Helvetica')
          .fontSize(tableFontSize)
          .fillColor(colors.text)
          .text(index + 1, cols.no, rowY + 5, { width: 24, align: 'center' })
          .text(descriptionText, cols.desc, rowY + 5, { width: 228 })
          .text(article.unite || 'pièce', cols.unit, rowY + 5, { width: 40, align: 'center' })
          .text(String(safeQuantity), cols.qty, rowY + 5, { width: 34, align: 'center' })
          .text(formatPrice(safeUnitPrice) + ' DA', cols.pu, rowY + 5, { width: 80, align: 'right', lineBreak: false })
          .font('Helvetica-Bold')
          .text(formatPrice(lineTotal) + ' DA', cols.total, rowY + 5, { width: 90, align: 'right', lineBreak: false });

        rowY += rowHeight;
      });
    }

    doc
      .strokeColor(colors.border)
      .lineWidth(1)
      .rect(leftX, tableTop, contentWidth, rowY - tableTop)
      .stroke();

    const spacingAfterTable = 10;
    let totalsY = rowY + spacingAfterTable;
    const totalsBoxHeight = 70;
    const totalsWidth = 220;
    const totalsX = leftX + contentWidth - totalsWidth;
    const conditionsX = leftX;
    const conditionsW = contentWidth;
    const conditionsH = 92;
    const footerBuffer = 18;
    const requiredHeight = totalsBoxHeight + conditionsH + footerBuffer;

    if (totalsY + requiredHeight > pageBottom) {
      doc.addPage({ size: 'A4', layout: 'portrait', margin: 28 });
      totalsY = 28;
    }

    doc
      .rect(totalsX, totalsY, totalsWidth, totalsBoxHeight)
      .fill(colors.light)
      .stroke(colors.border);

    const totalLine = (label, value, y) => {
      doc
        .font('Helvetica')
        .fontSize(8)
        .fillColor(colors.muted)
        .text(label, totalsX + 10, y)
        .font('Helvetica-Bold')
        .fontSize(10)
        .fillColor(colors.text)
        .text(value, totalsX + 100, y, { width: 100, align: 'right' });
    };

    totalLine('Montant H.T.', formatPrice(montantHT) + ' DA', totalsY + 14);
    totalLine(`TVA (0%)`, formatPrice(montantTVA) + ' DA', totalsY + 34);

    doc
      .moveTo(totalsX + 10, totalsY + 54)
      .lineTo(totalsX + 206, totalsY + 54)
      .lineWidth(1)
      .stroke(colors.border);

    doc
      .font('Helvetica-Bold')
      .fontSize(11)
      .fillColor(colors.primary)
      .text('TOTAL TTC', totalsX + 10, totalsY + 60)
      .text(formatPrice(montantTTC) + ' DA', totalsX + 100, totalsY + 60, { width: 100, align: 'right' });

    const conditionsY = totalsY + totalsBoxHeight + 12;

    doc
      .rect(conditionsX, conditionsY, conditionsW, conditionsH)
      .fill(colors.white)
      .stroke(colors.border);

    doc
      .font('Helvetica-Bold')
      .fontSize(10)
      .fillColor(colors.primary)
      .text('CONDITIONS', conditionsX + 12, conditionsY + 12);

    const conditionTextX = conditionsX + 12;
    const conditionWidth = conditionsW - 20;
    const conditionLineHeight = 20;
    const conditionLines = [
      `• Paiement : ${PAYMENT_TERMS.advance}% à la commande • ${PAYMENT_TERMS.onDelivery}% à la livraison • ${PAYMENT_TERMS.afterInstallation}% après installation`,
      `• Livraison : ${DELIVERY_TERMS.text || DELIVERY_TERMS}`,
      `• Validité : ${QUOTE_VALIDITY.text || `Valable ${QUOTE_VALIDITY.days || 0} jours`}`
    ];

    doc.font('Helvetica').fontSize(8).fillColor(colors.muted);
    let currentConditionY = conditionsY + 30;
    conditionLines.forEach((line) => {
      doc.text(line, conditionTextX, currentConditionY, {
        width: conditionWidth,
        lineBreak: false
      });
      currentConditionY += conditionLineHeight;
    });

    const signatureY = pageBottom - 36;
    const signatureWidth = 120;
    doc
      .font('Helvetica-Bold')
      .fontSize(10)
      .fillColor(colors.primary)
      .text('Signature', rightX - signatureWidth, signatureY, {
        width: signatureWidth,
        align: 'center'
      });
    doc
      .moveTo(rightX - signatureWidth + 10, signatureY + 18)
      .lineTo(rightX - 10, signatureY + 18)
      .lineWidth(0.8)
      .stroke(colors.border);

    doc.end();
  } catch (err) {
    next(err);
  }
};

module.exports = {
  listBons,
  getBon,
  createBon,
  updateBon,
  deleteBon,
  generatePDF,
  parseBonDescription,
  formatDate,
  calculateLineTotal
};
