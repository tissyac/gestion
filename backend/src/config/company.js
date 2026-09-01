/**
 * Configuration des informations de l'entreprise
 * ===============================================
 * 
 * Informations fixes qui apparaissent sur tous les devis/factures
 */

const COMPANY_INFO = {
  name: 'SARL SARA DÉCOREX',
  capitalSocial: '2 000 000 DA',
  address: 'Village Iryahen commune Tala hamza Bejaia',
  phone: '034 08 10 65',
  mobile1: '0770 06 46 05',
  mobile2: '0770 16 01 91',
  email: 'sara.decorex@gmail.com',
  rc: '14 B0188021',
  nif: '001406018802120',
  ai: '0 014 0633 00075 61',
  logo: '/logo.png', // À ajouter dans le dossier public
};

const PAYMENT_TERMS = {
  advance: 50, // 50% à la commande
  onDelivery: 45, // 45% le jour de livraison
  afterInstallation: 5, // 5% après l'installation
};

const DELIVERY_TERMS = {
  minDays: 15,
  maxDays: 60,
  text: 'Délai de livraison: 15 à 60 jours après le versement',
};

const QUOTE_VALIDITY = {
  days: 30,
  text: 'Valable 1 mois après l\'obtention du devis',
};

const TVAS = {
  none: 0,
  reduced: 9,
  standard: 19,
};

module.exports = {
  COMPANY_INFO,
  PAYMENT_TERMS,
  DELIVERY_TERMS,
  QUOTE_VALIDITY,
  TVAS,
};
