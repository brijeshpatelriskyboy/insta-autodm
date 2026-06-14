import type { Request } from "express";

export function getRouteParam(req: Request, name: string): string {
  const value = req.params[name];
  const id = Array.isArray(value) ? value[0] : value;

  if (!id || typeof id !== "string") {
    throw new Error(`Missing route parameter: ${name}`);
  }

  return id;
}
