// lib/natsClient.ts
import { connect, JSONCodec, NatsConnection, StringCodec } from "nats";
import { env } from "../config/env";

let nc: NatsConnection | null = null;
const jc = JSONCodec();

export async function getNatsClient(): Promise<NatsConnection> {
  if (!nc) {
    nc = await connect({ servers: env.nats });
    console.log("🔗 Kết nối NATS thành công");
  }
  return nc;
}

export async function publish(subject: string, data: any) {
  const c = await getNatsClient();
  c.publish(subject, jc.encode(data));
}
