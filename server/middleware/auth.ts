import type { NextFunction, Request, Response } from "express";
import { HttpError } from "../lib/http-error";
import { supabaseAdmin } from "../lib/supabase";

export interface AuthContext {
  userId: string;
  email: string;
  accessToken: string;
}

export interface AuthedRequest extends Request {
  auth: AuthContext;
}

export function getBearerToken(req: Request): string | null {
  const header = req.header("authorization");
  if (!header) return null;
  const [scheme, token] = header.split(" ");
  if (!scheme || !token || scheme.toLowerCase() !== "bearer") return null;
  return token;
}

export async function requireAuth(req: Request, _res: Response, next: NextFunction) {
  try {
    const token = getBearerToken(req);
    if (!token) {
      throw new HttpError(401, "Missing bearer token", "AUTH_MISSING_TOKEN");
    }

    const { data, error } = await supabaseAdmin.auth.getUser(token);
    if (error || !data.user) {
      throw new HttpError(401, "Invalid or expired token", "AUTH_INVALID_TOKEN");
    }

    (req as AuthedRequest).auth = {
      userId: data.user.id,
      email: data.user.email ?? "",
      accessToken: token,
    };
    next();
  } catch (error) {
    next(error);
  }
}

