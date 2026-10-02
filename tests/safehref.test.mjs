import test from 'node:test';
import assert from 'node:assert/strict';
import { safeHref } from '../src/utils/text.js';

test('safeHref allows http(s), mailto, tel, hash, site paths', () => {
  for (const ok of ['https://a.com/x', 'http://a.com', 'mailto:a@b.co', 'tel:+911234567890', '#faq', '/privacy.html', 'privacy.html'])
    assert.equal(safeHref(ok), ok);
});
test('safeHref rejects script-capable and odd schemes', () => {
  for (const bad of ['javascript:alert(1)', ' JaVaScRiPt:alert(1)', 'java\tscript:alert(1)', 'java\nscript:alert(1)', '\u0001javascript:x',
    'data:text/html,<script>1</script>', 'vbscript:x', '//evil.com', '/\\evil.com', 'file:///etc/passwd', 'blob:x', null, undefined, 42, ''])
    assert.equal(safeHref(bad), '#', String(bad));
});
