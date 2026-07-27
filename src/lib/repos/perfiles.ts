/** Repositorio del perfil del cuidador. */
import { crearRepositorio } from "./base";

export interface Perfil extends Record<string, unknown> {
  id: string;
  full_name: string | null;
}

export const perfilesRepo = crearRepositorio<Perfil>("profiles");
