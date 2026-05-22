# Reply Polisher

Reply Polisher is a SillyTavern UI extension plus server plugin that rewrites the latest assistant reply with a separately configured OpenAI-compatible model.

## Install UI Extension From URL

In SillyTavern, open **Extensions** -> **Install extension**, then use:

```text
https://github.com/Achilng/SillyTavern-async-plugin.git
```

SillyTavern installs Git URL extensions from the repository root, so this repository keeps the UI extension files at the root:

- `manifest.json`
- `index.js`
- `core.js`
- `settings.html`
- `style.css`

## Install Server Plugin

The UI extension needs the server plugin because Model B API keys must stay server-side. SillyTavern's URL extension installer does not install server plugins, so copy the bundled `server` folder to:

```text
SillyTavern/plugins/reply-polisher
```

Then create `config.json` from `config.example.json`, or configure Model B from the Reply Polisher settings panel. Ensure SillyTavern has:

```yaml
enableServerPlugins: true
```

Restart SillyTavern after installing or updating the server plugin.

## Behavior

Model A remains SillyTavern's normal generation model. After SillyTavern receives and renders the generated assistant message, the extension sends only the rewrite prompt and that assistant text to the server plugin once. The server plugin calls Model B, then the UI extension replaces the original message in place.

Notifications are numbered as `正在润色N`, `成功N`, and `失败N` so a rewrite attempt can be traced through the UI.
