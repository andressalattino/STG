export type Page = "inicio" | "viajes" | "comunidad" | "admin";
export const pageTitles: Record<Page, string> = {
  inicio: "Inicio",
  viajes: "Viajes",
  comunidad: "Comunidad",
  admin: "Admin",
};
export const pagePaths: Record<Page, string> = {
  inicio: "/",
  viajes: "/viajes",
  comunidad: "/comunidad",
  admin: "/admin",
};
