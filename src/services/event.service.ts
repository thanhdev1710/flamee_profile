import { getNatsClient, sc } from "../lib/nats";

class EventService {
  async publishProfileCreated(userId: string) {
    const nc = await getNatsClient();
    const payload = JSON.stringify({ user_id: userId });
    nc.publish("profile.created", sc.encode(payload));
  }

  async publishProfileUpdated(user: {
    user_id: string;
    firstname: string;
    lastname: string;
    username: string;
  }) {
    const nc = await getNatsClient();
    const payload = JSON.stringify({
      user_id: user.user_id,
      firstname: user.firstname,
      lastname: user.lastname,
      username: user.username,
    });

    nc.publish("profile.updated", sc.encode(payload));
  }
}

export default new EventService();
