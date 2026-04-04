---
Task ID: 1
Agent: Main
Task: Integrate LinguiJS i18n with macro system across all landing page components

Work Log:
- Installed @lingui/core, @lingui/macro, @lingui/cli, @lingui/react, @lingui/swc-plugin
- Created lingui.config.ts with en source locale, po format, src/locales/{locale}/messages path
- Created LinguiClientProvider with lazy-loaded catalog import and I18nProvider
- Wrapped layout.tsx with LinguiClientProvider > ABTestProvider > UTMProvider
- Converted 16 component files to use @lingui/react/macro t`` tagged template literals
- Added extract/compile scripts to package.json
- Fixed SWC plugin config: required runtime:"client", localeDir, and sourceLocale params
- Extracted 261 messages, compiled successfully
- Build and dev server both pass clean

Stage Summary:
- All user-facing text across 16 component files wrapped with Lingui t`` macros
- A/B test copy variants also use t`` macros for translatable variants
- .po catalog generated at src/locales/en/messages.po with 261 extracted messages
- Compiled JS catalog at src/locales/en/messages.js
- SWC plugin configured via experimental.swcPlugins in next.config.ts
- serverExternalPackages added for @lingui/cli and @lingui/conf
