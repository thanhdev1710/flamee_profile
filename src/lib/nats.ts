// lib/natsClient.ts
import { connect, NatsConnection, StringCodec } from "nats";
import { env } from "../config/env";

let nc: NatsConnection | null = null;

export async function getNatsClient(): Promise<NatsConnection> {
  if (!nc) {
    nc = await connect({ servers: env.nats });
    console.log("🔗 Kết nối NATS thành công");
  }
  return nc;
}

export const sc = StringCodec();
