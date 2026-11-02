import { describe, expect, it } from 'vitest';
import { BOM, csvCell, csvFile, csvMoney, csvName, csvText } from './csv';

describe('csv', () => {
  it('keeps plain text and numbers as they are', () => {
    expect(csvCell('Llavero')).toBe('Llavero');
    expect(csvCell(12.5)).toBe('12.5');
    expect(csvCell(-3)).toBe('-3');
    expect(csvCell(null)).toBe('');
    expect(csvCell(undefined)).toBe('');
    expect(csvCell(Number.NaN)).toBe('');
    expect(csvCell(true)).toBe('true');
  });

  it('quotes commas, quotes, semicolons and line breaks', () => {
    expect(csvCell('a, b')).toBe('"a, b"');
    expect(csvCell('dijo "hola"')).toBe('"dijo ""hola"""');
    expect(csvCell('a;b')).toBe('"a;b"');
    expect(csvCell('línea 1\nlínea 2')).toBe('"línea 1\nlínea 2"');
  });

  it('neutralizes cells that start like a formula', () => {
    expect(csvCell('=SUM(A1:A2)')).toBe("'=SUM(A1:A2)");
    expect(csvCell('+52 33 1234')).toBe("'+52 33 1234");
    expect(csvCell('-2+3')).toBe("'-2+3");
    expect(csvCell('@cmd')).toBe("'@cmd");
    expect(csvCell('=HYPERLINK("x","y")')).toBe(`"'=HYPERLINK(""x"",""y"")"`);
    expect(csvCell('\t=1')).toBe("'\t=1");
  });

  it('builds the table with CRLF and the file with BOM', () => {
    const t = csvText(['Fecha', 'Concepto'], [['2026-11-01', 'Renta, local'], ['2026-11-02', 'Internet']]);
    expect(t).toBe('Fecha,Concepto\r\n2026-11-01,"Renta, local"\r\n2026-11-02,Internet');
    const f = csvFile(['A'], [[1]]);
    expect(f.startsWith(BOM)).toBe(true);
    expect(f.slice(1)).toBe('A\r\n1');
  });

  it('formats money and file names', () => {
    expect(csvMoney(123456)).toBe(1234.56);
    expect(csvMoney(50)).toBe(0.5);
    expect(csvName('Mi Taller', 'Piezas y costos', '2026-11-02')).toBe('mi-taller-piezas-y-costos-2026-11-02.csv');
    expect(csvName('', 'Gastos', '2026-11-02')).toBe('gastos-2026-11-02.csv');
  });
});
