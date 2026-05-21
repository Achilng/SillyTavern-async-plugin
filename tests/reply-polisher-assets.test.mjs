import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('settings UI is localized to Chinese', () => {
    const html = fs.readFileSync('public/scripts/extensions/third-party/reply-polisher/settings.html', 'utf8');

    assert.match(html, /启用/);
    assert.match(html, /自动润色/);
    assert.match(html, /模型 B/);
    assert.match(html, /获取模型列表/);
    assert.match(html, /选择模型/);
    assert.match(html, /保存模型设置/);
    assert.match(html, /润色最新回复/);
});

test('settings inputs use theme colors instead of white browser defaults', () => {
    const css = fs.readFileSync('public/scripts/extensions/third-party/reply-polisher/style.css', 'utf8');

    assert.match(css, /#reply_polisher_settings\s+(?:input|textarea|select)/);
    assert.match(css, /background-color:\s*var\(--SmartThemeBlurTintColor/);
    assert.match(css, /color:\s*var\(--SmartThemeBodyColor/);
});

test('settings action buttons keep Chinese labels horizontal', () => {
    const css = fs.readFileSync('public/scripts/extensions/third-party/reply-polisher/style.css', 'utf8');

    assert.match(css, /\.reply-polisher-actions\s+\.menu_button/);
    assert.match(css, /width:\s*fit-content/);
    assert.match(css, /white-space:\s*nowrap/);
});

test('runtime notifications explain rewrite progress in Chinese', () => {
    const script = fs.readFileSync('public/scripts/extensions/third-party/reply-polisher/index.js', 'utf8');

    assert.match(script, /reply_polisher_load_models/);
    assert.match(script, /\/models/);
    assert.match(script, /已获取/);
    assert.match(script, /正在自动润色回复/);
    assert.match(script, /正在润色最新回复/);
    assert.match(script, /自动润色完成/);
    assert.match(script, /正在基于最新内容重新润色/);
    assert.match(script, /服务器插件不可用/);
});
