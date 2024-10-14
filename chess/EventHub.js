// EventHub.js
class EventHub {
  constructor() {
    if (EventHub.instance) {
      return EventHub.instance;
    }

    this.eventHandlers = {};

    EventHub.instance = this;
  }

  on(event, handler) {
    if (!this.eventHandlers[event]) {
      this.eventHandlers[event] = [];
    }
    this.eventHandlers[event].push(handler);
  }

  emit(event, ...args) {
    const handlers = this.eventHandlers[event];
    if (handlers) {
      handlers.forEach((handler) => handler(...args));
    }
  }
}

export const eventHub = new EventHub();