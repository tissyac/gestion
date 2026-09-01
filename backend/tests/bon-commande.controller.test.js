const { parseBonDescription, formatDate, calculateLineTotal } = require('../src/controllers/bon-commande.controller');

describe('parseBonDescription', () => {
  it('extracts supplier metadata from the stored description payload', () => {
    const payload = JSON.stringify({
      description: 'Commande de mobilier',
      articles: [{ designation: 'Chaise', quantite: 2, prix_unitaire: 100 }],
      fournisseur_telephone: '0555 12 34 56',
      fournisseur_email: 'fournisseur@example.com',
      fournisseur_adresse: '12 Rue de la Paix'
    });

    expect(parseBonDescription(payload)).toEqual({
      description: 'Commande de mobilier',
      articles: [{ designation: 'Chaise', quantite: 2, prix_unitaire: 100 }],
      contactPhone: '0555 12 34 56',
      contactEmail: 'fournisseur@example.com',
      contactAddress: '12 Rue de la Paix'
    });
  });

  it('falls back to a plain legacy description when no structured metadata exists', () => {
    expect(parseBonDescription('Simple commande')).toEqual({
      description: 'Simple commande',
      articles: [],
      contactPhone: '-',
      contactEmail: '-',
      contactAddress: ''
    });
  });
});

describe('formatDate', () => {
  it('formats an ISO date string for PDF display', () => {
    expect(formatDate('2025-01-15')).toBe('15/01/2025');
  });
});

describe('calculateLineTotal', () => {
  it('computes a safe total when article values are strings or missing', () => {
    expect(calculateLineTotal({ quantite: '2', prix_unitaire: '150' })).toBe(300);
    expect(calculateLineTotal({ quantite: 1, prix_unitaire: undefined })).toBe(0);
  });
});
