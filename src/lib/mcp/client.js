import { resolveServer } from './spawn.js';
import { connectStdio, connectHttp } from './connect.js';

const INITIAL = 'INITIAL';
const MANAGED = 'MANAGED';
const CONNECTED = 'CONNECTED';

export class McpClient {
  #state = INITIAL;
  #client = null;
  #bin;

  constructor(bin) {
    this.#bin = bin;
  }

  get state() { return this.#state; }

  async start() {
    if (this.#state !== INITIAL) throw new Error(`Cannot start(): current state is ${this.#state}`);
    const { command, args } = resolveServer(this.#bin);
    this.#client = await connectStdio(command, args);
    this.#state = MANAGED;
  }

  async stop() {
    if (this.#state !== MANAGED) throw new Error(`Cannot stop(): current state is ${this.#state}`);
    await this.#client.close();
    this.#client = null;
    this.#state = INITIAL;
  }

  async connect(url) {
    if (this.#state !== INITIAL) throw new Error(`Cannot connect(): current state is ${this.#state}`);
    this.#client = await connectHttp(url);
    this.#state = CONNECTED;
  }

  async disconnect() {
    if (this.#state !== CONNECTED) throw new Error(`Cannot disconnect(): current state is ${this.#state}`);
    await this.#client.close();
    this.#client = null;
    this.#state = INITIAL;
  }

  async toolCall(name, params = {}) {
    if (this.#state === INITIAL) {
      throw new Error(`toolCall() requires MANAGED or CONNECTED state; current state is INITIAL`);
    }
    if (params === null) {
      throw new TypeError(`toolCall params must be a plain JSON object; got null`);
    }
    if (Array.isArray(params)) {
      throw new TypeError(`toolCall params must be a plain JSON object; got array`);
    }
    if (typeof params !== 'object') {
      throw new TypeError(`toolCall params must be a plain JSON object; got ${typeof params}`);
    }
    if (name === 'tools/list') {
      return this.#client.listTools(params);
    }
    return this.#client.callTool({ name, arguments: params });
  }
}
