import { publish } from "../lib/nats";
import { prisma } from "../lib/prisma";

type UserSearchPayload = {
  id: string;
  username: string;
  fullname: string;
  avatar_url?: string;
  bio?: string;
  course?: string;
  major?: string;
  interests?: string[];
  followers: number;
  following: number;
};

class EventService {
  // ========== PROFILE (hệ thống cũ, vẫn giữ) ==========
  async publishProfileCreated(userId: string) {
    await publish("profile.created", { user_id: userId });
  }

  async publishProfileUpdated(user: {
    user_id: string;
    firstname: string;
    lastname: string;
    username: string;
  }) {
    await publish("profile.updated", {
      user_id: user.user_id,
      firstname: user.firstname,
      lastname: user.lastname,
      username: user.username,
    });
  }

  // ========== USER SEARCH (Elasticsearch) ==========

  // Upsert user vào Elasticsearch thông qua SearchService
  async publishUserSearchUpsert(payload: UserSearchPayload) {
    // SearchService subscribe "user.updated" và index/update users_index
    await publish("user.updated", payload);
  }

  // Xoá user khỏi Elasticsearch
  async publishUserSearchDeleted(userId: string) {
    await publish("user.deleted", { id: userId });
  }

  // Build payload từ DB rồi bắn "user.updated"
  async publishUserSearchUpdatedFromDb(userId: string) {
    const profile = await prisma.profile.findUnique({
      where: { user_id: userId },
      include: {
        interests: {
          include: { interest: true },
        },
      },
    });

    if (!profile) return;

    const [followers, following] = await Promise.all([
      prisma.follow.count({ where: { leader_id: userId } }),
      prisma.follow.count({ where: { follower_id: userId } }),
    ]);

    const interests =
      profile.interests?.map(
        (i: any) => i.interest?.name || i.interest || i.name
      ) || [];

    const payload: UserSearchPayload = {
      id: profile.user_id,
      username: profile.username,
      fullname: `${profile.firstName} ${profile.lastName}`.trim(),
      avatar_url: profile.avatar_url,
      bio: profile.bio,
      course: profile.course || "",
      major: profile.major || "",
      interests,
      followers,
      following,
    };

    await this.publishUserSearchUpsert(payload);
  }

  // Alias rõ nghĩa hơn cho xoá user
  async publishUserDeleted(userId: string) {
    await this.publishUserSearchDeleted(userId);
  }
}

export default new EventService();
