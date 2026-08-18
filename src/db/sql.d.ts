// Lets us import schema.sql as a raw string via Vite's ?raw suffix.
declare module "*.sql?raw" {
  const content: string;
  export default content;
}
