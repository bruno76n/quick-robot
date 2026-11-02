import { describe, expect, it } from 'vitest';
import { csvCell, toCsv } from '../src/csv';

describe('CSV without formula injection (docs/11 A05)', () => {
  it('neutralizes cells that a spreadsheet would execute', () => {
    expect(csvCell('=HYPERLINK("http://x","clic")')).toBe(`"'=HYPERLINK(""http://x"",""clic"")"`);
    expect(csvCell('+1')).toBe(`"'+1"`);
    expect(csvCell('-2+3')).toBe(`"'-2+3"`);
    expect(csvCell('@SUM(A1)')).toBe(`"'@SUM(A1)"`);
  });
  it('numbers stay numbers (negative amounts are not text)', () => {
    expect(csvCell(-12.5)).toBe('-12.5');
  });
  it('quotes commas, quotes and new lines', () => {
    expect(toCsv([['PLA Negro', 'a,b', 'dijo "hola"'], [1, null, 'x\ny']])).toBe('PLA Negro,"a,b","dijo ""hola"""\r\n1,,"x\ny"');
  });
});
