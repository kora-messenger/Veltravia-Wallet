import React from 'react';
import renderer, { act } from 'react-test-renderer';
import { Dimensions } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

jest.mock('../src/theme/ThemeProvider', () => ({
  useTheme: () => ({ theme: { mode: 'light', ink: '#0F111A', inkMuted: '#8A8EA3', brand: '#6C63FF', brandGradient: ['#6C63FF', '#4A90D9'], buttonGradient: ['#6C63FF', '#4A90D9'], background: '#FFFFFF', surface: '#F5F5F7', surfaceAlt: '#EDEDF0' } }),
}));
jest.mock('../src/core/security/appLockState', () => ({ useAppLocked: () => false }));
jest.mock('../src/components/Toast', () => ({ showToast: jest.fn() }));
const mockPick = jest.fn();
jest.mock('../src/core/dateTimePicker', () => ({
  pickDateTime: (...a: any[]) => mockPick(...a),
  formatRangeStamp: (ms: number) => `stamp:${ms}`,
}));

import PerpsFilterSheet, {
  PerpsActivityFilters, DEFAULT_PERPS_ACTIVITY_FILTERS,
} from '../src/components/PerpsFilterSheet';
import { showToast } from '../src/components/Toast';
import { PERP_SECTIONS } from '../src/services/perpsMarkets';

const DAY = 86_400_000;

const mount = async (opts: { filters?: PerpsActivityFilters; onApply?: jest.Mock; onClose?: jest.Mock } = {}) => {
  const onApply = opts.onApply ?? jest.fn();
  const onClose = opts.onClose ?? jest.fn();
  let tree!: renderer.ReactTestRenderer;
  await act(async () => {
    tree = renderer.create(
      <SafeAreaProvider initialMetrics={{ frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 24, left: 0, right: 0, bottom: 16 } }}>
        <PerpsFilterSheet visible filters={opts.filters ?? DEFAULT_PERPS_ACTIVITY_FILTERS} onClose={onClose} onApply={onApply} />
      </SafeAreaProvider>,
    );
  });
  return { tree, onApply, onClose };
};
const byId = (t: renderer.ReactTestRenderer, id: string) => t.root.findAll((n) => n.props.testID === id)[0];
const press = async (t: renderer.ReactTestRenderer, id: string) => {
  const node = byId(t, id);
  if (!node) throw new Error(`no node ${id}`);
  await act(async () => { await node.props.onPress(); });
};
const flat = (c: any): string =>
  Array.isArray(c) ? c.map(flat).join('') : c && typeof c === 'object' ? flat(c.props?.children) : String(c ?? '');
const texts = (t: renderer.ReactTestRenderer) =>
  t.root.findAll((n) => typeof n.props.children === 'string').map((n) => n.props.children as string);
const selected = (t: renderer.ReactTestRenderer, id: string) => byId(t, id).props.accessibilityState.selected;
const flush = async () => { await act(async () => { jest.advanceTimersByTime(400); }); };

beforeEach(() => { jest.useFakeTimers(); mockPick.mockReset(); (showToast as jest.Mock).mockClear(); });
afterEach(() => { jest.useRealTimers(); });
beforeAll(() => {
  jest.spyOn(Dimensions, 'get').mockReturnValue({ width: 390, height: 844, scale: 2, fontScale: 1 } as any);
});

describe('layout: three areas, only the middle scrolls', () => {
  it('has a fixed header, a scroll body, and a fixed footer', async () => {
    const { tree } = await mount();
    expect(byId(tree, 'filterHeader')).toBeTruthy();
    expect(byId(tree, 'filterFooter')).toBeTruthy();
    const body = byId(tree, 'filterBody');
    expect(body).toBeTruthy();

    // header and footer are NOT inside the scroll view
    const insideBody = (id: string) => body.findAll((n) => n.props.testID === id).length;
    expect(insideBody('filterHeader')).toBe(0);
    expect(insideBody('filterFooter')).toBe(0);
    expect(insideBody('showResults')).toBe(0);
    expect(insideBody('filterClose')).toBe(0);
    // ...and the sections are
    expect(insideBody('chip-hyperliquid')).toBeGreaterThan(0);
    expect(insideBody('assetsRow')).toBeGreaterThan(0);
    await act(async () => { tree.unmount(); });
  });

  it('is a fixed-height sheet, so opening Custom grows the body, never the header or button', async () => {
    const { tree } = await mount();
    const h = () => [byId(tree, 'perpsFilterSheet').props.style].flat(Infinity).filter(Boolean)
      .reduce((a: any, b: any) => ({ ...a, ...b }), {}).height;
    const before = h();
    await press(tree, 'chip-custom');
    expect(h()).toBe(before);
    expect(byId(tree, 'customRange')).toBeTruthy();
    await act(async () => { tree.unmount(); });
  });

  it('the Show results button matches the recording: 60dp tall, pill, solid #392EFA', async () => {
    const { tree } = await mount();
    const st = [byId(tree, 'showResults').props.style({ pressed: false })].flat(Infinity).filter(Boolean)
      .reduce((a: any, b: any) => ({ ...a, ...b }), {});
    expect(st.height).toBe(60);
    expect(st.borderRadius).toBe(30);
    expect(st.backgroundColor).toBe('#392EFA');
    await act(async () => { tree.unmount(); });
  });

  it('renders every section from the recording', async () => {
    const { tree } = await mount();
    const all = texts(tree);
    for (const expected of [
      'Filter', 'Reset', 'Provider', 'Hyperliquid', 'Aster', 'Assets', 'Select',
      'Type', 'Order', 'Trade', 'Transfer', 'Show funding payment', 'Status',
      'Completed', 'Submitted', 'Processing', 'Failed', 'Date', '7d', '30d', '90d', 'Custom', 'Show results',
    ]) expect(all).toContain(expected);
    await act(async () => { tree.unmount(); });
  });
});

