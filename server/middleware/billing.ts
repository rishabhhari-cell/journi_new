import type { NextFunction, Request, Response } from "express";
import { HttpError } from "../lib/http-error";
import type { AuthedRequest } from "./auth";
import { getSubscriptionForUser, hasProEntitlement } from "../services/billing.service";

export async function requireProAccess(req: Request, _res: Response, next: NextFunction) {
  try {
    const authReq = req as unknown as AuthedRequest;
    const subscription = await getSubscriptionForUser(authReq.auth.userId);
    const status = subscription?.status ?? "unknown";
    if (!hasProEntitlement(status)) {
      throw new HttpError(402, "Active Pro subscription required", "BILLING_INACTIVE", {
        status,
      });
    }
    next();
  } catch (error) {
    next(error);
  }
}
