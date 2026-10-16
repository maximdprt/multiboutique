// Au démarrage du serveur : signale dans les journaux les variables d'environnement mal remplies.
// Le site démarre quand même (le mode démo doit toujours fonctionner).
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { readEnv } = await import("./lib/env");
  const { issues } = readEnv();
  for (const i of issues) console.warn(`[configuration] ${i.key} : ${i.message}`);
  if (issues.length) console.warn("[configuration] Détail et marche à suivre dans l'admin : Réglages > État des services.");
}
