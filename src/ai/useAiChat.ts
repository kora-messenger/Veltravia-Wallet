/**
 * Veltravia AI — chat state.
 *
 * Owns the message list, streaming, Stop, and the approval lifecycle.
 * A card can be resolved exactly once; resolved cards render read-only.
 */
import { useCallback, useMemo, useRef, useState } from 'react';
import type { AiBrain, AiEvent, ChatAction, ChatContext, ChatMessage, ConsentRequest } from './protocol';
import { localBrain } from './engine';

let idSeq = 0;
const nid = (p: string) => `${p}_${Date.now()}_${++idSeq}`;

export function useAiChat(ctx: ChatContext, brain: AiBrain = localBrain) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [thinking, setThinking] = useState(false);
  const [busy, setBusy] = useState(false);
  const signalRef = useRef<{ aborted: boolean }>({ aborted: false });
  const msgsRef = useRef<ChatMessage[]>([]);
  msgsRef.current = messages;
  const ctxRef = useRef(ctx);
  ctxRef.current = ctx;

  const patch = useCallback((id: string, fn: (m: ChatMessage) => ChatMessage) => {
    setMessages((prev) => prev.map((m) => (m.id === id ? fn(m) : m)));
  }, []);

  const makeEmitter = useCallback(
    (assistantId: string) => (e: AiEvent) => {
      switch (e.type) {
        case 'THINKING_STARTED':
          setThinking(true);
          break;
        case 'THINKING_STOPPED':
          setThinking(false);
          break;
        case 'tool_call':
          patch(assistantId, (m) => ({ ...m, toolLabel: e.label }));
          break;
        case 'text_delta':
          patch(assistantId, (m) => ({ ...m, text: m.text + e.text, toolLabel: undefined }));
          break;
        case 'action':
          patch(assistantId, (m) => ({ ...m, actions: [...m.actions, e.action], toolLabel: undefined }));
          break;
        case 'consent':
          patch(assistantId, (m) => ({ ...m, consent: e.request, toolLabel: undefined }));
          break;
        case 'error':
          patch(assistantId, (m) => ({ ...m, text: m.text || e.message, toolLabel: undefined, streaming: false }));
          break;
        case 'done':
          patch(assistantId, (m) => ({ ...m, streaming: false, toolLabel: undefined }));
          break;
      }
    },
    [patch]
  );

  const finish = useCallback((assistantId: string) => {
    setThinking(false);
    setBusy(false);
    patch(assistantId, (m) => ({ ...m, streaming: false, toolLabel: undefined }));
  }, [patch]);

  /**
   * App-driven sequence (no brain): creates a streaming assistant message and
   * lets the screen emit the same event stream — "AI is thinking..." ->
   * tool label -> text. Used for the wallet lock APPROVAL choreography, which
   * runs after authentication rather than as a chat turn.
   */
  const runLocal = useCallback(
    async (run: (emit: (e: AiEvent) => void, signal: { aborted: boolean }) => Promise<void>) => {
      const assistant: ChatMessage = {
        id: nid('a'), role: 'assistant', text: '', actions: [], streaming: true, createdAt: Date.now(),
      };
      setMessages((prev) => [...prev, assistant]);
      setBusy(true);
      signalRef.current = { aborted: false };
      try {
        await run(makeEmitter(assistant.id), signalRef.current);
      } finally {
        finish(assistant.id);
      }
    },
    [finish, makeEmitter]
  );

  const send = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || busy) return;
      const user: ChatMessage = { id: nid('u'), role: 'user', text: trimmed, actions: [], createdAt: Date.now() };
      const assistant: ChatMessage = {
        id: nid('a'), role: 'assistant', text: '', actions: [], streaming: true, createdAt: Date.now(),
      };
      const history = msgsRef.current;
      setMessages((prev) => [...prev, user, assistant]);
      setBusy(true);
      signalRef.current = { aborted: false };
      try {
        await brain.send(trimmed, history, ctxRef.current, makeEmitter(assistant.id), signalRef.current);
      } finally {
        finish(assistant.id);
      }
    },
    [brain, busy, finish, makeEmitter]
  );

  /** Stop generating. Anything already streamed stays on screen. */
  const stop = useCallback(() => {
    signalRef.current.aborted = true;
    setThinking(false);
    setBusy(false);
    setMessages((prev) => prev.map((m) => (m.streaming ? { ...m, streaming: false, toolLabel: undefined } : m)));
  }, []);

  const answerConsent = useCallback(
    async (messageId: string, req: ConsentRequest, allowed: boolean) => {
      patch(messageId, (m) => ({ ...m, resolved: allowed ? 'allowed' : 'declined' }));
      const assistant: ChatMessage = {
        id: nid('a'), role: 'assistant', text: '', actions: [], streaming: true, createdAt: Date.now(),
      };
      setMessages((prev) => [...prev, assistant]);
      setBusy(true);
      signalRef.current = { aborted: false };
      try {
        await brain.resolveConsent(req, allowed, ctxRef.current, makeEmitter(assistant.id), signalRef.current);
      } finally {
        finish(assistant.id);
      }
    },
    [brain, finish, makeEmitter, patch]
  );

  /** Mark a message's transfer card resolved (approved / rejected / expired). */
  const resolveCard = useCallback(
    (messageId: string, state: NonNullable<ChatMessage['resolved']>) => {
      patch(messageId, (m) => ({ ...m, resolved: state }));
    },
    [patch]
  );

  /** Append a plain assistant line (e.g. the result of an approval). */
  const appendAssistant = useCallback((text: string, actions: ChatAction[] = []) => {
    setMessages((prev) => [
      ...prev,
      { id: nid('a'), role: 'assistant', text, actions, createdAt: Date.now() },
    ]);
  }, []);

  const reset = useCallback(() => {
    signalRef.current.aborted = true;
    setMessages([]);
    setThinking(false);
    setBusy(false);
  }, []);

  /** Replace the conversation with a saved one (opened from Recents). */
  const load = useCallback((saved: ChatMessage[]) => {
    signalRef.current.aborted = true;
    setMessages(saved);
    setThinking(false);
    setBusy(false);
  }, []);

  return useMemo(
    () => ({ messages, thinking, busy, send, stop, answerConsent, resolveCard, appendAssistant, runLocal, reset, load }),
    [messages, thinking, busy, send, stop, answerConsent, resolveCard, appendAssistant, runLocal, reset, load]
  );
}