describe('selection', () => {
  it('providers allow one OR several', async () => {
    const { tree } = await mount();
    await press(tree, 'chip-hyperliquid');
    expect(selected(tree, 'chip-hyperliquid')).toBe(true);
    await press(tree, 'chip-aster');
    expect(selected(tree, 'chip-hyperliquid')).toBe(true);
    expect(selected(tree, 'chip-aster')).toBe(true);
    await press(tree, 'chip-hyperliquid');
    expect(selected(tree, 'chip-hyperliquid')).toBe(false);
    expect(selected(tree, 'chip-aster')).toBe(true);
    await act(async () => { tree.unmount(); });
  });

  it('types and statuses are multi-select; date is single', async () => {
    const { tree } = await mount();
    await press(tree, 'chip-order'); await press(tree, 'chip-transfer');
    expect(selected(tree, 'chip-order')).toBe(true);
    expect(selected(tree, 'chip-trade')).toBe(false);
    expect(selected(tree, 'chip-transfer')).toBe(true);
    await press(tree, 'chip-failed'); await press(tree, 'chip-completed');
    expect(selected(tree, 'chip-failed')).toBe(true);
    expect(selected(tree, 'chip-completed')).toBe(true);

    await press(tree, 'chip-7d');
    await press(tree, 'chip-30d');
    expect(selected(tree, 'chip-7d')).toBe(false);
    expect(selected(tree, 'chip-30d')).toBe(true);
    await press(tree, 'chip-30d');                      // tapping the active one clears it
    expect(selected(tree, 'chip-30d')).toBe(false);
    await act(async () => { tree.unmount(); });
  });

  it('the funding switch flips and says so for screen readers', async () => {
    const { tree } = await mount();
    expect(byId(tree, 'fundingToggle').props.accessibilityState).toEqual({ checked: false });
    await press(tree, 'fundingToggle');
    expect(byId(tree, 'fundingToggle').props.accessibilityState).toEqual({ checked: true });
    await act(async () => { tree.unmount(); });
  });
});

describe('Reset', () => {
  it('is inert on a clean draft and clears every family once something is set', async () => {
    const { tree } = await mount();
    expect(byId(tree, 'filterReset').props.disabled).toBe(true);

    await press(tree, 'chip-aster'); await press(tree, 'chip-order'); await press(tree, 'chip-failed');
    await press(tree, 'fundingToggle'); await press(tree, 'chip-90d');
    expect(byId(tree, 'filterReset').props.disabled).toBe(false);

    await press(tree, 'filterReset');
    for (const id of ['chip-aster', 'chip-order', 'chip-failed', 'chip-90d']) expect(selected(tree, id)).toBe(false);
    expect(byId(tree, 'fundingToggle').props.accessibilityState).toEqual({ checked: false });
    expect(byId(tree, 'assetsValue').props.children).toBe('Select');
    expect(byId(tree, 'filterReset').props.disabled).toBe(true);
    await act(async () => { tree.unmount(); });
  });
});

