import type { Request, Response, NextFunction } from "express";
import { z } from "zod";
import { ACCOUNT_DELETE_CONFIRMATION, accountService } from "../services/account.service";
import { AppError } from "../utils/errors";

const deleteAccountSchema = z.object({
  currentPassword: z.string().min(1),
  confirmation: z.literal(ACCOUNT_DELETE_CONFIRMATION, {
    errorMap: () => ({ message: `Type ${ACCOUNT_DELETE_CONFIRMATION} to confirm account deletion` }),
  }),
});

export class AccountController {
  async deleteAccount(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw new AppError(401, "Authentication required");
      }
      const body = deleteAccountSchema.parse(req.body);
      const result = await accountService.deleteAccount(req.user.id, body);
      res.json(result);
    } catch (error) {
      next(error);
    }
  }
}

export const accountController = new AccountController();
