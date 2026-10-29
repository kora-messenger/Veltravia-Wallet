import { codeTargetRect, morphDuration, MIN_TARGET, PADDING } from '../src/services/scanFrame';

const SCREEN = { width: 411, height: 891 };

describe('scan brackets snapping to a detected code', () => {
  it('squares up around the code with padding, centred on it', () => {
    const r = codeTargetRect({ frame: { x: 150, y: 400, width: 100, height: 100 } }, SCREEN)!;
    expect(r.width).toBe(100 + PADDING * 2);
    expect(r.height).toBe(r.width);                       // always square
    expect(r.left + r.width / 2).toBeCloseTo(200);         // centred on the code
    expect(r.top + r.height / 2).toBeCloseTo(450);
  });

  it('takes the longer side for a rectangular frame (never clips the code)', () => {
    const r = codeTargetRect({ frame: { x: 100, y: 300, width: 60, height: 140 } }, SCREEN)!;
    expect(r.width).toBe(140 + PADDING * 2);
  });

  it("uses the code's corners so a tilted code is not framed by its oversized box", () => {
    const tilted = { frame: { x: 80, y: 80, width: 260, height: 260 }, corners: [{ x: 130, y: 120 }, { x: 270, y: 110 }, { x: 275, y: 250 }, { x: 135, y: 255 }] };
    const r = codeTargetRect(tilted, SCREEN)!;
    expect(r.width).toBe(145 + PADDING * 2);              // corner span (x 130..275), not the 260 box
  });

  it('never shrinks below the minimum (the four arms would collapse)', () => {
    const r = codeTargetRect({ frame: { x: 200, y: 500, width: 20, height: 20 } }, SCREEN)!;
    expect(r.width).toBe(MIN_TARGET);
  });

  it('stays fully on screen for a code at the edge', () => {
    const r = codeTargetRect({ frame: { x: 0, y: 880, width: 30, height: 30 } }, SCREEN)!;
    expect(r.left).toBeGreaterThanOrEqual(0);
    expect(r.top).toBeGreaterThanOrEqual(0);
    expect(r.left + r.width).toBeLessThanOrEqual(SCREEN.width);
    expect(r.top + r.height).toBeLessThanOrEqual(SCREEN.height);
  });

  it('ignores unusable geometry (no frame, empty frame, NaNs)', () => {
    expect(codeTargetRect(undefined, SCREEN)).toBeNull();
    expect(codeTargetRect({}, SCREEN)).toBeNull();
    expect(codeTargetRect({ frame: { x: NaN, y: 1, width: 10, height: 10 } }, SCREEN)).toBeNull();
    expect(codeTargetRect({ frame: { x: 1, y: 1, width: 0, height: 10 } }, SCREEN)).toBeNull();
  });
});

describe('morph timing', () => {
  const a = { left: 67, top: 307, width: 277, height: 277 };
  it('is a quick, visible movement for a nearby code', () => {
    const d = morphDuration(a, { ...a, left: 80, top: 320, width: 150, height: 150 });
    expect(d).toBeGreaterThanOrEqual(140);
    expect(d).toBeLessThan(220);
  });
  it('takes longer across the screen but stays under a third of a second', () => {
    const d = morphDuration(a, { left: 0, top: 700, width: 120, height: 120 });
    expect(d).toBeGreaterThan(220);
    expect(d).toBeLessThanOrEqual(320);
  });
});
