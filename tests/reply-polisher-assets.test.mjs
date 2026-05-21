import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('settings UI is localized to Chinese', () => {
    const html = fs.readFileSync('public/scripts/extensions/third-party/reply-polisher/settings.html', 'utf8');

    assert.match(html, /启用/);
    assert.match(html, /自动润色/);
    assert.match(html, /模型 B/);
    assert.match(html, /保存模型设置/);
    assert.match(html, /润色最新回复/);
});

test('settings inputs use theme colors instead of white browser defaults', () => {
    const css = fs.readFileSync('public/scripts/extensions/third-party/reply-polisher/style.css', 'utf8');

    assert.match(css, /#reply_polisher_settings\s+(?:input|textarea|select)/);
    assert.match(css, /background-color:\s*var\(--SmartThemeBlurTintColor/);
    assert.match(css, /color:\s*var\(--SmartThemeBodyColor/);
});
