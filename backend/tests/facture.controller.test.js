const { parseFactureDescription, calculateInvoiceTotal } = require('../src/controllers/facture.controller');

describe('parseFactureDescription', () => {
  it('extracts invoice metadata and articles from the stored description payload', () => {
    const payload = JSON.stringify({
      description: 'Facture de mobilier',
      articles: [
        { designation: 'Chaise', unite: 'pièce', quantite: 2, prix_unitaire: 100, total_ligne: 200 }
      ],
      client_telephone: '0555 12 34 56',
      client_email: 'client@example.com',
      client_adresse: '12 Rue de la Paix'
    });

    expect(parseFactureDescription(payload)).toEqual({
      description: 'Facture de mobilier',
      articles: [
        { designation: 'Chaise', unite: 'pièce', quantite: 2, prix_unitaire: 100, total_ligne: 200 }
      ],
      clientPhone: '0555 12 34 56',
      clientEmail: 'client@example.com',
      clientAddress: '12 Rue de la Paix',
      tva: 0
    });
  });

  it('falls back to default values when no structured metadata exists', () => {
    expect(parseFactureDescription('Facture simple')).toEqual({
      description: 'Facture simple',
      articles: [],
      clientPhone: '-',
      clientEmail: '-',
      clientAddress: '',
      tva: 0
    });
  });
});

describe('calculateInvoiceTotal', () => {
  it('sums the line totals and ignores invalid values safely', () => {
    expect(calculateInvoiceTotal([
      { quantite: '2', prix_unitaire: '150' },
      { quantite: 1, prix_unitaire: undefined },
      { quantite: '3.5', prix_unitaire: '10' }
    ])).toBe(2 * 150 + 0 + 3.5 * 10);
  });
});
