// A tiny publish/subscribe hub. Systems announce what happened ("gunshot", "pedDown",
// "carCrash", "missionPassed") and the wanted level, HUD, audio and missions react, without
// any of them importing each other.

export function createEventBus() {
  const listeners = new Map();
  return {
    on(name, handler) {
      if (!listeners.has(name)) listeners.set(name, []);
      listeners.get(name).push(handler);
    },
    emit(name, detail = {}) {
      const handlers = listeners.get(name);
      if (handlers) for (const handler of handlers) handler(detail);
    },
  };
}
