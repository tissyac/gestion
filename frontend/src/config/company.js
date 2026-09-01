const apiBaseUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

export const COMPANY_BRAND = {
  name: 'SARA Decorex',
  logoUrl: `${apiBaseUrl.replace(/\/api\/?$/, '')}/logo.png`
};