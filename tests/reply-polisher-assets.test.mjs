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
    assert.match(script, /\/test/);
    assert.match(script, /已获取/);
    assert.match(script, /服务端插件不可用/);
    assert.match(script, /正在润色\$\{attemptId\}/);
    assert.match(script, /成功\$\{attemptId\}/);
    assert.match(script, /失败\$\{attemptId\}/);
    assert.match(script, /回复在润色期间已变化/);
    assert.match(script, /服务器插件不可用/);
});

test('runtime uses a shared global lock across duplicate extension instances', () => {
    const script = fs.readFileSync('public/scripts/extensions/third-party/reply-polisher/index.js', 'utf8');

    assert.match(script, /__replyPolisherRuntime/);
    assert.match(script, /runtime\.activeRewrites/);
    assert.match(script, /runtime\.autoRewriteAttempts/);
    assert.match(script, /runtime\.attemptCounter/);
});

test('auto rewrite is gated by received and rendered generated messages', () => {
    const script = fs.readFileSync('public/scripts/extensions/third-party/reply-polisher/index.js', 'utf8');

    assert.match(script, /GENERATION_STARTED/);
    assert.match(script, /MESSAGE_RECEIVED/);
    assert.match(script, /CHARACTER_MESSAGE_RENDERED/);
    assert.doesNotMatch(script, /GENERATION_ENDED/);
    assert.doesNotMatch(script, /MESSAGE_SWIPED/);
    assert.doesNotMatch(script, /maxAttempts/);
});

test('repository root is installable as a SillyTavern URL extension', () => {
    const manifest = JSON.parse(fs.readFileSync('manifest.json', 'utf8'));

    assert.equal(manifest.display_name, 'Reply Polisher');
    assert.equal(manifest.js, 'index.js?v=0.1.2');
    assert.equal(fs.existsSync('index.js'), true);
    assert.equal(fs.existsSync('core.js'), true);
    assert.equal(fs.existsSync('settings.html'), true);
    assert.equal(fs.existsSync('style.css'), true);
    assert.match(fs.readFileSync('README.md', 'utf8'), /https:\/\/github\.com\/Achilng\/SillyTavern-async-plugin\.git/);
});

test('server plugin installer script is present and documented', () => {
    const script = fs.readFileSync('install-server-plugin.sh', 'utf8');
    const readme = fs.readFileSync('README.md', 'utf8');

    assert.match(script, /^#!\/usr\/bin\/env bash/);
    assert.match(script, /SILLYTAVERN_DIR/);
    assert.match(script, /cygpath/);
    assert.match(script, /plugins\/\$\{PLUGIN_ID\}/);
    assert.match(script, /enableServerPlugins/);
    assert.match(readme, /install-server-plugin\.sh/);
});
