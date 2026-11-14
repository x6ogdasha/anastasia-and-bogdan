import { createHash, randomUUID } from 'node:crypto';
import { supabaseRequest } from '../lib/supabase.js';
import { validateRsvp } from '../lib/validation.js';

function parseBody(body) {
  if (typeof body === 'string') return JSON.parse(body);
  return body;
}

function getClientIp(request) {
  const forwarded = request.headers['x-forwarded-for'];
  return String(Array.isArray(forwarded) ? forwarded[0] : forwarded || request.socket?.remoteAddress || 'unknown')
    .split(',')[0]
    .trim();
}

function getIpHash(request) {
  const salt = process.env.IP_HASH_SALT || 'wedding-rsvp';
  return createHash('sha256').update(`${salt}:${getClientIp(request)}`).digest('hex');
}

function getSubmissionId(request) {
  const candidate = String(request.headers['idempotency-key'] || '');
  return /^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(candidate) ? candidate : randomUUID();
}

async function findExisting(submissionId) {
  const rows = await supabaseRequest(`rsvps?select=id&submission_id=eq.${encodeURIComponent(submissionId)}&limit=1`);
  return rows?.[0] || null;
}

async function enforceRateLimit(ipHash) {
  const since = new Date(Date.now() - 10 * 60 * 1000).toISOString();
  const rows = await supabaseRequest(
    `rsvps?select=id&ip_hash=eq.${encodeURIComponent(ipHash)}&submitted_at=gte.${encodeURIComponent(since)}&limit=6`,
  );
  return (rows?.length || 0) < 5;
}

export default async function handler(request, response) {
  response.setHeader('Cache-Control', 'no-store');
  if (request.method !== 'POST') {
    response.setHeader('Allow', 'POST');
    return response.status(405).json({ ok: false, message: 'Метод не поддерживается.' });
  }

  if (Number(request.headers['content-length'] || 0) > 16_384) {
    return response.status(413).json({ ok: false, message: 'Запрос слишком большой.' });
  }

  if (String(request.headers['x-wedding-website'] || '').trim()) {
    return response.status(201).json({ ok: true, id: randomUUID() });
  }

  const startedAt = Number(request.headers['x-form-started-at'] || 0);
  if (startedAt > 0 && Date.now() - startedAt < 900) {
    return response.status(400).json({ ok: false, message: 'Форма отправлена слишком быстро.' });
  }

  let input;
  try {
    input = parseBody(request.body);
  } catch {
    return response.status(400).json({ ok: false, errors: { _form: 'Некорректный JSON.' } });
  }

  const validation = validateRsvp(input);
  if (!validation.ok) return response.status(400).json({ ok: false, errors: validation.errors });

  try {
    const submissionId = getSubmissionId(request);
    const existing = await findExisting(submissionId);
    if (existing) return response.status(200).json({ ok: true, id: existing.id, duplicate: true });

    const ipHash = getIpHash(request);
    if (!(await enforceRateLimit(ipHash))) {
      return response.status(429).json({ ok: false, message: 'Слишком много попыток. Попробуйте позднее.' });
    }

    const rows = await supabaseRequest('rsvps?select=id', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Prefer: 'return=representation',
      },
      body: JSON.stringify({
        submission_id: submissionId,
        name: validation.value.name,
        attendance: validation.value.attendance,
        song: validation.value.song,
        drinks: validation.value.drinks,
        ip_hash: ipHash,
      }),
    });

    return response.status(201).json({ ok: true, id: rows?.[0]?.id || submissionId });
  } catch (error) {
    if (error instanceof Error && error.message === 'SUPABASE_NOT_CONFIGURED') {
      return response.status(503).json({ ok: false, message: 'Хранилище ответов пока не настроено.' });
    }
    console.error('RSVP submission failed', error);
    return response.status(500).json({ ok: false, message: 'Не удалось сохранить ответ. Попробуйте ещё раз.' });
  }
}
