// lib/natsClient.ts
import { connect, NatsConnection, StringCodec } from "nats";

let nc: NatsConnection | null = null;

export async function getNatsClient(): Promise<NatsConnection> {
  if (!nc) {
    nc = await connect({ servers: "nats://localhost:4222" });
    console.log("🔗 Kết nối NATS thành công");
  }
  return nc;
}

export const sc = StringCodec();
