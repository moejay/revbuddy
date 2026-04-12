import { EventEmitter } from "node:events";
import type { PREvent, WSEvent, WSEventType } from "./types.js";

export class EventBus extends EventEmitter {
  override emit(event: string | symbol, ...args: any[]): boolean {
    return super.emit(event, ...args);
  }

  emitWSEvent(type: WSEventType, data: unknown): void {
    this.emit(type, data);
  }
}

export const eventBus = new EventBus();
