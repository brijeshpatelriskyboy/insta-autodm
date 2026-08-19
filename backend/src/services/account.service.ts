import bcrypt from "bcryptjs";
import { billingService } from "./billing.service";
import { prisma } from "../lib/prisma";
import { AppError } from "../utils/errors";

export const ACCOUNT_DELETE_CONFIRMATION = "DELETE";

export class AccountService {
  /**
   * Delete the authenticated user's Comment2DM account and owned application data.
   *
   * Campaign rows use Restrict on codes/claims, so children are deleted first
   * (same order as staging allocator cleanup). Remaining User relations cascade.
   */
  async deleteAccount(
    userId: string,
    input: { currentPassword: string; confirmation: string },
  ): Promise<{ deleted: true }> {
    if (input.confirmation !== ACCOUNT_DELETE_CONFIRMATION) {
      throw new AppError(400, `Type ${ACCOUNT_DELETE_CONFIRMATION} to confirm account deletion`);
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, passwordHash: true },
    });

    if (!user) {
      throw new AppError(404, "User not found");
    }

    const valid = await bcrypt.compare(input.currentPassword, user.passwordHash);
    if (!valid) {
      throw new AppError(401, "Current password is incorrect");
    }

    await billingService.stopBillableSubscriptionForAccountDeletion(userId);

    await prisma.$transaction(async (tx) => {
      await tx.campaignClaim.deleteMany({ where: { campaign: { userId } } });
      await tx.campaignCode.deleteMany({ where: { campaign: { userId } } });
      await tx.campaign.deleteMany({ where: { userId } });
      await tx.user.delete({ where: { id: userId } });
    });

    return { deleted: true };
  }
}

export const accountService = new AccountService();
