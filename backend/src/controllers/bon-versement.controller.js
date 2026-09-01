/**
 * Contrôleur pour la gestion des bons de versement
 * =================================================
 * 
 * Opérations CRUD et génération PDF
 */

const fs = require('fs');
const path = require('path');
const PDFDocument = require('pdfkit');
const { AppError } = require('../middleware/errorHandler');
const { query } = require('../config/database');
const { v4: uuidv4 } = require('uuid');
const { COMPANY_INFO } = require('../config/company');

const formatCurrency = (value) => {
  const numericValue = Number(value || 0);
  const formatted = numericValue.toLocaleString('fr-FR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
  return formatted.replace(/\u202F/g, ' ');
};

const parseBonDescription = (description) => {
  if (!description) return {};
  try {
    return typeof description === 'string' ? JSON.parse(description) : description;
  } catch (err) {
    return {};
  }
};

/**
 * Liste tous les bons de versement
 */
const listBons = async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, parseInt(req.query.limit) || 20);
    const offset = (page - 1) * limit;

    const result = await query(
      `SELECT * FROM bons_versement 
       ORDER BY created_at DESC 
       LIMIT $1 OFFSET $2`,
      [limit, offset]
    );

    const countResult = await query('SELECT COUNT(*) FROM bons_versement');
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
 * Récupère un bon de versement par ID
 */
