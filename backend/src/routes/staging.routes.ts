import type { NextFunction, Request, Response } from "express";
import { Router } from "express";
import { AppError } from "../utils/errors";
import {
  assertMetaPrivateReplyStubMayRun,
  configureMetaPrivateReplyStub,
  getMetaPrivateReplyStubCaptures,
  isMetaPrivateReplyStubActive,
  resetMetaPrivateReplyStub,
} from "../services/metaPrivateReplyStub";

/**
 * Staging-only diagnostics for Level 1 Meta stub tests.
 * Mount only when the stub is actively enabled — never on production.
 */
function requireMetaStub(req: Request, _res: Response, next: NextFunction): void {
  try {
    if (!assertMetaPrivateReplyStubMayRun()) {
      next(new AppError(404, "Not found"));
      return;
    }
  } catch (error) {
    next(
      new AppError(
        503,
        error instanceof Error ? error.message : "Meta stub unavailable",
      ),
    );
    return;
  }
  next();
}

const router = Router();
router.use(requireMetaStub);

router.get("/status", (_req, res) => {
  res.json({
    stubActive: isMetaPrivateReplyStubActive(),
    deploymentEnv: process.env.COMMENT2DM_DEPLOYMENT_ENV ?? null,
    captureCount: getMetaPrivateReplyStubCaptures().length,
  });
});

router.get("/captures", (_req, res) => {
  // Safe fields only — never includes access tokens or secrets.
  res.json({ captures: getMetaPrivateReplyStubCaptures() });
});

router.post("/configure", (req, res, next) => {
  try {
    const body = (req.body ?? {}) as {
      failCommentIds?: string[];
      failNextCount?: number;
      clearCaptures?: boolean;
    };
    configureMetaPrivateReplyStub({
      failCommentIds: Array.isArray(body.failCommentIds) ? body.failCommentIds : undefined,
      failNextCount:
        typeof body.failNextCount === "number" ? body.failNextCount : undefined,
      clearCaptures: body.clearCaptures === true,
    });
    res.json({ ok: true, captureCount: getMetaPrivateReplyStubCaptures().length });
  } catch (error) {
    next(error);
  }
});

router.post("/reset", (_req, res, next) => {
  try {
    resetMetaPrivateReplyStub();
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

export function createStagingRoutes(): Router | null {
  try {
    if (!assertMetaPrivateReplyStubMayRun()) {
      return null;
    }
  } catch {
    return null;
  }
  return router;
}

export default router;
