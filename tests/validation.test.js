import test from 'node:test';
import assert from 'node:assert/strict';
import { validateRsvp } from '../lib/validation.js';

test('accepts a valid RSVP', () => {
  const result = validateRsvp({
    name: ' Анна и Иван ',
    attendance: 'yes',
    song: 'ABBA — Dancing Queen',
    drinks: ['sparkling', 'white_wine'],
  });
  assert.equal(result.ok, true);
  assert.equal(result.value.name, 'Анна и Иван');
});

test('accepts an empty drinks list required by the schema', () => {
  const result = validateRsvp({ name: 'Анна', attendance: 'no', drinks: [] });
  assert.equal(result.ok, true);
  assert.equal(result.value.song, '');
});

test('rejects unknown properties', () => {
  const result = validateRsvp({ name: 'Анна', attendance: 'yes', drinks: [], phone: '+7' });
  assert.equal(result.ok, false);
  assert.match(result.errors._form, /Неизвестное поле/);
});

test('rejects invalid enum values and duplicate drinks', () => {
  const result = validateRsvp({
    name: 'Анна',
    attendance: 'maybe',
    drinks: ['sparkling', 'sparkling'],
  });
  assert.equal(result.ok, false);
  assert.ok(result.errors.attendance);
  assert.ok(result.errors.drinks);
});
