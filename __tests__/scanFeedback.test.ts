import { NativeModules, Vibration } from 'react-native';
import { captureFeedback, captureBell } from '../src/core/scanFeedback';

const mockCapture = jest.fn();
const mockBell = jest.fn();

beforeEach(() => {
  jest.clearAllMocks();
  (NativeModules as any).VeltraviaScanFeedback = { capture: mockCapture, bell: mockBell };
});

afterAll(() => { delete (NativeModules as any).VeltraviaScanFeedback; });

describe('scanner capture feedback', () => {
  it('plays the bell and the tick on a camera capture', () => {
    captureFeedback();
    expect(mockCapture).toHaveBeenCalledTimes(1);
    expect(mockBell).not.toHaveBeenCalled();
  });

  it('gallery reads ring the bell without a tick', () => {
    captureBell();
    expect(mockBell).toHaveBeenCalledTimes(1);
    expect(mockCapture).not.toHaveBeenCalled();
  });

  it('never throws if the native module fails (a scan must still complete)', () => {
    mockCapture.mockImplementationOnce(() => { throw new Error('no audio device'); });
    expect(() => captureFeedback()).not.toThrow();
  });

  it('falls back to a 35ms vibration when the native module is missing', () => {
    delete (NativeModules as any).VeltraviaScanFeedback;
    const vibrate = jest.spyOn(Vibration, 'vibrate').mockImplementation(() => {});
    captureFeedback();
    expect(vibrate).toHaveBeenCalledWith(35);
    expect(() => captureBell()).not.toThrow();   // no native bell: silence, not a crash
    vibrate.mockRestore();
  });
});
