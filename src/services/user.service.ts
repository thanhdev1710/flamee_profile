import { DEFAULT_AVATAR } from "../global/settingApp";
import { getNatsClient, sc } from "../lib/nats";
import { prisma } from "../lib/prisma";
import { redis } from "../lib/redis";
import { FriendSuggestion } from "../types/follow.type";
import { CheckUser, CreateUserType } from "../types/user.type";
import AppError from "../utils/error/AppError";

class UserService {
  async findByUsername(username: string) {
    const user = await prisma.profile.findUnique({
      where: { username },
    });

    if (!user) {
      throw new AppError("Không tìm thấy người dùng", 404);
    }

    return user;
  }

  async findByUserId(user_id: string) {
    const user = await prisma.profile.findUnique({
      where: { user_id },
    });

    if (!user) {
      throw new AppError("Không tìm thấy người dùng", 404);
    }

    return user;
  }

  async create(input: CreateUserType) {
    const parseResult = CheckUser(input);
    const {
      user_id,
      username,
      email,
      firstName,
      lastName,
      gender,
      dob,
      bio,
      avatar: avatar_url,
      phone,
      address,
      favorites,
    } = parseResult;

    const fullUsername = `@${username}`.trim().toLowerCase();
    const lockKey = `username_lock:${fullUsername}`;

    const existedUser = await this.findByUserId(user_id).catch(() => null);
    if (existedUser) throw new AppError("Tài khoản này đã được tạo", 400);

    const locked = await redis.setnx(lockKey, "locked");
    if (!locked) throw new AppError("Username đang được sử dụng", 400);

    await redis.expire(lockKey, 60);

    try {
      const usernameUsed = await redis.sismember("usernames", fullUsername);
      if (usernameUsed) throw new AppError("Username đã tồn tại", 400);

      const user = await prisma.profile.create({
        data: {
          user_id,
          email,
          username: fullUsername,
          firstName,
          lastName,
          gender,
          dob,
          phone,
          address,
          avatar_url: avatar_url || DEFAULT_AVATAR,
          bio: bio || `Xin chào tui là ${firstName} ${lastName}`,
          interests: {
            create:
              favorites?.map((name) => ({
                interest: {
                  connectOrCreate: {
                    where: { name }, // Kiểm tra và kết nối hoặc tạo mới
                    create: { name }, // Tạo mới nếu chưa tồn tại
                  },
                },
              })) || [],
          },
        },
        include: { interests: true },
      });

      await redis.sadd("usernames", fullUsername);
      return user;
    } catch (error: any) {
      if (error.code === "P2002") {
        throw new AppError("Username đã tồn tại", 400);
      }
      throw new AppError("Lỗi khi tạo người dùng", 500);
    } finally {
      await redis.del(lockKey);
    }
  }

  async update(input: CreateUserType) {
    const parseResult = CheckUser(input);

    const {
      user_id,
      username,
      email,
      firstName,
      lastName,
      gender,
      dob,
      bio,
      avatar: avatar_url,
      phone,
      address,
      favorites,
    } = parseResult;

    const fullUsername = `@${username}`.trim().toLowerCase();
    const lockKey = `username_lock:${fullUsername}`;

    // 1. Lấy user hiện tại
    const currentUser = await this.findByUserId(user_id);
    const oldUsername = currentUser.username;

    // 2. Nếu username không thay đổi thì không cần check
    if (oldUsername === fullUsername) {
      // Chỉ update các trường khác, bao gồm sở thích
      return await prisma.profile.update({
        where: { user_id },
        data: {
          email,
          username: fullUsername,
          firstName,
          lastName,
          gender,
          dob,
          phone,
          address,
          avatar_url: avatar_url || DEFAULT_AVATAR,
          bio: bio || `Xin chào tui là ${firstName} ${lastName}`,
          interests: {
            deleteMany: {}, // Xóa tất cả sở thích cũ
            create:
              favorites?.map((name) => ({
                interest: {
                  connectOrCreate: {
                    where: { name }, // Kiểm tra và kết nối hoặc tạo mới
                    create: { name }, // Tạo mới nếu chưa tồn tại
                  },
                },
              })) || [],
          },
        },
        include: { interests: true },
      });
    }

    // 3. Lock tên mới để tránh race condition
    const locked = await redis.setnx(lockKey, "locked");
    if (!locked) {
      throw new AppError(
        "Username đang được sử dụng, vui lòng thử tên khác",
        400
      );
    }

    await redis.expire(lockKey, 60); // Timeout lock 60s

    try {
      // 4. Kiểm tra tên mới có bị dùng bởi user khác không
      const usernameUsed = await redis.sismember("usernames", fullUsername);
      if (usernameUsed) {
        const existing = await prisma.profile.findUnique({
          where: { username: fullUsername },
        });
        if (existing && existing.user_id !== user_id) {
          throw new AppError("Username đã tồn tại", 400);
        }
      }

      // 5. Update trong DB
      const user = await prisma.profile.update({
        where: { user_id },
        data: {
          email,
          username: fullUsername,
          firstName,
          lastName,
          gender,
          dob,
          phone,
          address,
          avatar_url: avatar_url || DEFAULT_AVATAR,
          bio: bio || `Xin chào tui là ${firstName} ${lastName}`,
          interests: {
            deleteMany: {}, // Xóa tất cả sở thích cũ
            create:
              favorites?.map((name) => ({
                interest: {
                  connectOrCreate: {
                    where: { name }, // Kiểm tra và kết nối hoặc tạo mới
                    create: { name }, // Tạo mới nếu chưa tồn tại
                  },
                },
              })) || [],
          },
        },
        include: { interests: true },
      });

      // 6. Cập nhật Redis SET nếu username đã đổi
      await redis.srem("usernames", oldUsername);
      await redis.sadd("usernames", fullUsername);

      return user;
    } catch (error: any) {
      if (error.code === "P2002") {
        throw new AppError("Username đã tồn tại", 400);
      }

      throw new AppError("Lỗi khi cập nhật người dùng", 500);
    } finally {
      await redis.del(lockKey);
    }
  }

