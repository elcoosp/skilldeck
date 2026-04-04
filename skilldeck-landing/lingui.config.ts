import type { LinguiConfig } from "@lingui/conf";

const config: LinguiConfig = {
  locales: ["en"],
  sourceLocale: "en",
  catalogs: [
    {
      path: "<rootDir>/src/locales/{locale}/messages",
      include: ["src/"],
      exclude: [
        "node_modules",
        ".next",
        "src/locales",
        "src/components/ui",
      ],
    },
  ],
  format: "po",
  compileNamespace: "cjs",
};

export default config;
