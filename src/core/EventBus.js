export class EventBus {
  constructor() { this.h = {}; }
  on(e, f) { (this.h[e] ||= []).push(f); return () => this.off(e, f); }
  off(e, f) { const a = this.h[e]; if (!a) return; const i = a.indexOf(f); if (i >= 0) a.splice(i, 1); }
  emit(e, ...args) { (this.h[e] || []).slice().forEach((f) => f(...args)); }
}
export const bus = new EventBus();
