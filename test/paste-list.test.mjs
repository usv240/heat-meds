import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseMedicineList, MAX_ITEMS } from '../src/paste-list.js';

test('one name per line, with doses and directions left for the normal lookup to strip', () => {
  const text = `Current medications:
furosemide 40 mg tablet - take 1 tablet by mouth daily
lisinopril 10 mg tablet, take 1 daily
sertraline 50 mg tablet (Qty: 30, Refills: 2)`;
  assert.deepEqual(parseMedicineList(text), ['furosemide 40 mg tablet', 'lisinopril 10 mg tablet', 'sertraline 50 mg tablet']);
});

test('commas, semicolons, and bullets separate names; duplicates are dropped', () => {
  assert.deepEqual(parseMedicineList('furosemide, lisinopril; - sertraline\n* Furosemide\n2) atorvastatin'), ['furosemide', 'lisinopril', 'sertraline', 'atorvastatin']);
});

test('headings, blanks, and numbers alone are ignored', () => {
  assert.deepEqual(parseMedicineList('Medications\n\nRx\n123\n  \nmetformin'), ['metformin']);
});

test('a decimal comma inside a dose does not split the line', () => {
  assert.deepEqual(parseMedicineList('levothyroxine 0,05 mg'), ['levothyroxine 0,05 mg']);
});

test('timing and purpose words after a name are dropped too', () => {
  assert.deepEqual(
    parseMedicineList('atorvastatin 20 mg at bedtime\nmetformin 500 mg with food\nalbuterol inhaler as needed for wheezing'),
    ['atorvastatin 20 mg', 'metformin 500 mg', 'albuterol inhaler'],
  );
});

test('directions after a comma never become a medicine ("1 tablet daily", "2 puffs")', () => {
  assert.deepEqual(
    parseMedicineList('lisinopril-hydrochlorothiazide, 1 tablet daily\nalbuterol, 2 puffs\nmetformin, tablet'),
    ['lisinopril-hydrochlorothiazide', 'albuterol', 'metformin'],
  );
});

test(`a pasted list is capped at ${MAX_ITEMS} names`, () => {
  const many = Array.from({ length: 40 }, (_, i) => `medicine${i}`).join('\n');
  assert.equal(parseMedicineList(many).length, MAX_ITEMS);
});
