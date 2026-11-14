import { timingSafeEqual } from 'node:crypto';
import { supabaseRequest } from '../lib/supabase.js';

const drinkNames = {
  no_preference: 'Без предпочтений',
  sparkling: 'Игристое',
  white_wine: 'Белое вино',
  red_wine: 'Красное вино',
  spirits: 'Крепкий алкоголь',
  non_alcoholic: 'Безалкогольные напитки',
};

function isAuthorized(request) {
  const expected = process.env.ADMIN_EXPORT_TOKEN || '';
  const authorization = String(request.headers.authorization || '');
  if (!expected || !authorization.startsWith('Basic ')) return false;

  try {
    const decoded = Buffer.from(authorization.slice(6), 'base64').toString('utf8');
    const password = decoded.slice(decoded.indexOf(':') + 1);
    const actualBuffer = Buffer.from(password);
    const expectedBuffer = Buffer.from(expected);
    return actualBuffer.length === expectedBuffer.length && timingSafeEqual(actualBuffer, expectedBuffer);
  } catch {
    return false;
  }
}

function escapeCsv(value) {
  const text = String(value ?? '');
  return /[";,\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function toCsv(rows) {
  const header = ['Дата', 'Имя', 'Присутствие', 'Трек', 'Напитки'];
  const records = rows.map((row) => [
    new Date(row.submitted_at).toLocaleString('ru-RU', { timeZone: 'Europe/Moscow' }),
    row.name,
    row.attendance === 'yes' ? 'Да' : 'Нет',
    row.song,
    (row.drinks || []).map((drink) => drinkNames[drink] || drink).join(', '),
  ]);
  return [header, ...records].map((record) => record.map(escapeCsv).join(';')).join('\r\n');
}

export default async function handler(request, response) {
  response.setHeader('Cache-Control', 'no-store');
  if (request.method !== 'GET') {
    response.setHeader('Allow', 'GET');
    return response.status(405).json({ ok: false, message: 'Метод не поддерживается.' });
  }

  if (!isAuthorized(request)) {
    response.setHeader('WWW-Authenticate', 'Basic realm="Wedding RSVP export", charset="UTF-8"');
    return response.status(401).send('Требуется пароль организатора.');
  }

  try {
    const rows = await supabaseRequest(
      'rsvps?select=submitted_at,name,attendance,song,drinks&order=submitted_at.asc',
    );
    response.setHeader('Content-Type', 'text/csv; charset=utf-8');
    response.setHeader('Content-Disposition', 'attachment; filename="wedding-rsvp.csv"');
    return response.status(200).send(`\uFEFF${toCsv(rows || [])}`);
  } catch (error) {
    console.error('RSVP export failed', error);
    return response.status(500).json({ ok: false, message: 'Не удалось выгрузить ответы.' });
  }
}
