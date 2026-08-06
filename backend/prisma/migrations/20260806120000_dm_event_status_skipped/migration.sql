-- Add skipped status for comments claimed before keyword match with no rule hit.
ALTER TYPE "DmEventStatus" ADD VALUE 'skipped';
