import { buildReportHtml } from './analysisReport';

const aoi = { bbox: { west: 84.4, south: 27.6, east: 84.5, north: 27.7 }, name: 'Bharatpur' };

test('report escapes everything that comes from results and users', () => {
  const html = buildReportHtml({
    result: {
      title: 'Flood <img src=x onerror=alert(1)>',
      stats: [{ label: '<b>Area</b>', value: '12', unit: 'km²' }],
      table: { columns: ['Class', 'Area'], rows: [['<script>x</script>', 3]] },
      notes: ['Source: "DHM" & BIPAD'],
    },
    toolLabel: 'Flood risk',
    aoi,
    params: [{ label: 'Year', value: 2025 }],
  });
  expect(html).not.toContain('<script>x</script>');
  expect(html).not.toContain('<b>Area</b>');
  expect(html).toContain('&lt;script&gt;x&lt;/script&gt;');
  expect(html).toContain('&quot;DHM&quot; &amp; BIPAD');
  expect(html).toContain('84.4000, 27.6000');
});

test('report long tables are cut to 300 rows with a note', () => {
  const rows = Array.from({ length: 450 }, (_, i) => [`r${i}`, i]);
  const html = buildReportHtml({ result: { stats: [], table: { columns: ['a', 'b'], rows } }, toolLabel: 'x', aoi });
  expect(html).toContain('First 300 of 450 rows');
  expect(html).not.toContain('>r300<');
});
