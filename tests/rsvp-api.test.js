import test from 'node:test';
import assert from 'node:assert/strict';
import handler from '../api/rsvp.js';

function createResponse() {
  return {
    statusCode: 200,
    headers: {},
    body: undefined,
    setHeader(name, value) { this.headers[name] = value; },
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  };
}

test('RSVP API returns structured validation errors', async () => {
  const response = createResponse();
  await handler({
    method: 'POST',
    headers: {},
    body: { name: '', attendance: 'maybe', drinks: ['tea'] },
    socket: { remoteAddress: '127.0.0.1' },
  }, response);

  assert.equal(response.statusCode, 400);
  assert.equal(response.body.ok, false);
  assert.ok(response.body.errors.name);
  assert.ok(response.body.errors.attendance);
  assert.ok(response.body.errors.drinks);
});

test('RSVP API stores a valid response', async (context) => {
  process.env.SUPABASE_URL = 'https://example.supabase.co';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role';
  process.env.IP_HASH_SALT = 'test-salt';

  const originalFetch = globalThis.fetch;
  const responses = [[], [], [{ id: '9a1508ca-b0ec-4c60-a403-a0c32b8e7d13' }]];
  const calls = [];
  globalThis.fetch = async (url, options) => {
    calls.push({ url: String(url), options });
    return new Response(JSON.stringify(responses.shift()), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  };
  context.after(() => { globalThis.fetch = originalFetch; });

  const response = createResponse();
  await handler({
    method: 'POST',
    headers: {
      'content-length': '120',
      'idempotency-key': 'cc84aefb-f3f2-46b5-9bb4-67125c6609bb',
      'x-form-started-at': String(Date.now() - 5_000),
      'x-forwarded-for': '203.0.113.10',
    },
    body: {
      name: 'Анна и Иван',
      attendance: 'yes',
      song: 'ABBA — Dancing Queen',
      drinks: ['sparkling'],
    },
    socket: {},
  }, response);

  assert.equal(response.statusCode, 201);
  assert.deepEqual(response.body, { ok: true, id: '9a1508ca-b0ec-4c60-a403-a0c32b8e7d13' });
  assert.equal(calls.length, 3);
  assert.equal(calls[2].options.method, 'POST');
  const stored = JSON.parse(calls[2].options.body);
  assert.equal(stored.name, 'Анна и Иван');
  assert.equal(stored.submission_id, 'cc84aefb-f3f2-46b5-9bb4-67125c6609bb');
  assert.match(stored.ip_hash, /^[0-9a-f]{64}$/);
});
