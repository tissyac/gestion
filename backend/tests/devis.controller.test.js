jest.mock('../src/config/database', () => ({
  query: jest.fn()
}));

const { query } = require('../src/config/database');
const { listDevis } = require('../src/controllers/devis.controller');

describe('listDevis', () => {
  beforeEach(() => {
    query.mockReset();
  });

  it('includes legacy quotes without an owner while keeping the total consistent', async () => {
    query
      .mockResolvedValueOnce({
        rows: [
          { id: 'owned', montant_ht: 100, tva: 20 },
          { id: 'legacy', montant_ht: 50, tva: 0 }
        ]
      })
      .mockResolvedValueOnce({ rows: [{ count: '2' }] });

    const req = {
      query: { page: '1', limit: '10' },
      user: { id: 'current-user' }
    };
    const res = { json: jest.fn() };
    const next = jest.fn();

    await listDevis(req, res, next);

    expect(query).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining('WHERE (d.user_id = ? OR d.user_id IS NULL)'),
      ['current-user', 10, 0]
    );
    expect(query).toHaveBeenNthCalledWith(
      2,
      'SELECT COUNT(*) as count FROM devis WHERE user_id = ? OR user_id IS NULL',
      ['current-user']
    );
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      data: [
        expect.objectContaining({ id: 'owned', montantTTC: 120 }),
        expect.objectContaining({ id: 'legacy', montantTTC: 50 })
      ],
      pagination: expect.objectContaining({ total: 2 })
    }));
    expect(next).not.toHaveBeenCalled();
  });
});
