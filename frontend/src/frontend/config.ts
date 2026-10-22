export const API_BASE_URL =
  (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_API_BASE_URL)
    ? String(import.meta.env.VITE_API_BASE_URL)
    : 'http://localhost:4000';

export const USE_MOCK =
  (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_USE_MOCK !== undefined)
    ? import.meta.env.VITE_USE_MOCK === 'true'
    : false;

export const PAGE_SIZE = 10;