  async searchUsername(currentUserId: string, keyword: string, limit = 10) {
    // Tìm kiếm người dùng đã follow
    const followedUsers = await prisma.profile.findMany({
      select: {
        user_id: true,
        username: true,
        avatar_url: true,
      },
      where: {
        username: {
          startsWith: keyword,
          mode: "insensitive",
        },
        followers: {
          some: {
            follower_id: currentUserId,
          },
        },
        user_id: {
          not: currentUserId,
        },
      },
      take: limit,
    });

    const remaining = limit - followedUsers.length;

    let otherUsers: {
      user_id: string;
      username: string;
      avatar_url: string | null;
    }[] = [];
    if (remaining > 0) {
      // Tìm kiếm người dùng chưa follow
      otherUsers = await prisma.profile.findMany({
        select: {
          user_id: true,
          username: true,
          avatar_url: true,
        },
        where: {
          username: {
            startsWith: keyword,
            mode: "insensitive",
          },
          followers: {
            none: {
              follower_id: currentUserId,
            },
          },
          user_id: {
            notIn: followedUsers.map((u) => u.user_id),
            not: currentUserId,
          },
        },
        take: remaining,
      });
    }

    // Trả về kết quả với thông tin isFollowed
    return [
      ...followedUsers.map((u) => ({ ...u, isFollowed: true })),
      ...otherUsers.map((u) => ({ ...u, isFollowed: false })),
    ];
  }

  async checkFriendship(userId1: string, userId2: string) {
    const [isUser1FollowingUser2, isUser2FollowingUser1] = await Promise.all([
      prisma.follow.findFirst({
        where: {
          follower_id: userId1,
          leader_id: userId2,
        },
      }),
      prisma.follow.findFirst({
        where: {
          follower_id: userId2,
          leader_id: userId1,
        },
      }),
    ]);

    // Nếu có ít nhất một trong hai điều kiện trên, thì hai người là bạn
    return isUser1FollowingUser2 && isUser2FollowingUser1;
  }

  async getFriendIds(userId: string): Promise<string[]> {
    const friends = await prisma.follow.findMany({
      where: {
        follower_id: userId,
        leader: {
          followers: {
            some: {
              follower_id: userId,
            },
          },
        },
      },
      select: {
        leader_id: true,
      },
    });

    return friends.map((f) => f.leader_id);
  }

  async addOrUnFriend(leader_id: string, follower_id: string) {
    try {
      if (leader_id === follower_id) {
        throw new AppError("Không thể theo dõi chính mình", 400);
      }

      const existed = await prisma.follow.findFirst({
        where: {
          leader_id,
          follower_id,
        },
      });

      if (existed) {
        await prisma.follow.delete({
          where: {
            leader_id_follower_id: {
              follower_id,
              leader_id,
            },
          },
        });

        return "Huỷ theo dõi thành công";
      } else {
        await prisma.follow.create({
          data: { leader_id, follower_id },
        });

        return "Theo dõi thành công";
      }
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }

      if (typeof error === "object" && error !== null && "code" in error) {
        const prismaError = error as any;

        if (prismaError.code === "P2003") {
          throw new AppError("Người dùng không tồn tại", 404);
        }

        if (prismaError.code === "P2025") {
          throw new AppError("Không tìm thấy dữ liệu để huỷ theo dõi", 404);
        }
      }

      throw new AppError("Đã xảy ra lỗi không xác định", 500);
    }
  }

  async getFriendSuggestions(userId: string, limit = 10, offset = 0) {
    const friends: FriendSuggestion[] = await prisma.$queryRaw`
      SELECT source_user, suggested_user, mutual_friend_count::int, mutual_friends
      FROM friend_suggestions_mv
      WHERE source_user = ${userId}  
    `;

    const { mutual_friend_count, mutual_friends, source_user, suggested_user } =
      friends[0];

    return {
      mutual_friend_count,
      source_user,
      suggested_user,
      mutual_friends: mutual_friends.slice(offset, offset + limit),
    };
  }

  async publishProfileCreated(userId: string) {
    const nc = await getNatsClient();

    const payload = JSON.stringify({ user_id: userId });

    nc.publish("profile.created", sc.encode(payload));
    console.log("✅ Đã gửi event profile.created cho user:", userId);
  }
}

export default new UserService();
