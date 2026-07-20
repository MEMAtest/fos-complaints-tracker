import assert from 'node:assert/strict';
import test from 'node:test';
import { strToU8, zipSync } from 'fflate';
import { parseComplaintImportFile } from '../../src/lib/complaints/import-parser';

test('parses and normalises a CSV complaint import', async () => {
  const csv = [
    'Complaint Reference,Complainant Name,Received Date,Firm,Product,FOS Referred,Compensation Amount',
    'CMP-001,Alex Example,2026-07-18,Example Finance,Credit Card,yes,125.50',
  ].join('\n');

  const parsed = await parseComplaintImportFile('complaints.csv', Buffer.from(csv));

  assert.equal(parsed.rows.length, 1);
  assert.equal(parsed.rows[0].normalizedFields.complaintReference, 'CMP-001');
  assert.equal(parsed.rows[0].normalizedFields.complainantName, 'Alex Example');
  assert.equal(parsed.rows[0].normalizedFields.receivedDate, '2026-07-18');
  assert.equal(parsed.rows[0].normalizedFields.fosReferred, true);
  assert.equal(parsed.rows[0].normalizedFields.compensationAmount, 125.5);
  assert.deepEqual(parsed.rows[0].issues, []);
});

test('parses the first worksheet from an xlsx complaint import', async () => {
  const workbook = buildTestWorkbook([
    ['Complaint Reference', 'Complainant Name', 'Received Date', 'Firm'],
    ['CMP-002', 'Sam Example', '2026-07-17', 'Example Bank'],
  ]);

  const parsed = await parseComplaintImportFile('complaints.xlsx', workbook);

  assert.equal(parsed.rows.length, 1);
  assert.equal(parsed.rows[0].normalizedFields.complaintReference, 'CMP-002');
  assert.equal(parsed.rows[0].normalizedFields.complainantName, 'Sam Example');
  assert.equal(parsed.rows[0].normalizedFields.firmName, 'Example Bank');
  assert.equal(parsed.rows[0].normalizedFields.receivedDate, '2026-07-17');
});

test('rejects legacy binary xls files', async () => {
  await assert.rejects(
    () => parseComplaintImportFile('legacy.xls', Buffer.from('not-a-workbook')),
    /Unsupported file type/
  );
});

test('rejects malformed xlsx files as validation errors', async () => {
  await assert.rejects(
    () => parseComplaintImportFile('malformed.xlsx', Buffer.from('not-a-zip')),
    { name: 'ComplaintImportValidationError', message: 'Unable to read the uploaded XLSX file.' }
  );
});

test('rejects xlsx archives that claim excessive expanded size', async () => {
  const workbook = buildTestWorkbook([
    ['Complaint Reference', 'Complainant Name', 'Received Date'],
    ['CMP-003', 'Taylor Example', '2026-07-20'],
  ]);
  const centralDirectoryOffset = workbook.indexOf(Buffer.from([0x50, 0x4b, 0x01, 0x02]));
  assert.notEqual(centralDirectoryOffset, -1);
  workbook.writeUInt32LE(51 * 1024 * 1024, centralDirectoryOffset + 24);

  await assert.rejects(
    () => parseComplaintImportFile('expanded.xlsx', workbook),
    /expands beyond the 50 MB safety limit/
  );
});

test('rejects imports above the row limit', async () => {
  const rows = ['Complaint Reference,Complainant Name,Received Date'];
  for (let index = 0; index < 5_001; index += 1) {
    rows.push(`CMP-${index},Customer ${index},2026-07-18`);
  }

  await assert.rejects(
    () => parseComplaintImportFile('too-many.csv', Buffer.from(rows.join('\n'))),
    /limited to 5,000 data rows/
  );
});

function buildTestWorkbook(rows: string[][]): Buffer {
  const sheetRows = rows
    .map((row, rowIndex) => {
      const cells = row
        .map((value, columnIndex) => {
          const reference = `${columnName(columnIndex + 1)}${rowIndex + 1}`;
          return `<c r="${reference}" t="inlineStr"><is><t>${escapeXml(value)}</t></is></c>`;
        })
        .join('');
      return `<row r="${rowIndex + 1}">${cells}</row>`;
    })
    .join('');

  const files = {
    '[Content_Types].xml': strToU8(
      '<?xml version="1.0" encoding="UTF-8"?>' +
        '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
        '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
        '<Default Extension="xml" ContentType="application/xml"/>' +
        '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
        '<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>' +
        '</Types>'
    ),
    '_rels/.rels': strToU8(
      '<?xml version="1.0" encoding="UTF-8"?>' +
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
        '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>' +
        '</Relationships>'
    ),
    'xl/workbook.xml': strToU8(
      '<?xml version="1.0" encoding="UTF-8"?>' +
        '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
        '<sheets><sheet name="Complaints" sheetId="1" r:id="rId1"/></sheets></workbook>'
    ),
    'xl/_rels/workbook.xml.rels': strToU8(
      '<?xml version="1.0" encoding="UTF-8"?>' +
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
        '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>' +
        '</Relationships>'
    ),
    'xl/worksheets/sheet1.xml': strToU8(
      '<?xml version="1.0" encoding="UTF-8"?>' +
        '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
        `<sheetData>${sheetRows}</sheetData></worksheet>`
    ),
  };

  return Buffer.from(zipSync(files, { level: 0 }));
}

function columnName(column: number): string {
  let value = column;
  let result = '';
  while (value > 0) {
    const remainder = (value - 1) % 26;
    result = String.fromCharCode(65 + remainder) + result;
    value = Math.floor((value - 1) / 26);
  }
  return result;
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
