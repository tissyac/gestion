/**
 * Contrôleur pour la gestion des devis
 * =====================================
 * 
 * Structure complète avec:
 * - Client (nom, prénom, adresse, téléphone)
 * - Articles (désignation, quantité, prix)
 * - Calculs automatiques (totaux, TVA, TTC)
 * - Informations de l'entreprise (fixes)
 */

const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { AppError } = require('../middleware/errorHandler');
const { query } = require('../config/database');
const { COMPANY_INFO, PAYMENT_TERMS, DELIVERY_TERMS, QUOTE_VALIDITY, TVAS } = require('../config/company');


/**
 * Liste tous les devis avec leurs totaux
 */
const listDevis = async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, parseInt(req.query.limit) || 20);
    const offset = (page - 1) * limit;

    const result = query(
      `SELECT 
        d.*,
        COALESCE(SUM(da.quantite * da.prix_unitaire), 0) as montant_ht
       FROM devis d
       LEFT JOIN devis_articles da ON d.id = da.devis_id
       GROUP BY d.id
       ORDER BY d.created_at DESC 
       LIMIT ? OFFSET ?`,
      [limit, offset]
    );

    const countResult = query('SELECT COUNT(*) as count FROM devis WHERE user_id = ?', [req.user.id]);
    const total = countResult.rows[0]?.count || 0;

    // Calcule les totaux TTC pour chaque devis
    const devisList = result.rows.map(devis => ({
      ...devis,
      montantHT: devis.montant_ht,
      montantTVA: devis.tva ? (devis.montant_ht * devis.tva / 100) : 0,
      montantTTC: devis.montant_ht + (devis.tva ? (devis.montant_ht * devis.tva / 100) : 0)
    }));

    res.json({
      success: true,
      data: devisList,
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
 * Récupère un devis par ID avec tous ses détails
 */
const getDevis = async (req, res, next) => {
  try {
    const { id } = req.params;

    const devisResult = query(
      'SELECT * FROM devis WHERE id = ?',
      [id]
    );

    if (devisResult.rows.length === 0) {
      throw new AppError('Devis non trouvé', 404);
    }

    const devis = devisResult.rows[0];

    // Récupère les articles du devis
    const articlesResult = query(
      `SELECT id, numero_ligne, designation, unite, quantite, prix_unitaire,
              (quantite * prix_unitaire) as total_ligne
       FROM devis_articles 
       WHERE devis_id = ?
       ORDER BY numero_ligne ASC`,
      [id]
    );

    devis.articles = articlesResult.rows || [];
    devis.company = COMPANY_INFO;
    devis.paymentTerms = PAYMENT_TERMS;
    devis.deliveryTerms = DELIVERY_TERMS;
    devis.quoteValidity = QUOTE_VALIDITY;

    // Calcule les totaux
    const montantHT = devis.articles.reduce((sum, article) => 
      sum + (article.quantite * article.prix_unitaire), 0
    );

    devis.montantHT = montantHT;
    devis.montantTVA = devis.tva ? (montantHT * devis.tva / 100) : 0;
    devis.montantTTC = montantHT + devis.montantTVA;

    res.json({
      success: true,
      data: devis
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Crée un nouveau devis
 */
const createDevis = async (req, res, next) => {
  try {
    const { numero, date_devis, client_nom, client_prenom, client_adresse, client_telephone, client_email, articles, tva } = req.body;

    // Validations
    if (!numero || !client_nom || !client_prenom || !client_telephone) {
      throw new AppError('Champs requis: numero, client_nom, client_prenom, client_telephone', 400);
    }

    if (!articles || !Array.isArray(articles) || articles.length === 0) {
      throw new AppError('Au moins un article est requis', 400);
    }

    // Vérifie que le numéro est unique
    const existingDevis = query(
      'SELECT numero FROM devis WHERE numero = ?',
      [numero]
    );

    if (existingDevis.rows.length > 0) {
      throw new AppError('Ce numéro de devis existe déjà', 400);
    }

    const id = uuidv4();
    const now = new Date().toISOString();
    const devisDate = date_devis || new Date().toISOString().slice(0, 10);

    // Crée le devis
    query(
      `INSERT INTO devis (
        id, numero, client_nom, client_prenom, client_adresse, client_telephone, client_email, date_devis,
        tva, statut, created_at, updated_at, user_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)` ,
      [
        id, numero, client_nom, client_prenom, client_adresse || '', client_telephone,
        client_email || '', devisDate, tva || 0, 'BROUILLON', now, now, req.user.id
      ]
    );

    // Ajoute les articles du devis
    articles.forEach((article, index) => {
      if (!article.designation || article.quantite === undefined || article.prix_unitaire === undefined) {
        throw new AppError('Chaque article doit avoir: designation, quantite, prix_unitaire', 400);
      }

      const articleId = uuidv4();
      query(
        `INSERT INTO devis_articles (
          id, devis_id, numero_ligne, designation, unite, quantite, prix_unitaire
        ) VALUES (?, ?, ?, ?, ?, ?, ?)` ,
        [
          articleId, id, index + 1, article.designation, article.unite || 'pièce',
          parseFloat(article.quantite), parseFloat(article.prix_unitaire)
        ]
      );
    });

    // Récupère le devis complet créé
    const newDevisResult = query('SELECT * FROM devis WHERE id = ?', [id]);
    const newDevis = newDevisResult.rows[0];

    res.status(201).json({
      success: true,
      message: 'Devis créé avec succès',
      data: newDevis
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Modifie un devis
 */
const updateDevis = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { numero, date_devis, client_nom, client_prenom, client_adresse, client_telephone, client_email, articles, tva, statut } = req.body;

    // Vérifie que le devis existe
    const existingDevis = query(
      'SELECT * FROM devis WHERE id = ?',
      [id]
    );

    if (existingDevis.rows.length === 0) {
      throw new AppError('Devis non trouvé', 404);
    }

    // Prépare les champs à mettre à jour
    const updates = [];
    const values = [];

    if (numero !== undefined) {
      updates.push(`numero = ?`);
      values.push(numero);
    }
    if (client_nom !== undefined) {
      updates.push(`client_nom = ?`);
      values.push(client_nom);
    }
    if (client_prenom !== undefined) {
      updates.push(`client_prenom = ?`);
      values.push(client_prenom);
    }
    if (client_adresse !== undefined) {
      updates.push(`client_adresse = ?`);
      values.push(client_adresse);
    }
    if (client_telephone !== undefined) {
      updates.push(`client_telephone = ?`);
      values.push(client_telephone);
    }
    if (client_email !== undefined) {
      updates.push(`client_email = ?`);
      values.push(client_email);
    }
    if (date_devis !== undefined) {
      updates.push(`date_devis = ?`);
      values.push(date_devis);
    }
    if (tva !== undefined) {
      updates.push(`tva = ?`);
      values.push(tva);
    }
    if (statut !== undefined) {
      updates.push(`statut = ?`);
      values.push(statut);
    }

    if (updates.length > 0) {
      updates.push(`updated_at = datetime('now')`);
      values.push(id);

      query(
        `UPDATE devis SET ${updates.join(', ')} WHERE id = ?`,
        values
      );
    }

    // Mise à jour des articles si fournis
    if (articles && Array.isArray(articles)) {
      // Supprime les anciens articles
      query('DELETE FROM devis_articles WHERE devis_id = ?', [id]);

      // Ajoute les nouveaux articles
      articles.forEach((article, index) => {
        if (!article.designation || article.quantite === undefined || article.prix_unitaire === undefined) {
          throw new AppError('Chaque article doit avoir: designation, quantite, prix_unitaire', 400);
        }

        const articleId = uuidv4();
        query(
          `INSERT INTO devis_articles (
            id, devis_id, numero_ligne, designation, unite, quantite, prix_unitaire
          ) VALUES (?, ?, ?, ?, ?, ?, ?)` ,
          [
            articleId, id, index + 1, article.designation, article.unite || 'pièce',
            parseFloat(article.quantite), parseFloat(article.prix_unitaire)
          ]
        );
      });
    }

    // Récupère le devis mis à jour
    const updatedDevisResult = query('SELECT * FROM devis WHERE id = ?', [id]);
    const updatedDevis = updatedDevisResult.rows[0];

    res.json({
      success: true,
      message: 'Devis modifié avec succès',
      data: updatedDevis
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Supprime un devis
 */
const deleteDevis = async (req, res, next) => {
  try {
    const { id } = req.params;

    // Supprime les articles
    query('DELETE FROM devis_articles WHERE devis_id = ?', [id]);

    // Supprime le devis
    const result = query(
      'DELETE FROM devis WHERE id = ?',
      [id]
    );

    if (result.rowCount === 0) {
      throw new AppError('Devis non trouvé', 404);
    }

    res.json({
      success: true,
      message: 'Devis supprimé avec succès'
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Génère un PDF du devis - style Excel-like, page unique, propre
 */
const generatePDF = async (req, res, next) => {
  try {
    const { id } = req.params;
    const PDFDocument = require('pdfkit');

    const devisResult = query('SELECT * FROM devis WHERE id = ?', [id]);
    if (devisResult.rows.length === 0) {
      throw new AppError('Devis non trouvé', 404);
    }

    const devis = devisResult.rows[0];
    const articlesResult = query(
      `SELECT id, numero_ligne, designation, unite, quantite, prix_unitaire,
              (quantite * prix_unitaire) as total_ligne
       FROM devis_articles WHERE devis_id = ? ORDER BY numero_ligne ASC`,
      [id]
    );

    const articles = articlesResult.rows || [];
    const montantHT = articles.reduce((sum, a) => sum + (a.quantite * a.prix_unitaire), 0);
    const montantTVA = devis.tva ? (montantHT * devis.tva / 100) : 0;
    const montantTTC = montantHT + montantTVA;

    const formatPrice = (num) => {
      const text = new Intl.NumberFormat('fr-FR', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      }).format(num);
      return text.replace(/\u202f/g, ' ');
    };

    const formatDevisDate = (value) => {
      if (!value) return new Date(devis.created_at).toLocaleDateString('fr-FR');
      if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
        const [year, month, day] = value.split('-').map(Number);
        return new Date(year, month - 1, day).toLocaleDateString('fr-FR');
      }
      return new Date(value).toLocaleDateString('fr-FR');
    };

    const formatPaymentTerms = (pt) => {
      if (!pt) return '-';
      const parts = [];
      if (pt.advance !== undefined) parts.push(`${pt.advance}% à la commande`);
      if (pt.onDelivery !== undefined) parts.push(`${pt.onDelivery}% à la livraison`);
      if (pt.afterInstallation !== undefined) parts.push(`${pt.afterInstallation}% après installation`);
      return parts.join(' • ');
    };

    const formatValidity = (v) => {
      if (!v) return '-';
      if (typeof v === 'string') return v;
      if (v.text) return v.text;
      if (v.days !== undefined) return `Valable ${v.days} jours`;
      return '-';
    };

    const paymentTermsText = formatPaymentTerms(PAYMENT_TERMS);
    const validityText = formatValidity(QUOTE_VALIDITY);

    const logoPath = path.resolve(__dirname, '../../public', COMPANY_INFO.logo.replace(/^\//, ''));
    const hasLogo = fs.existsSync(logoPath);
    if (!hasLogo) {
      console.warn('Logo introuvable pour le PDF:', logoPath);
    }

    const doc = new PDFDocument({ size: 'A4', layout: 'portrait', margin: 28 });
    const fileName = `Devis_${devis.numero}.pdf`;

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

    // === EN-TÊTE ===
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
      .text('DEVIS', leftX + 14, topY + 18);

    doc
      .font('Helvetica')
      .fontSize(10)
      .fillColor(colors.text)
      .text(`N° ${devis.numero}`, leftX + 14, topY + 62)
      .text(`Date : ${formatDevisDate(devis.date_devis)}`, leftX + 220, topY + 62);

    const companyBoxY = topY + pageHeaderHeight + 12;
    const companyBoxH = 128;
    const companyBoxW = Math.round((contentWidth - 12) / 2);
    const companyBoxX = leftX;
    const clientBoxX = leftX + companyBoxW + 12;
    const clientBoxW = contentWidth - companyBoxW - 12;
    const clientBoxY = companyBoxY;
    const clientBoxH = companyBoxH;

    // Société
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
      .text('Village Iryahen commune Tala hamza Bejaia', companyBoxX + 10, companyBoxY + 118, { width: companyBoxW - 20, lineGap: 1 });

    // Client
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
      .text(`${devis.client_prenom || '-'} ${devis.client_nom || '-'}`, clientBoxX + 10, clientBoxY + 32, { width: clientBoxW - 20 });

    doc
      .font('Helvetica-Bold')
      .fontSize(10)
      .fillColor(colors.text)
      .text('Tél :', clientBoxX + 10, clientBoxY + 56);
    doc
      .font('Helvetica')
      .fontSize(10)
      .fillColor(colors.muted)
      .text(devis.client_telephone || '-', clientBoxX + 42, clientBoxY + 56, { width: clientBoxW - 52 });

    doc
      .font('Helvetica-Bold')
      .fontSize(10)
      .fillColor(colors.text)
      .text('Email :', clientBoxX + 10, clientBoxY + 72);
    doc
      .font('Helvetica')
      .fontSize(10)
      .fillColor(colors.muted)
      .text(devis.client_email || devis.client_mail || '-', clientBoxX + 52, clientBoxY + 72, { width: clientBoxW - 62 });

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

    if (articles.length === 0) {
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
      articles.forEach((article, index) => {
        const rowColor = index % 2 === 0 ? colors.white : colors.light;
        doc
          .rect(leftX, rowY, contentWidth, rowHeight)
          .fill(rowColor)
          .stroke(colors.border);

        const description = article.designation.length > 42
          ? `${article.designation.substring(0, 39)}...`
          : article.designation;

        doc
          .font('Helvetica')
          .fontSize(tableFontSize)
          .fillColor(colors.text)
          .text(index + 1, cols.no, rowY + 5, { width: 24, align: 'center' })
          .text(description, cols.desc, rowY + 5, { width: 228 })
          .text(article.unite || 'pièce', cols.unit, rowY + 5, { width: 40, align: 'center' })
          .text(article.quantite.toString(), cols.qty, rowY + 5, { width: 34, align: 'center' })
          .text(formatPrice(article.prix_unitaire) + ' DA', cols.pu, rowY + 5, { width: 80, align: 'right', lineBreak: false })
          .font('Helvetica-Bold')
          .text(formatPrice(article.quantite * article.prix_unitaire) + ' DA', cols.total, rowY + 5, { width: 90, align: 'right', lineBreak: false });

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
    totalLine(`TVA (${devis.tva || 0}%)`, formatPrice(montantTVA) + ' DA', totalsY + 34);

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
      `• Paiement : ${paymentTermsText}`,
      `• Livraison : ${DELIVERY_TERMS.text || DELIVERY_TERMS}`,
      `• Validité : ${validityText}`
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
  listDevis,
  getDevis,
  createDevis,
  updateDevis,
  deleteDevis,
  generatePDF
};
