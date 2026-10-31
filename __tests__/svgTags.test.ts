/* node builtins via require: the app tsconfig carries no node types (RN app) */
const nodeFs = require('fs') as { readdirSync: any; readFileSync: any; statSync: any };
const nodePath = require('path') as { join: any };
const { readdirSync, readFileSync, statSync } = nodeFs;
const { join } = nodePath;



/**
 * React Native resolves a lowercase JSX tag to a NATIVE view by name. Inside
 * react-native-svg that means `<stop>` asks for a native "stop" component that
 * does not exist, and the app dies on the device the moment it renders — while
 * the test renderer happily accepts it. That is exactly how "Pair a new device"
 * crashed on 31 Oct 2026 (PairDeviceIntro), so the rule is now a test.
 */
const SVG_PRIMITIVES = ['stop', 'lineargradient', 'radialgradient', 'clippath', 'defs', 'g', 'mask', 'pattern', 'symbol', 'text', 'tspan'];

const walk = (dir: string): string[] =>
  readdirSync(dir).flatMap((name: string) => {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) return walk(p);
    return p.endsWith('.tsx') ? [p] : [];
  });

describe('svg primitives are spelled the way react-native-svg exports them', () => {
  it('no lowercase svg primitive tags anywhere in src', () => {
    const offenders: string[] = [];
    const stripComments = (src: string) =>
      src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|\s)\/\/[^\n]*/g, '$1');
    for (const file of walk('src')) {
      const src = stripComments(readFileSync(file, 'utf8'));
      for (const tag of SVG_PRIMITIVES) {
        // <stop ...> or </stop>, but never <Stop ...>
        const re = new RegExp(`<${tag}[\\s/>]|</${tag}>`);
        if (re.test(src)) offenders.push(`${file}: <${tag}>`);
      }
    }
    expect(offenders).toEqual([]);
  });
});
