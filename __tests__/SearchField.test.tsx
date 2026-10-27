import React from 'react';
import renderer, { act } from 'react-test-renderer';
import { TextInput } from 'react-native';

jest.mock('../src/theme/ThemeProvider', () => ({
  useTheme: () => ({ theme: { mode: 'light', ink: '#000', inkMuted: '#888' } }),
}));
jest.mock('../src/components/icons', () => ({ SearchIcon: () => null, CloseIcon: () => null }));

import SearchField from '../src/components/SearchField';

// The X is the only element carrying onPress + hitSlop in the field.
const xButtons = (t: renderer.ReactTestRenderer) =>
  t.root.findAll((n) => typeof n.props.onPress === 'function' && n.props.hitSlop === 12 && typeof n.type !== 'string');

describe('SearchField clear (X) button', () => {
  it('is hidden while empty, shown once there is text, and clears on tap', () => {
    const onChange = jest.fn();
    let tree: renderer.ReactTestRenderer;
    act(() => { tree = renderer.create(<SearchField value="" onChangeText={onChange} />); });
    expect(xButtons(tree!)).toHaveLength(0); // no X when empty

    act(() => { tree!.update(<SearchField value="j" onChangeText={onChange} />); });
    const x = xButtons(tree!);
    expect(x.length).toBeGreaterThan(0); // X appears with text

    act(() => { x[0].props.onPress(); });
    expect(onChange).toHaveBeenCalledWith(''); // tap clears

    act(() => { tree!.update(<SearchField value="" onChangeText={onChange} />); });
    expect(xButtons(tree!)).toHaveLength(0); // gone again
  });

  it('forwards the placeholder', () => {
    let tree: renderer.ReactTestRenderer;
    act(() => { tree = renderer.create(<SearchField value="" onChangeText={() => {}} placeholder="Search for network" />); });
    expect(tree!.root.findByType(TextInput).props.placeholder).toBe('Search for network');
  });
});
