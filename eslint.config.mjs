// Vérification du code (npm run lint) : règles recommandées par Next.js, TypeScript compris.
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { FlatCompat } from "@eslint/eslintrc";

const compat = new FlatCompat({ baseDirectory: dirname(fileURLToPath(import.meta.url)) });

const config = [
  { ignores: ["node_modules/**", ".next/**", ".data/**", "test-results/**", "playwright-report/**", "blob-report/**", "next-env.d.ts"] },
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    rules: {
      // Liens <a> voulus : chaque page des boutiques est chargée en entier, ce qui déclenche la mesure
      // d'audience (PageviewTracker dans app/[host]/layout.tsx). <Link> la contournerait. Voir docs/DECISIONS.md.
      "@next/next/no-html-link-for-pages": "off",
      // Une variable commençant par _ est volontairement ignorée (ex. retirer un champ d'un objet).
      "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_", varsIgnorePattern: "^_", destructuredArrayIgnorePattern: "^_" }],
    },
  },
];

export default config;
