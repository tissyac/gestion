/**
 * Contrôleur pour la gestion des factures
 * ========================================
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

const calculateLineTotal = (article) => {
  const quantity = Number(article?.quantite ?? 0);
  const unitPrice = Number(article?.prix_unitaire ?? 0);
  const total = Number.isFinite(quantity) && Number.isFinite(unitPrice) ? quantity * unitPrice : 0;
  return Number.isFinite(total) ? total : 0;
};

const calculateInvoiceTotal = (articles = []) =>
  articles.reduce((sum, article) => sum + calculateLineTotal(article), 0);

const parseFactureDescription = (descriptionValue) => {
  const fallback = {
    description: '',
    articles: [],
    clientPhone: '-',
    clientEmail: '-',
    clientAddress: '',
    tva: 0
  };

  if (!descriptionValue) return fallback;

  if (typeof descriptionValue === 'object') {
    return {
      description: descriptionValue.description || '',
      articles: Array.isArray(descriptionValue.articles) ? descriptionValue.articles : [],
      clientPhone: descriptionValue.client_telephone || descriptionValue.clientPhone || '-',
      clientEmail: descriptionValue.client_email || descriptionValue.clientEmail || '-',
      clientAddress: descriptionValue.client_adresse || descriptionValue.clientAddress || '',
      tva: Number(descriptionValue.tva ?? descriptionValue.TVA ?? 0) || 0
    };
  }

  if (typeof descriptionValue !== 'string') return fallback;

  try {
    const parsed = JSON.parse(descriptionValue);
    if (parsed && typeof parsed === 'object') {
      return {
        description: parsed.description || '',
        articles: Array.isArray(parsed.articles) ? parsed.articles : [],
        clientPhone: parsed.client_telephone || parsed.clientPhone || '-',
        clientEmail: parsed.client_email || parsed.clientEmail || '-',
        clientAddress: parsed.client_adresse || parsed.clientAddress || '',
        tva: Number(parsed.tva ?? parsed.TVA ?? 0) || 0
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
 * Liste toutes les factures
 */
const listFactures = async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, parseInt(req.query.limit) || 20);
    const offset = (page - 1) * limit;

    const result = await query(
      `SELECT * FROM factures 
       ORDER BY created_at DESC 
       LIMIT $1 OFFSET $2`,
      [limit, offset]
    );

    const countResult = await query('SELECT COUNT(*) FROM factures');
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
 * Récupère une facture par ID
 */
