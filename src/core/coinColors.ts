/** Brand colour per coin, used for the QR centre logo (screen + shared PNG). */
const COLORS: Record<string, string> = {
  BNB: '#F3BA2F',
  ETH: '#627EEA',
  POL: '#6F41D8',
  BTC: '#F7931A',
  SOL: '#14F195',
  TRX: '#EF0027',
  LTC: '#BFBBBB',
  USDT: '#26A17B',
};

export function coinColor(symbol: string): string {
  return COLORS[symbol] ?? '#6C63FF';
}
