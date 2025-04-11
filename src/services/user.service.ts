import { DEFAULT_AVATAR } from "../global/settingApp";
import { prisma } from "../lib/prisma";
import { redis } from "../lib/redis";
import { createUserSchema, CreateUserType } from "../types/user.type";
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
    // 1. Validate input
    const parseResult = createUserSchema.safeParse(input);
    if (!parseResult.success) {
      const errors = parseResult.error.errors.map((e) => ({
        field: e.path.join("."),
        message: e.message,
      }));
      throw new AppError("Dữ liệu không hợp lệ", 400, errors);
    }

    const { user_id, username, fullname, bio, avatar_url, email } =
      parseResult.data;
    const fullUsername = `@${username}`.trim().toLowerCase();

    // 2. Kiểm tra user_id đã có chưa
    const existedUser = await this.findByUserId(user_id).catch(() => null);
    if (existedUser) {
      throw new AppError("Tài khoản này đã được tạo", 400);
    }

    // 3. Dùng SETNX để lock username tránh race condition
    const lockKey = `username_lock:${fullUsername}`;
    const locked = await redis.setnx(lockKey, "locked");

    if (!locked) {
      throw new AppError(
        "Username đang được sử dụng, vui lòng thử tên khác",
        400
      );
    }

    // Đặt thời gian sống cho lock (đề phòng treo)
    await redis.expire(lockKey, 60); // 60s

    try {
      // 4. Kiểm tra username đã tồn tại chưa (double check)
      const usernameUsed = await redis.sismember("usernames", fullUsername);
      if (usernameUsed) {
        throw new AppError("Username đã tồn tại", 400);
      }

      // 5. Tạo user
      const user = await prisma.profile.create({
        data: {
          email,
          user_id,
          username: fullUsername,
          fullname,
          avatar_url: avatar_url || DEFAULT_AVATAR,
          bio: bio || `Xin chào tui là ${fullname}`,
        },
      });

      // 6. Lưu vào Redis
      await redis.sadd("usernames", fullUsername);

      return user;
    } catch (error: any) {
      // Nếu lỗi, kiểm tra lỗi trùng trong Prisma
      if (error.code === "P2002") {
        throw new AppError("Username đã tồn tại", 400);
      }

      throw new AppError("Lỗi khi tạo người dùng", 500);
    } finally {
      // 7. Luôn xóa lock để tránh bị giữ mãi
      await redis.del(lockKey);
    }
  }

  async update(input: CreateUserType) {
    const parseResult = createUserSchema.safeParse(input);
    if (!parseResult.success) {
      const errors = parseResult.error.errors.map((e) => ({
        field: e.path.join("."),
        message: e.message,
      }));
      throw new AppError("Dữ liệu không hợp lệ", 400, errors);
    }

    const { user_id, username, fullname, bio, avatar_url } = parseResult.data;
    const fullUsername = `@${username}`.trim().toLowerCase();
    const lockKey = `username_lock:${fullUsername}`;

    // 1. Lấy user hiện tại
    const currentUser = await this.findByUserId(user_id);
    const oldUsername = currentUser.username;

    // 2. Nếu username không thay đổi thì không cần check
    if (oldUsername === fullUsername) {
      // Chỉ update các trường khác
      return await prisma.profile.update({
        where: { user_id },
        data: {
          fullname,
          avatar_url: avatar_url || DEFAULT_AVATAR,
          bio: bio || `Xin chào tui là ${fullname}`,
        },
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
          username: fullUsername,
          fullname,
          avatar_url: avatar_url || DEFAULT_AVATAR,
          bio: bio || `Xin chào tui là ${fullname}`,
        },
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

  async setUserOnline(userId: string) {
    const key = `online:${userId}`;

    await redis.setex(key, 60, 1);
  }

  async isUserOnline(userId: string) {
    const key = `online:${userId}`;

    const exists = await redis.exists(key);

    return exists == 1;
  }
}

export default new UserService();
