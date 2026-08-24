import type { ModuleAccount, ModuleDataProvider } from "@holovant/module-contracts";

interface MultiAccountOptions<TData> {
  accounts: ModuleAccount<TData>[];
  /**
   * Combines the accounts into the module's headline figures. Supplied by the
   * module because only it knows which fields add up, which average, and which
   * mean nothing combined — summing follower counts is right, summing
   * percentages is not.
   */
  aggregate: (accounts: ModuleAccount<TData>[]) => TData;
}

/**
 * A provider for a module holding several connected accounts. Phase 3 swaps
 * this for one that fetches each account from a real API; the shape callers
 * see does not change.
 */
export function createMultiAccountProvider<TData>({
  accounts,
  aggregate,
}: MultiAccountOptions<TData>): ModuleDataProvider<TData> {
  return {
    getSnapshot: () => aggregate(accounts),
    listAccounts: () => accounts,
  };
}

/** Total of one numeric field across accounts. */
export function sumBy<TData>(
  accounts: ModuleAccount<TData>[],
  pick: (data: TData) => number,
): number {
  return accounts.reduce((total, account) => total + pick(account.data), 0);
}

/**
 * Average of a rate, weighted by account size. A small account growing 40% and
 * a large one flat do not average to 20% in any sense the user cares about.
 */
export function weightedAverage<TData>(
  accounts: ModuleAccount<TData>[],
  pickRate: (data: TData) => number,
  pickWeight: (data: TData) => number,
): number {
  const totalWeight = sumBy(accounts, pickWeight);
  if (totalWeight === 0) return 0;
  const weighted = accounts.reduce(
    (total, account) => total + pickRate(account.data) * pickWeight(account.data),
    0,
  );
  return weighted / totalWeight;
}

/** The largest single value across accounts — a best post is one post, not a total. */
export function maxBy<TData>(
  accounts: ModuleAccount<TData>[],
  pick: (data: TData) => number,
): number {
  return accounts.reduce((best, account) => Math.max(best, pick(account.data)), 0);
}
