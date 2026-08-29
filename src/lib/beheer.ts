/*
  Zonder GitHub App valt Keystatic terug op local-mode. Die modus is bedoeld voor
  `npm run dev` en is onbeveiligd (de API toont de bestandsboom van de werkmap en
  schrijft in content/). In productie mag het paneel daarom alleen bestaan als de
  GitHub-mode geconfigureerd is; anders gedragen route en pagina zich als 404.
*/
export function beheerBeschikbaar(
  env: { NODE_ENV?: string; NEXT_PUBLIC_KEYSTATIC_GITHUB_APP_SLUG?: string } = process.env,
): boolean {
  return env.NODE_ENV !== "production" || Boolean(env.NEXT_PUBLIC_KEYSTATIC_GITHUB_APP_SLUG);
}
