/**
 * Veltravia Wallet - Perps activity source.
 *
 * There is NO perps trading history yet: live trading (and with it orders,
 * trades and transfers) waits on the Wallet Core signing work. Until then this
 * returns an honest empty list; it never fabricates transactions. When the
 * feed exists, only this function changes: the filter sheet, the filtering
 * (core/perps/activityFilters) and the Activity list already work on
 * PerpsActivityItem[].
 */
import type { PerpsActivityItem } from '../core/perps/activityFilters';

export async function loadPerpsActivity(): Promise<PerpsActivityItem[]> {
  return [];
}
