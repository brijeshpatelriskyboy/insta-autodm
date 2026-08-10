import { isSmartCampaignsEnabled } from "../config/smartCampaigns";
import {
  standardDmResponseService,
  type StandardDmExecuteParams,
  type StandardDmResponseResult,
} from "./standardDmResponse.service";

/**
 * Post-match / pre-send response router (V2 foundation seam).
 *
 * This task: ALWAYS StandardDmResponseService.
 * - flag missing/false → Standard DM
 * - flag true → still Standard DM (no alternate response module yet)
 *
 * Must not import or invoke any smart-campaign response module.
 */
export const responseRouter = {
  async dispatch(params: StandardDmExecuteParams): Promise<StandardDmResponseResult> {
    // Read flag for future branching; foundation seam does not diverge yet.
    void isSmartCampaignsEnabled();

    // Future (not in this task): optional alternate response when flag is on.

    return standardDmResponseService.execute(params);
  },
};
