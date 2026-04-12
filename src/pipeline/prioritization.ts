import type { QueueItem, PriorityTier } from "../core/types.js";

export interface PrioritizationConfig {
  sizeFactor: number;       // Weight for PR size (smaller = higher priority)
  ageFactor: number;        // Points per day of age
  criticalBoost: number;    // Boost for critical findings
  labelBoosts: Record<string, number>;  // label -> point boost
}

const DEFAULT_CONFIG: PrioritizationConfig = {
  sizeFactor: 2,
  ageFactor: 5,
  criticalBoost: 100,
  labelBoosts: {
    hotfix: 50,
    urgent: 40,
    "needs-review": 10,
  },
};

export function prioritize(item: QueueItem, config: PrioritizationConfig = DEFAULT_CONFIG): { score: number; tier: PriorityTier } {
  let score = 50; // base score

  // Size factor: smaller PRs get higher priority
  const changedFiles = item.pr.changedFiles || 1;
  const totalChanges = (item.pr.additions || 0) + (item.pr.deletions || 0);
  if (changedFiles <= 5 && totalChanges <= 100) {
    score += 20 * config.sizeFactor;
  } else if (changedFiles <= 15 && totalChanges <= 500) {
    score += 10 * config.sizeFactor;
  }
  // Large PRs get no size bonus

  // Age factor
  const ageMs = Date.now() - new Date(item.pr.createdAt).getTime();
  const ageDays = Math.floor(ageMs / (1000 * 60 * 60 * 24));
  score += ageDays * config.ageFactor;

  // Critical findings boost
  const hasCritical = item.artifacts.some((a) => {
    if (a.type === "markdown") {
      return a.content.toLowerCase().includes("severity: critical") ||
             a.content.toLowerCase().includes("**critical**");
    }
    return false;
  });
  if (hasCritical) score += config.criticalBoost;

  // Label boosts
  for (const label of item.pr.labels) {
    const boost = config.labelBoosts[label.toLowerCase()];
    if (boost) score += boost;
  }

  // Determine tier
  let tier: PriorityTier;
  if (hasCritical || score >= 200) {
    tier = "critical";
  } else if (score >= 120) {
    tier = "high";
  } else if (score >= 70) {
    tier = "medium";
  } else {
    tier = "low";
  }

  return { score, tier };
}
