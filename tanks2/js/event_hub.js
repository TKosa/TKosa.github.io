class EventHub {
  constructor() { this.eventHandlers = {}; }
  on(event, handler) {
    if (!this.eventHandlers[event]) { this.eventHandlers[event] = []; }
    this.eventHandlers[event].push(handler);
  }
  emit(event, ...rest) {
    const handlers = this.eventHandlers[event];
    if (!handlers || handlers.length === 0) { return; }
    handlers.forEach((handler) => {
      try { handler.apply(null, rest); } catch (_) {}
    });
  }
}

export const eventHub = new EventHub();