describe('Assets picker', () => {
  it('opens inside the sheet and lists the app\'s real markets, nothing invented', async () => {
    const { tree } = await mount();
    await press(tree, 'assetsRow');
    expect(byId(tree, 'perpsAssetPicker')).toBeTruthy();
    expect(byId(tree, 'filterBody')).toBeUndefined();         // the filter body is replaced, not stacked

    const real = new Set(PERP_SECTIONS.flatMap((s) => s.markets.map((m) => m.symbol)));
    const listed = tree.root.findAll((n) => typeof n.props.testID === 'string' && n.props.testID.startsWith('asset-'))
      .map((n) => n.props.testID.replace('asset-', ''))
      .filter((v) => !['Back', 'Clear', 'Search', 'Done', 'Empty'].includes(v));
    expect(listed.length).toBeGreaterThan(0);
    for (const sym of listed) expect(real.has(sym)).toBe(true);
    await act(async () => { tree.unmount(); });
  });

  it('search narrows the list, selection is multi, Done returns with a count', async () => {
    const { tree } = await mount();
    await press(tree, 'assetsRow');

    await act(async () => { byId(tree, 'assetSearch').props.onChangeText('btc'); });
    expect(byId(tree, 'asset-BTC')).toBeTruthy();
    expect(byId(tree, 'asset-ETH')).toBeUndefined();
    await act(async () => { byId(tree, 'assetSearch').props.onChangeText(''); });

    await press(tree, 'asset-BTC'); await press(tree, 'asset-ETH');
    expect(byId(tree, 'asset-BTC').props.accessibilityState.checked).toBe(true);
    expect(byId(tree, 'asset-ETH').props.accessibilityState.checked).toBe(true);
    expect(byId(tree, 'assetDone').props.accessibilityLabel).toBe('Done, 2 selected');

    await press(tree, 'assetDone');
    expect(byId(tree, 'filterBody')).toBeTruthy();
    expect(byId(tree, 'assetsValue').props.children).toBe('2 selected');

    // one selected shows the symbol itself
    await press(tree, 'assetsRow');
    await press(tree, 'asset-ETH');
    await press(tree, 'assetDone');
    expect(byId(tree, 'assetsValue').props.children).toBe('BTC');
    await act(async () => { tree.unmount(); });
  });

  it('shows an empty state when nothing matches, and Back discards the unsaved picks', async () => {
    const { tree } = await mount();
    await press(tree, 'assetsRow');
    await act(async () => { byId(tree, 'assetSearch').props.onChangeText('zzzzz'); });
    expect(byId(tree, 'assetEmpty')).toBeTruthy();
    await act(async () => { byId(tree, 'assetSearch').props.onChangeText(''); });
    await press(tree, 'asset-BTC');
    await press(tree, 'assetBack');
    expect(byId(tree, 'assetsValue').props.children).toBe('Select');
    await act(async () => { tree.unmount(); });
  });

  it('is narrowed by the providers already chosen', async () => {
    const { tree } = await mount();
    await press(tree, 'chip-aster');
    await press(tree, 'assetsRow');
    expect(byId(tree, 'asset-ANT')).toBeTruthy();       // an Aster market
    expect(byId(tree, 'asset-BTC')).toBeUndefined();    // a Hyperliquid one
    await act(async () => { tree.unmount(); });
  });
});

describe('Custom dates', () => {
  it('seeds Start/End as now-7d to now and shows the pickers', async () => {
    const { tree } = await mount();
    await press(tree, 'chip-custom');
    const start = Number(byId(tree, 'range-start-value').props.children.replace('stamp:', ''));
    const end = Number(byId(tree, 'range-end-value').props.children.replace('stamp:', ''));
    expect(end - start).toBe(7 * DAY);
    await act(async () => { tree.unmount(); });
  });

  it('opens the picker with the other side as its limit, and applies the pick', async () => {
    const { tree } = await mount();
    await press(tree, 'chip-custom');
    const end = Number(byId(tree, 'range-end-value').props.children.replace('stamp:', ''));
    const start = Number(byId(tree, 'range-start-value').props.children.replace('stamp:', ''));

    mockPick.mockResolvedValueOnce(start + DAY);
    await press(tree, 'range-start');
    expect(mockPick).toHaveBeenCalledWith(expect.objectContaining({ max: end }));
    expect(byId(tree, 'range-start-value').props.children).toBe(`stamp:${start + DAY}`);

    mockPick.mockResolvedValueOnce(end - DAY);
    await press(tree, 'range-end');
    expect(mockPick).toHaveBeenLastCalledWith(expect.objectContaining({ min: start + DAY }));
    expect(byId(tree, 'range-end-value').props.children).toBe(`stamp:${end - DAY}`);
    expect(showToast).not.toHaveBeenCalled();
    await act(async () => { tree.unmount(); });
  });

  it('start later than end is corrected AND the user is told', async () => {
    const { tree } = await mount();
    await press(tree, 'chip-custom');
    const end = Number(byId(tree, 'range-end-value').props.children.replace('stamp:', ''));
    mockPick.mockResolvedValueOnce(end + 3 * DAY);       // start after end
    await press(tree, 'range-start');
    expect(byId(tree, 'range-start-value').props.children).toBe(`stamp:${end + 3 * DAY}`);
    expect(byId(tree, 'range-end-value').props.children).toBe(`stamp:${end + 3 * DAY}`);
    expect(showToast).toHaveBeenCalledWith(expect.stringContaining('Start can’t be after'), expect.anything());
    await act(async () => { tree.unmount(); });
  });

  it('end earlier than start is corrected AND the user is told', async () => {
    const { tree } = await mount();
    await press(tree, 'chip-custom');
    const start = Number(byId(tree, 'range-start-value').props.children.replace('stamp:', ''));
    mockPick.mockResolvedValueOnce(start - 2 * DAY);
    await press(tree, 'range-end');
    expect(byId(tree, 'range-start-value').props.children).toBe(`stamp:${start - 2 * DAY}`);
    expect(byId(tree, 'range-end-value').props.children).toBe(`stamp:${start - 2 * DAY}`);
    expect(showToast).toHaveBeenCalledWith(expect.stringContaining('End can’t be before'), expect.anything());
    await act(async () => { tree.unmount(); });
  });

  it('cancelling the picker changes nothing', async () => {
    const { tree } = await mount();
    await press(tree, 'chip-custom');
    const before = byId(tree, 'range-start-value').props.children;
    mockPick.mockResolvedValueOnce(null);
    await press(tree, 'range-start');
    expect(byId(tree, 'range-start-value').props.children).toBe(before);
    await act(async () => { tree.unmount(); });
  });
});

