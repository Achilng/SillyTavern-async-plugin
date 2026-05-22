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

The UI extension needs the server plugin because Model B API keys must stay server-side. SillyTavern's URL extension installer does not install server plugins, so create this folder and copy the contents of the bundled `server` folder into it:

```text
SillyTavern/plugins/reply-polisher
```

You can also install it with the Bash helper script after cloning this repository:

```bash
bash install-server-plugin.sh /path/to/SillyTavern
```

Windows Git Bash accepts quoted Windows paths:

```bash
bash install-server-plugin.sh "D:\path\to\SillyTavern"
```

Then create `config.json` from `config.example.json`, or configure Model B from the Reply Polisher settings panel. Ensure SillyTavern has:

```yaml
enableServerPlugins: true
```

Restart SillyTavern after installing or updating the server plugin.

## Troubleshooting 404

If the Reply Polisher settings panel or test button reports HTTP 404, the UI extension is installed but the server plugin route is missing or outdated. Check these three items on the SillyTavern machine that is running the server:

1. `SillyTavern/plugins/reply-polisher/index.js` exists.
2. `config.yaml` has `enableServerPlugins: true`.
3. The latest server plugin files were copied in, then SillyTavern was restarted.

Installing from the GitHub URL only installs the UI extension. It does not install the server plugin.

## Behavior

Model A remains SillyTavern's normal generation model. After SillyTavern receives and renders the generated assistant message, the extension sends only the rewrite prompt and that assistant text to the server plugin once. The server plugin calls Model B, then the UI extension replaces the original message in place.

Notifications are numbered as `正在润色N`, `成功N`, and `失败N` so a rewrite attempt can be traced through the UI.