const getBon = async (req, res, next) => {
  try {
    const { id } = req.params;

    const result = await query('SELECT * FROM bons_versement WHERE id = $1', [id]);

    if (result.rows.length === 0) {
      throw new AppError('Bon de versement non trouvé', 404);
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
 * Crée un nouveau bon de versement
 */
const createBon = async (req, res, next) => {
  try {
    const {
      numero,
      total_global,
      montant_verse,
      montant_a_verser,
      reste_a_payer,
      date_versement,
      beneficiaire_nom,
      beneficiaire_prenom,
      beneficiaire_entreprise,
      beneficiaire_adresse,
      beneficiaire_telephone,
      beneficiaire_email,
      emetteur_nom,
      emetteur_prenom,
      emetteur_adresse,
      emetteur_telephone,
      emetteur_email,
      articles = [],
      tva = 0
    } = req.body;

    const emitterNom = emetteur_nom || beneficiaire_nom || '';
    const emitterPrenom = emetteur_prenom || beneficiaire_prenom || '';
    const emitterAdresse = emetteur_adresse || beneficiaire_adresse || '';
    const emitterTelephone = emetteur_telephone || beneficiaire_telephone || '';
    const emitterEmail = emetteur_email || beneficiaire_email || '';

    if (!numero || total_global === undefined || (!montant_verse && !montant_a_verser) || !emitterNom || !emitterPrenom) {
      throw new AppError('Champs requis: numero, total_global, montant_verse, emetteur_nom, emetteur_prenom', 400);
    }

    const id = uuidv4();
    const tg = Number(total_global) || 0;
    const mv = Number(montant_verse ?? montant_a_verser ?? 0) || 0;
    const reste = Number(reste_a_payer ?? Math.max(0, tg - mv)) || 0;
    const normalizedArticles = Array.isArray(articles) ? articles : [];
    const montantHT = normalizedArticles.reduce((sum, article) => sum + ((Number(article.quantite) || 0) * (Number(article.prix_unitaire) || 0)), 0);
    const montantTVA = Number(tva) ? (montantHT * Number(tva) / 100) : 0;
    const montantTTC = Number(total_global) || montantHT + montantTVA;
    const documentPayload = {
      articles: normalizedArticles,
      tva: Number(tva) || 0,
      montant_ht: montantHT,
      montant_tva: montantTVA,
      montant_ttc: montantTTC,
      montant_a_verser: mv,
      reste_a_payer: reste
    };

    await query(
      `INSERT INTO bons_versement (
        id, numero, montant, total_global, montant_verse, montant_reste, description, statut, date_versement,
        beneficiaire_nom, beneficiaire_prenom, beneficiaire_entreprise, beneficiaire_adresse,
        beneficiaire_telephone, beneficiaire_email, user_id, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, NOW())`,
      [
        id,
        numero,
        mv,
        tg,
        mv,
        reste,
        JSON.stringify(documentPayload),
        'EN_ATTENTE',
        date_versement || null,
        emitterNom,
        emitterPrenom,
        beneficiaire_entreprise || '',
        emitterAdresse,
        emitterTelephone,
        emitterEmail,
        req.user.id
      ]
    );

    const created = await query('SELECT * FROM bons_versement WHERE id = $1', [id]);

    res.status(201).json({
      success: true,
      message: 'Bon de versement créé avec succès',
      data: created.rows[0]
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Modifie un bon de versement
 */
const updateBon = async (req, res, next) => {
  try {
    const { id } = req.params;
    const {
      numero,
      total_global,
      montant_verse,
      description,
      statut,
      date_versement,
      beneficiaire_nom,
      beneficiaire_prenom,
      beneficiaire_entreprise,
      beneficiaire_adresse,
      beneficiaire_telephone,
      beneficiaire_email
    } = req.body;

    const existingResult = await query(
      'SELECT * FROM bons_versement WHERE id = $1',
      [id]
    );

    if (existingResult.rows.length === 0) {
      throw new AppError('Bon de versement non trouvé', 404);
    }

    const updates = [];
    const values = [];
    let paramCount = 1;

    const fields = {
      numero,
      total_global: total_global !== undefined ? Number(total_global) : undefined,
      montant_verse: montant_verse !== undefined ? Number(montant_verse) : undefined,
      montant: montant_verse !== undefined ? Number(montant_verse) : undefined,
      montant_reste: total_global !== undefined && montant_verse !== undefined ? Math.max(0, Number(total_global) - Number(montant_verse)) : undefined,
      description,
      statut,
      date_versement,
      beneficiaire_nom,
      beneficiaire_prenom,
      beneficiaire_entreprise,
      beneficiaire_adresse,
      beneficiaire_telephone,
      beneficiaire_email
    };

    Object.entries(fields).forEach(([fieldName, fieldValue]) => {
      if (fieldValue !== undefined) {
        updates.push(`${fieldName} = $${paramCount++}`);
        values.push(fieldValue);
      }
    });

    if (updates.length === 0) {
      throw new AppError('Aucun champ à mettre à jour', 400);
    }

    updates.push('updated_at = NOW()');
    values.push(id);

    await query(
      `UPDATE bons_versement SET ${updates.join(', ')} WHERE id = $${paramCount}`,
      values
    );

    const updated = await query('SELECT * FROM bons_versement WHERE id = $1', [id]);

    res.json({
      success: true,
      message: 'Bon de versement modifié avec succès',
      data: updated.rows[0]
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Supprime un bon de versement
 */
const deleteBon = async (req, res, next) => {
  try {
    const { id } = req.params;

    const result = await query(
      'DELETE FROM bons_versement WHERE id = $1',
      [id]
    );

    if (result.rowCount === 0) {
      throw new AppError('Bon de versement non trouvé', 404);
    }

    res.json({
      success: true,
      message: 'Bon de versement supprimé avec succès'
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Génère un PDF du bon de versement
 */
const generatePDF = async (req, res, next) => {
  try {
    const { id } = req.params;

    const result = await query(
      'SELECT * FROM bons_versement WHERE id = $1',
      [id]
    );

    if (result.rows.length === 0) {
      throw new AppError('Bon de versement non trouvé', 404);
    }

    const bon = result.rows[0];
    const doc = new PDFDocument({ size: 'A4', layout: 'portrait', margin: 28 });
    const fileName = `Bon_de_versement_${bon.numero}.pdf`;
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.setHeader('Content-Type', 'application/pdf');
    doc.pipe(res);

    const logoPath = path.resolve(__dirname, '../../public', COMPANY_INFO.logo.replace(/^\//, ''));
    const hasLogo = fs.existsSync(logoPath);

    const colors = {
      primary: '#B7791F',
      text: '#111111',
      muted: '#6B7280',
      border: '#B7791F',
      white: '#FFFFFF',
      light: '#F8F4EA'
    };

    const leftX = 28;
    const rightX = doc.page.width - 28;
    const contentWidth = rightX - leftX;
    const topY = 28;
    const pageHeaderHeight = 80;

    doc.rect(leftX, topY, contentWidth, pageHeaderHeight).fill(colors.light).stroke(colors.border);
    if (hasLogo) {
      doc.image(logoPath, rightX - 110, topY + 12, { fit: [90, 60], align: 'right' });
    }

    doc.font('Helvetica-Bold').fontSize(34).fillColor(colors.primary).text('BON DE VERSEMENT', leftX + 14, topY + 18);
    doc.font('Helvetica').fontSize(10).fillColor(colors.text).text(`N° ${bon.numero}`, leftX + 14, topY + 62).text(`Date : ${new Date(bon.date_versement || bon.created_at).toLocaleDateString('fr-FR')}`, leftX + 220, topY + 62);

    const companyBoxY = topY + pageHeaderHeight + 12;
    const companyBoxH = 128;
    const companyBoxW = Math.round((contentWidth - 12) / 2);
    const companyBoxX = leftX;
    const clientBoxX = leftX + companyBoxW + 12;
    const clientBoxW = contentWidth - companyBoxW - 12;
    const clientBoxY = companyBoxY;
    const clientBoxH = companyBoxH;

    doc.rect(companyBoxX, companyBoxY, companyBoxW, companyBoxH).fill(colors.white).stroke(colors.border);
    doc.font('Helvetica-Bold').fontSize(14).fillColor(colors.primary).text('Société', companyBoxX + 10, companyBoxY + 10);
    doc.font('Helvetica-Bold').fontSize(11).fillColor(colors.text).text(COMPANY_INFO.name, companyBoxX + 10, companyBoxY + 28, { width: companyBoxW - 20 });
    doc.font('Helvetica-Bold').fontSize(9).fillColor(colors.text).text('RC :', companyBoxX + 10, companyBoxY + 49);
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
    doc.font(rcFontName).fontSize(9).fillColor(colors.muted).text(rcText, companyBoxX + 35, companyBoxY + 49, { width: companyBoxW - 45 });
    doc.font('Helvetica-Bold').fontSize(9).fillColor(colors.text).text('NIF :', companyBoxX + 10, companyBoxY + 62);
    doc.font('Helvetica').fontSize(9).fillColor(colors.muted).text('001406018802120', companyBoxX + 35, companyBoxY + 62, { width: companyBoxW - 45 });
    doc.font('Helvetica-Bold').fontSize(9).fillColor(colors.text).text('NIS :', companyBoxX + 10, companyBoxY + 75);
    doc.font('Helvetica').fontSize(9).fillColor(colors.muted).text('0 014 0633 00075 61', companyBoxX + 35, companyBoxY + 75, { width: companyBoxW - 45 });
    doc.font('Helvetica-Bold').fontSize(9).fillColor(colors.text).text('Tél :', companyBoxX + 10, companyBoxY + 90);
    doc.font('Helvetica').fontSize(9).fillColor(colors.muted).text(`${COMPANY_INFO.phone} / ${COMPANY_INFO.mobile1} / ${COMPANY_INFO.mobile2}`, companyBoxX + 35, companyBoxY + 90, { width: companyBoxW - 45 });
    doc.font('Helvetica-Bold').fontSize(9).fillColor(colors.text).text('Email :', companyBoxX + 10, companyBoxY + 104);
    doc.font('Helvetica').fontSize(9).fillColor(colors.muted).text(` ${COMPANY_INFO.email || '-'}`, companyBoxX + 50, companyBoxY + 104, { width: companyBoxW - 60 });
    doc.font('Helvetica').fontSize(9).fillColor(colors.muted).text('Village Iryahen commune Tala hamza Bejaia', companyBoxX + 10, companyBoxY + 118, { width: companyBoxW - 20, lineGap: 1 });

    const emetteurName = [bon.beneficiaire_prenom, bon.beneficiaire_nom].filter(Boolean).join(' ').trim() || 'Émetteur';
    const emetteurDetails = [bon.beneficiaire_entreprise, bon.beneficiaire_adresse, bon.beneficiaire_telephone, bon.beneficiaire_email]
      .filter(Boolean)
      .join('\n');

    doc.rect(clientBoxX, clientBoxY, clientBoxW, clientBoxH).fill(colors.white).stroke(colors.border);
    doc.font('Helvetica-Bold').fontSize(14).fillColor(colors.primary).text('Émetteur', clientBoxX + 10, clientBoxY + 10);
    doc.font('Helvetica-Bold').fontSize(12).fillColor(colors.text).text(emetteurName, clientBoxX + 10, clientBoxY + 32, { width: clientBoxW - 20 });
    doc.font('Helvetica-Bold').fontSize(10).fillColor(colors.text).text('Tél :', clientBoxX + 10, clientBoxY + 56);
    doc.font('Helvetica').fontSize(10).fillColor(colors.muted).text(bon.beneficiaire_telephone || '-', clientBoxX + 42, clientBoxY + 56, { width: clientBoxW - 52 });
    doc.font('Helvetica-Bold').fontSize(10).fillColor(colors.text).text('Email :', clientBoxX + 10, clientBoxY + 72);
    doc.font('Helvetica').fontSize(10).fillColor(colors.muted).text(bon.beneficiaire_email || '-', clientBoxX + 52, clientBoxY + 72, { width: clientBoxW - 62 });
    doc.font('Helvetica').fontSize(9).fillColor(colors.muted).text(emetteurDetails || '-', clientBoxX + 10, clientBoxY + 92, { width: clientBoxW - 20, lineGap: 1 });

    const documentPayload = parseBonDescription(bon.description);
    const articles = Array.isArray(documentPayload.articles) && documentPayload.articles.length > 0
      ? documentPayload.articles
      : [];
    const tvaValue = Number(documentPayload.tva ?? 0) || 0;
    const montantHT = Number(documentPayload.montant_ht ?? bon.montant ?? 0) || 0;
    const montantTVA = Number(documentPayload.montant_tva ?? (tvaValue ? montantHT * tvaValue / 100 : 0)) || 0;
    const montantTTC = Number(documentPayload.montant_ttc ?? bon.total_global ?? montantHT + montantTVA) || 0;
    const mv = Number(documentPayload.montant_a_verser ?? bon.montant_verse ?? 0) || 0;
    const resteValue = Number(documentPayload.reste_a_payer ?? bon.montant_reste ?? Math.max(0, montantTTC - mv)) || 0;

    const tableTop = clientBoxY + clientBoxH + 14;
    const rowHeight = 18;
    const tableHeaderHeight = 24;
    const pageBottom = doc.page.height - 28;

    doc.rect(leftX, tableTop, contentWidth, tableHeaderHeight).fill(colors.primary);
    const cols = {
      no: leftX + 8,
      desc: leftX + 36,
      unit: leftX + 268,
      qty: leftX + 312,
      pu: leftX + 354,
      total: leftX + 442
    };

    doc.font('Helvetica-Bold').fontSize(9).fillColor(colors.white)
      .text('N°', cols.no, tableTop + 8, { width: 24, align: 'center' })
      .text('Désignation', cols.desc, tableTop + 8, { width: 228 })
      .text('Unité', cols.unit, tableTop + 8, { width: 40, align: 'center' })
      .text('Qté', cols.qty, tableTop + 8, { width: 34, align: 'center' })
      .text('P.U.', cols.pu, tableTop + 8, { width: 80, align: 'right' })
      .text('Total', cols.total, tableTop + 8, { width: 90, align: 'right' });

    let rowY = tableTop + tableHeaderHeight;
    const tableFontSize = 8;

    if (articles.length === 0) {
      doc.rect(leftX, rowY, contentWidth, rowHeight).fill(colors.light).stroke(colors.border);
      doc.font('Helvetica').fontSize(9).fillColor(colors.muted).text('Aucun article', cols.desc, rowY + 8);
      rowY += rowHeight;
    } else {
      articles.forEach((article, index) => {
        const rowColor = index % 2 === 0 ? colors.white : colors.light;
        doc.rect(leftX, rowY, contentWidth, rowHeight).fill(rowColor).stroke(colors.border);
        const description = (article.designation || '').length > 42
          ? `${(article.designation || '').substring(0, 39)}...`
          : (article.designation || '');
        const quantity = Number(article.quantite) || 0;
        const unitPrice = Number(article.prix_unitaire) || 0;
        const lineTotal = quantity * unitPrice;

        doc.font('Helvetica').fontSize(tableFontSize).fillColor(colors.text)
          .text(index + 1, cols.no, rowY + 5, { width: 24, align: 'center' })
          .text(description, cols.desc, rowY + 5, { width: 228 })
          .text(article.unite || 'pièce', cols.unit, rowY + 5, { width: 40, align: 'center' })
          .text(quantity.toString(), cols.qty, rowY + 5, { width: 34, align: 'center' })
          .text(formatCurrency(unitPrice) + ' DA', cols.pu, rowY + 5, { width: 80, align: 'right', lineBreak: false })
          .font('Helvetica-Bold')
          .text(formatCurrency(lineTotal) + ' DA', cols.total, rowY + 5, { width: 90, align: 'right', lineBreak: false });

        rowY += rowHeight;
      });
    }

    doc.strokeColor(colors.border).lineWidth(1).rect(leftX, tableTop, contentWidth, rowY - tableTop).stroke();

    const spacingAfterTable = 10;
    let totalsY = rowY + spacingAfterTable;
    const totalsBoxHeight = 112;
    const totalsWidth = 220;
    const totalsX = leftX + contentWidth - totalsWidth;
    const paymentX = leftX;
    const paymentW = contentWidth;
    const paymentH = 0;
    const footerBuffer = 18;
    const requiredHeight = totalsBoxHeight + paymentH + footerBuffer;

    if (totalsY + requiredHeight > pageBottom) {
      doc.addPage({ size: 'A4', layout: 'portrait', margin: 28 });
      totalsY = 28;
    }

    doc.rect(totalsX, totalsY, totalsWidth, totalsBoxHeight).fill(colors.light).stroke(colors.border);
    const totalLine = (label, value, y) => {
      doc.font('Helvetica').fontSize(8).fillColor(colors.muted).text(label, totalsX + 10, y)
        .font('Helvetica-Bold').fontSize(10).fillColor(colors.text).text(value, totalsX + 100, y, { width: 100, align: 'right' });
    };
    totalLine('Montant H.T.', formatCurrency(montantHT) + ' DA', totalsY + 14);
    totalLine(`TVA (${tvaValue}%)`, formatCurrency(montantTVA) + ' DA', totalsY + 34);
    doc.moveTo(totalsX + 10, totalsY + 54).lineTo(totalsX + 206, totalsY + 54).lineWidth(1).stroke(colors.border);
    doc.font('Helvetica-Bold').fontSize(11).fillColor(colors.primary).text('TOTAL TTC', totalsX + 10, totalsY + 60).text(formatCurrency(montantTTC) + ' DA', totalsX + 100, totalsY + 60, { width: 100, align: 'right' });
    doc.font('Helvetica-Bold').fontSize(10).fillColor('#111111').text('Montant versé', totalsX + 10, totalsY + 80).text(formatCurrency(mv) + ' DA', totalsX + 100, totalsY + 80, { width: 100, align: 'right' });
    doc.font('Helvetica-Bold').fontSize(10).fillColor('#B91C1C').text('Montant restant', totalsX + 10, totalsY + 96).text(formatCurrency(resteValue) + ' DA', totalsX + 100, totalsY + 96, { width: 100, align: 'right' });

    const sigY = pageBottom - 36;
    const sigX = rightX - 120;
    doc.font('Helvetica-Bold').fontSize(10).fillColor(colors.primary).text('Signature', sigX, sigY, { width: 120, align: 'center' });
    doc.moveTo(sigX + 10, sigY + 18).lineTo(rightX - 10, sigY + 18).lineWidth(0.8).stroke(colors.border);

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
  generatePDF
};