describe('Show results and closing', () => {
  it('hands every selection to onApply, then closes after the slide-out', async () => {
    const { tree, onApply, onClose } = await mount();
    await press(tree, 'chip-aster'); await press(tree, 'chip-hyperliquid');
    await press(tree, 'chip-trade'); await press(tree, 'chip-submitted');
    await press(tree, 'fundingToggle'); await press(tree, 'chip-30d');
    await press(tree, 'assetsRow'); await press(tree, 'asset-BTC'); await press(tree, 'assetDone');

    await press(tree, 'showResults');
    expect(onApply).toHaveBeenCalledTimes(1);
    const f = onApply.mock.calls[0][0] as PerpsActivityFilters;
    expect(f).toMatchObject({
      showFundingPayment: true, date: '30d',
      type: ['trade'], status: ['submitted'], assets: ['BTC'],
    });
    expect([...f.providers].sort()).toEqual(['aster', 'hyperliquid']);

    expect(onClose).not.toHaveBeenCalled();
    await flush();
    expect(onClose).toHaveBeenCalledTimes(1);
    await act(async () => { tree.unmount(); });
  });

  it('with nothing chosen it applies the defaults (show everything)', async () => {
    const { tree, onApply } = await mount();
    await press(tree, 'showResults');
    expect(onApply).toHaveBeenCalledWith(DEFAULT_PERPS_ACTIVITY_FILTERS);
    await act(async () => { tree.unmount(); });
  });

  it('the X closes without applying anything', async () => {
    const { tree, onApply, onClose } = await mount();
    await press(tree, 'chip-aster');
    await press(tree, 'filterClose');
    await flush();
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onApply).not.toHaveBeenCalled();
    await act(async () => { tree.unmount(); });
  });

  it('re-opens with the filters that were applied', async () => {
    const { tree } = await mount({ filters: { ...DEFAULT_PERPS_ACTIVITY_FILTERS, providers: ['aster'], status: ['failed'] } });
    expect(selected(tree, 'chip-aster')).toBe(true);
    expect(selected(tree, 'chip-failed')).toBe(true);
    expect(selected(tree, 'chip-hyperliquid')).toBe(false);
    await act(async () => { tree.unmount(); });
  });
});

describe('accessibility', () => {
  const lum = (h: string) => {
    const [r, g, b] = [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255)
      .map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const ratio = (a: string, b: string) => {
    const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
    return (hi + 0.05) / (lo + 0.05);
  };

  it('idle chip text, the Assets value and the date labels pass 4.5:1', async () => {
    const { tree } = await mount();
    const colourOf = (label: string) => {
      const t = tree.root.findAll((n) => n.props.children === label && n.props.style)[0];
      return [t.props.style].flat(Infinity).filter(Boolean).reduce((a: any, b: any) => ({ ...a, ...b }), {}).color as string;
    };
    expect(ratio(colourOf('Completed'), '#EFEEF1')).toBeGreaterThanOrEqual(4.5);
    expect(ratio(colourOf('Select'), '#FFFFFF')).toBeGreaterThanOrEqual(4.5);
    await press(tree, 'chip-custom');
    expect(ratio(colourOf('Start'), '#FFFFFF')).toBeGreaterThanOrEqual(4.5);
    await act(async () => { tree.unmount(); });
  });

  it('every icon-only control has a label', async () => {
    const { tree } = await mount();
    for (const id of ['filterClose', 'filterReset', 'fundingToggle', 'assetsRow', 'showResults']) {
      expect(byId(tree, id).props.accessibilityLabel).toBeTruthy();
    }
    await act(async () => { tree.unmount(); });
  });
});