const getFacture = async (req, res, next) => {
  try {
    const { id } = req.params;

    const result = await query(
      'SELECT * FROM factures WHERE id = $1',
      [id]
    );

    if (result.rows.length === 0) {
      throw new AppError('Facture non trouvée', 404);
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
 * Crée une nouvelle facture
 */
const createFacture = async (req, res, next) => {
  try {
    const {
      numero,
      client,
      montant,
      description,
      articles = [],
      client_telephone,
      client_email,
      client_adresse,
      date_facture,
      tva
    } = req.body;

    if (!numero || !client || montant === undefined) {
      throw new AppError('Champs requis: numero, client, montant', 400);
    }

    const safeTotal = Number.isFinite(Number(montant)) ? Number(montant) : calculateInvoiceTotal(articles);
    const safeTva = Number(tva) || 0;
    const descriptionPayload = JSON.stringify({
      description: description || '',
      articles: Array.isArray(articles) ? articles.map((article) => ({
        ...article,
        quantite: Number(article.quantite) || 0,
        prix_unitaire: Number(article.prix_unitaire) || 0,
        total_ligne: calculateLineTotal(article)
      })) : [],
      client_telephone: (client_telephone || '').toString().trim(),
      client_email: (client_email || '').toString().trim(),
      client_adresse: (client_adresse || '').toString().trim(),
      date_facture: date_facture || null,
      tva: safeTva
    });

    const id = uuidv4();
    await query(
      `INSERT INTO factures (id, numero, client, montant, description, statut, date_facture, created_at, user_id) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), $8)`,
      [id, numero, client, safeTotal, descriptionPayload, 'EN_ATTENTE', date_facture || null, req.user.id]
    );

    const created = await query('SELECT * FROM factures WHERE id = $1', [id]);

    res.status(201).json({
      success: true,
      message: 'Facture créée avec succès',
      data: created.rows[0]
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Modifie une facture
 */
const updateFacture = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { numero, client, montant, description, statut } = req.body;

    const existingResult = await query(
      'SELECT * FROM factures WHERE id = $1',
      [id]
    );

    if (existingResult.rows.length === 0) {
      throw new AppError('Facture non trouvée', 404);
    }

    const updates = [];
    const values = [];
    let paramCount = 1;

    if (numero !== undefined) {
      updates.push(`numero = $${paramCount++}`);
      values.push(numero);
    }
    if (client !== undefined) {
      updates.push(`client = $${paramCount++}`);
      values.push(client);
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

    if (updates.length === 0) {
      throw new AppError('Aucun champ à mettre à jour', 400);
    }

    updates.push('updated_at = NOW()');
    values.push(id);

    await query(
      `UPDATE factures SET ${updates.join(', ')} WHERE id = $${paramCount}`,
      values
    );

    const updated = await query('SELECT * FROM factures WHERE id = $1', [id]);

    res.json({
      success: true,
      message: 'Facture modifiée avec succès',
      data: updated.rows[0]
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Supprime une facture
 */
const deleteFacture = async (req, res, next) => {
  try {
    const { id } = req.params;

    const result = await query(
      'DELETE FROM factures WHERE id = $1',
      [id]
    );

    if (result.rowCount === 0) {
      throw new AppError('Facture non trouvée', 404);
    }

    res.json({
      success: true,
      message: 'Facture supprimée avec succès'
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Génère un PDF de la facture
 */
const generatePDF = async (req, res, next) => {
  try {
    const { id } = req.params;

    const result = await query(
      'SELECT * FROM factures WHERE id = $1',
      [id]
    );

    if (result.rows.length === 0) {
      throw new AppError('Facture non trouvée', 404);
    }

    const facture = result.rows[0];
    const parsedDescription = parseFactureDescription(facture.description);
    const montantHT = Number(facture.montant || calculateInvoiceTotal(parsedDescription.articles) || 0);
    const montantTVA = (Number(parsedDescription.tva) || 0) > 0 ? (montantHT * (Number(parsedDescription.tva) || 0)) / 100 : 0;
    const montantTTC = montantHT + montantTVA;

    const formatPrice = (num) => {
      const text = new Intl.NumberFormat('fr-FR', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      }).format(num);
      return text.replace(/\u202f/g, ' ');
    };

    const formatDate = (value) => {
      if (!value) return new Date().toLocaleDateString('fr-FR');
      if (/^\d{4}-\d{2}-\d{2}/.test(value)) {
        const [year, month, day] = value.split('-').map(Number);
        return new Date(year, month - 1, day).toLocaleDateString('fr-FR');
      }
      return new Date(value).toLocaleDateString('fr-FR');
    };

    const invoiceDate = facture.date_facture || facture.created_at;
    const clientName = facture.client || '-';
    const contactEmail = parsedDescription.clientEmail || '-';
    const contactPhone = parsedDescription.clientPhone || '-';
    const storedArticles = parsedDescription.articles.length > 0 ? parsedDescription.articles : [{
      designation: parsedDescription.description || 'Montant de la facture',
      unite: 'forfait',
      quantite: 1,
      prix_unitaire: montantHT,
      total_ligne: montantHT
    }];

    const items = storedArticles.length > 0 ? storedArticles : [{
      designation: facture.description || 'Montant de la facture',
      unite: 'forfait',
      quantite: 1,
      prix_unitaire: montantHT,
      total_ligne: montantHT
    }];

    const logoPath = path.resolve(__dirname, '../../public', COMPANY_INFO.logo.replace(/^\//, ''));
    const hasLogo = fs.existsSync(logoPath);

    const doc = new PDFDocument({ size: 'A4', layout: 'portrait', margin: 28 });
    const fileName = `Facture_${facture.numero}.pdf`;
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
      .text('FACTURE', leftX + 14, topY + 18);

    doc
      .font('Helvetica')
      .fontSize(10)
      .fillColor(colors.text)
      .text(`N° ${facture.numero}`, leftX + 14, topY + 62)
      .text(`Date : ${formatDate(invoiceDate)}`, leftX + 220, topY + 62);

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
    const rcFontCandidates = [
      'C:/Windows/Fonts/arial.ttf',
      'C:/Windows/Fonts/Arial.ttf',
      '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',
      '/usr/share/fonts/truetype/liberation2/LiberationSans-Regular.ttf'
    ];
    let rcFontName = 'Helvetica';
    for (const candidate of rcFontCandidates) {
      if (fs.existsSync(candidate)) {
        try {
          doc.registerFont('rc-font', candidate);
          rcFontName = 'rc-font';
          break;
        } catch (error) {
          console.warn('Impossible d’enregistrer la police PDF:', error.message);
        }
      }
    }

    const rcText = '14 B0188021';

    doc
      .font(rcFontName)
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
      .text('Client', clientBoxX + 10, clientBoxY + 10);

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

        doc
          .font('Helvetica')
          .fontSize(tableFontSize)
          .fillColor(colors.text)
          .text(index + 1, cols.no, rowY + 5, { width: 24, align: 'center' })
          .text(descriptionText, cols.desc, rowY + 5, { width: 228 })
          .text(article.unite || 'pièce', cols.unit, rowY + 5, { width: 40, align: 'center' })
          .text(String(article.quantite), cols.qty, rowY + 5, { width: 34, align: 'center' })
          .text(formatPrice(article.prix_unitaire) + ' DA', cols.pu, rowY + 5, { width: 80, align: 'right', lineBreak: false })
          .font('Helvetica-Bold')
          .text(formatPrice(article.total_ligne) + ' DA', cols.total, rowY + 5, { width: 90, align: 'right', lineBreak: false });

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

    const safeTotalValue = Number.isFinite(montantHT) ? montantHT : 0;

    totalLine('Montant H.T.', formatPrice(safeTotalValue) + ' DA', totalsY + 14);
    totalLine(`TVA (${Number(parsedDescription.tva) || 0}%)`, formatPrice(montantTVA) + ' DA', totalsY + 34);

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
  parseFactureDescription,
  calculateInvoiceTotal,
  listFactures,
  getFacture,
  createFacture,
  updateFacture,
  deleteFacture,
  generatePDF
};
