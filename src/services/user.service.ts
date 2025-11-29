import { DEFAULT_AVATAR } from "../global/settingApp";
import { prisma } from "../lib/prisma";
import { redis } from "../lib/redis";
import { GetFriendSuggestionsResult } from "../types/follow.type";
import { CheckUser, CreateUserType } from "../types/user.type";
import AppError from "../utils/error/AppError";

class UserService {
  async findAllUsers(options: {
    search?: string;
    page?: number;
    limit?: number;

    gender?: "Nam" | "Nữ" | "Khác";
    major?: string;
    course?: string;

    minAge?: number;
    maxAge?: number;
  }) {
    const {
      search,
      page = 1,
      limit = 20,
      gender,
      major,
      course,
      minAge,
      maxAge,
    } = options;

    const skip = (page - 1) * limit;

    // ==========================
    //  BUILD QUERY FILTER
    // ==========================
    const filters: any = {};

    if (search) {
      filters.OR = [
        { email: { contains: search, mode: "insensitive" } },
        { username: { contains: search, mode: "insensitive" } },
        { firstName: { contains: search, mode: "insensitive" } },
        { lastName: { contains: search, mode: "insensitive" } },
        { mssv: { contains: search } },
      ];
    }

    if (gender) filters.gender = gender;

    if (major) {
      filters.major = { contains: major, mode: "insensitive" };
    }

    if (course) {
      filters.course = { contains: course, mode: "insensitive" };
    }

    // ==========================
    //  AGE FILTER
    // ==========================
    if (minAge || maxAge) {
      const now = new Date();

      const minDob = maxAge
        ? new Date(now.getFullYear() - maxAge, 11, 31)
        : null;
      const maxDob = minAge ? new Date(now.getFullYear() - minAge, 0, 1) : null;

      filters.dob = {};

      if (minDob) filters.dob.lte = minDob;
      if (maxDob) filters.dob.gte = maxDob;
    }

    // ==========================
    //  GET TOTAL
    // ==========================
    const total = await prisma.profile.count({
      where: filters,
    });

    // ==========================
    //  MAIN QUERY
    // ==========================
    const users = await prisma.profile.findMany({
      where: filters,
      include: {
        interests: {
          select: { interest: { select: { name: true } } },
        },
      },
      skip,
      take: limit,
      orderBy: { created_at: "desc" },
    });

    return {
      data: users.map((u) => ({
        ...u,
        favorites: u.interests.map((i) => i.interest.name),
      })),
      pagination: {
        total,
        totalPages: Math.ceil(total / limit),
        currentPage: page,
        limit,
      },
    };
  }

  async findByUsername(username: string) {
    const user = await prisma.profile.findUnique({
      where: { username },
      include: {
        interests: { select: { interest: { select: { name: true } } } },
      },
    });

    if (!user) throw new AppError("Không tìm thấy người dùng", 404);
    return {
      ...user,
      interests: user.interests.map((i) => i.interest.name),
    };
  }

  async findByUserId(user_id: string) {
    const user = await prisma.profile.findUnique({
      where: { user_id },
      include: {
        interests: { select: { interest: { select: { name: true } } } },
      },
    });

    if (!user) throw new AppError("Không tìm thấy người dùng", 404);
    return {
      ...user,
      interests: user.interests.map((i) => i.interest.name),
    };
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
      avatar_url,
      phone,
      address,
      favorites,
      course,
      major,
      mssv,
    } = parseResult;

    const fullUsername = `@${username}`.trim().toLowerCase();
    const lockKey = `username_lock:${fullUsername}`;

    const existedUser = await this.findByUserId(user_id).catch(() => null);
    if (existedUser) throw new AppError("Hồ sơ này đã được tạo", 400);

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
          course: course || "",
          major: major || "",
          mssv,
          avatar_url: avatar_url || DEFAULT_AVATAR,
          bio: bio || `Xin chào tui là ${firstName} ${lastName}`,
          interests: {
            create:
              favorites?.map((name) => ({
                interest: {
                  connectOrCreate: {
                    where: { name },
                    create: { name },
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
      if (error.code === "P2002")
        throw new AppError("Username đã tồn tại", 400);
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
      avatar_url,
      phone,
      address,
      favorites,
      course,
      major,
      mssv,
    } = parseResult;

    const fullUsername = `@${username}`.trim().toLowerCase();
    const lockKey = `username_lock:${fullUsername}`;
    const currentUser = await this.findByUserId(user_id);
    const oldUsername = currentUser.username;

    if (oldUsername === fullUsername) {
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
          course,
          major,
          mssv,
          avatar_url: avatar_url || DEFAULT_AVATAR,
          bio: bio || `Xin chào tui là ${firstName} ${lastName}`,
          interests: {
            deleteMany: {},
            create:
              favorites?.map((name) => ({
                interest: {
                  connectOrCreate: {
                    where: { name },
                    create: { name },
                  },
                },
              })) || [],
          },
        },
        include: { interests: true },
      });
    }

    const locked = await redis.setnx(lockKey, "locked");
    if (!locked)
      throw new AppError(
        "Username đang được sử dụng, vui lòng thử tên khác",
        400
      );

    await redis.expire(lockKey, 60);

    try {
      const usernameUsed = await redis.sismember("usernames", fullUsername);
      if (usernameUsed) {
        const existing = await prisma.profile.findUnique({
          where: { username: fullUsername },
        });
        if (existing && existing.user_id !== user_id)
          throw new AppError("Username đã tồn tại", 400);
      }

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
          course,
          major,
          mssv,
          avatar_url: avatar_url || DEFAULT_AVATAR,
          bio: bio || `Xin chào tui là ${firstName} ${lastName}`,
          interests: {
            deleteMany: {},
            create:
              favorites?.map((name) => ({
                interest: {
                  connectOrCreate: {
                    where: { name },
                    create: { name },
                  },
                },
              })) || [],
          },
        },
        include: { interests: true },
      });

      await redis.srem("usernames", oldUsername);
      await redis.sadd("usernames", fullUsername);
      return user;
    } catch (error: any) {
      if (error.code === "P2002")
        throw new AppError("Username đã tồn tại", 400);
      throw new AppError("Lỗi khi cập nhật người dùng", 500);
    } finally {
      await redis.del(lockKey);
    }
  }

  async searchUsername(
    currentUserId: string,
    keyword: string,
    page: number,
    limit: number
  ) {
    const skip = (page - 1) * limit;
    const followedUsers = await prisma.profile.findMany({
      select: { user_id: true, username: true, avatar_url: true },
      where: {
        username: { startsWith: keyword, mode: "insensitive" },
        followers: { some: { follower_id: currentUserId } },
        user_id: { not: currentUserId },
      },
      skip,
      take: limit,
    });

    const remaining = limit - followedUsers.length;
    let otherUsers: {
      user_id: string;
      username: string;
      avatar_url: string | null;
    }[] = [];

    if (remaining > 0) {
      otherUsers = await prisma.profile.findMany({
        select: { user_id: true, username: true, avatar_url: true },
        where: {
          username: { startsWith: keyword, mode: "insensitive" },
          followers: { none: { follower_id: currentUserId } },
          user_id: {
            notIn: followedUsers.map((u) => u.user_id),
            not: currentUserId,
          },
        },
        skip,
        take: remaining,
      });
    }

    return [
      ...followedUsers.map((u) => ({ ...u, isFollowed: true })),
      ...otherUsers.map((u) => ({ ...u, isFollowed: false })),
    ];
  }

  async checkFriendship(userId1: string, userId2: string) {
    const [isUser1FollowingUser2, isUser2FollowingUser1] = await Promise.all([
      prisma.follow.findFirst({
        where: { follower_id: userId1, leader_id: userId2 },
      }),
      prisma.follow.findFirst({
        where: { follower_id: userId2, leader_id: userId1 },
      }),
    ]);
    return isUser1FollowingUser2 && isUser2FollowingUser1;
  }

  async getFriendIds(userId: string): Promise<string[]> {
    const friends = await prisma.follow.findMany({
      where: {
        follower_id: userId,
        leader: { followers: { some: { follower_id: userId } } },
      },
      select: { leader_id: true },
    });
    return friends.map((f) => f.leader_id);
  }

  async addOrUnFriend(leader_id: string, follower_id: string) {
    try {
      if (leader_id === follower_id)
        throw new AppError("Không thể theo dõi chính mình", 400);

      const existed = await prisma.follow.findFirst({
        where: { leader_id, follower_id },
      });

      if (existed) {
        await prisma.follow.delete({
          where: { leader_id_follower_id: { follower_id, leader_id } },
        });
        return "Huỷ theo dõi thành công";
      } else {
        await prisma.follow.create({ data: { leader_id, follower_id } });
        return "Theo dõi thành công";
      }
    } catch (error) {
      if (error instanceof AppError) throw error;
      if (typeof error === "object" && error !== null && "code" in error) {
        const prismaError = error as any;
        if (prismaError.code === "P2003")
          throw new AppError("Người dùng không tồn tại", 404);
        if (prismaError.code === "P2025")
          throw new AppError("Không tìm thấy dữ liệu để huỷ theo dõi", 404);
      }
      throw new AppError("Đã xảy ra lỗi không xác định", 500);
    }
  }

  async getFriendSuggestions(
    userId: string,
    limit = 10,
    offset = 0
  ): Promise<GetFriendSuggestionsResult> {
    // 1️⃣ Những user mình ĐANG follow (following)
    const followingRaw = await prisma.follow.findMany({
      where: { follower_id: userId },
      select: {
        leader_id: true,
        leader: {
          select: {
            user_id: true,
            username: true,
            firstName: true,
            lastName: true,
            avatar_url: true,
            bio: true,
            course: true,
            major: true,
            mssv: true,
          },
        },
      },
    });

    const followingMap = new Map(
      followingRaw.map((f) => [f.leader_id, f.leader])
    );
    const followingIds = Array.from(followingMap.keys());

    // 2️⃣ Những user ĐANG follow mình (followers)
    const followersRaw = await prisma.follow.findMany({
      where: { leader_id: userId },
      select: {
        follower_id: true,
        follower: {
          select: {
            user_id: true,
            username: true,
            firstName: true,
            lastName: true,
            avatar_url: true,
            bio: true,
            course: true,
            major: true,
            mssv: true,
          },
        },
      },
    });

    const followersMap = new Map(
      followersRaw.map((f) => [f.follower_id, f.follower])
    );
    const followerIds = Array.from(followersMap.keys());

    // 3️⃣ ID bạn chung (follow 2 chiều)
    const mutualIds = followingIds.filter((id) => followersMap.has(id));

    const mutualFriends = mutualIds.map((id) => followingMap.get(id)!);

    // 4️⃣ Followers chỉ 1 chiều: họ follow bạn, bạn chưa follow
    const followersOnlyIds = followerIds.filter((id) => !followingMap.has(id));
    const followersOnly = followersOnlyIds.map((id) => followersMap.get(id)!);

    // 5️⃣ Following chỉ 1 chiều: bạn follow họ, họ chưa follow bạn
    const followingOnlyIds = followingIds.filter((id) => !followersMap.has(id));
    const followingOnly = followingOnlyIds.map((id) => followingMap.get(id)!);

    // 6️⃣ Gợi ý: những user không thuộc 3 nhóm trên (chưa follow nhau)
    const excludeIds = [
      userId,
      ...mutualIds,
      ...followersOnlyIds,
      ...followingOnlyIds,
    ];

    const suggestions = await prisma.profile.findMany({
      where: {
        user_id: {
          notIn: excludeIds,
        },
      },
      select: {
        user_id: true,
        username: true,
        firstName: true,
        lastName: true,
        avatar_url: true,
        bio: true,
        course: true,
        major: true,
        mssv: true,
      },
      skip: offset,
      take: limit,
    });

    return {
      mutualFriends, // bạn chung: follow 2 chiều
      followers: followersOnly, // họ follow bạn, bạn chưa follow
      following: followingOnly, // bạn follow họ, họ chưa follow
      suggestions, // 2 bên đều chưa follow nhau
    };
  }

  // ===========================
  // COUNT USERS
  // ===========================
  async getCountUsers() {
    const count = await prisma.profile.count();
    return count;
  }

  // ===========================
  // WEEKLY USER ACTIVITY
  // ===========================
  async getWeeklyUserActivity() {
    const result = [];

    const days = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"];
    const today = new Date();
    const currentWeekDay = today.getDay(); // 0 = CN, 1 = T2

    for (let i = 1; i <= 7; i++) {
      const diff = i - currentWeekDay;
      const targetDate = new Date(today);
      targetDate.setDate(today.getDate() + diff);

      const start = new Date(targetDate);
      start.setHours(0, 0, 0, 0);

      const end = new Date(targetDate);
      end.setHours(23, 59, 59, 999);

      const usersCount = await prisma.profile.count({
        where: {
          created_at: {
            gte: start,
            lte: end,
          },
        },
      });

      result.push({
        day: days[i - 1],
        users: usersCount,
      });
    }

    return result;
  }

  // ===========================
  // RECENT USER ACTIVITIES
  // ===========================
  async getRecentUserActivities() {
    const recentUsers = await prisma.profile.findMany({
      orderBy: { created_at: "desc" },
      take: 10,
      select: {
        user_id: true,
        username: true,
        firstName: true,
        lastName: true,
        created_at: true,
      },
    });

    return recentUsers.map((u) => ({
      type: "user_registered",
      message: `${u.firstName} ${u.lastName} (@${u.username}) vừa tạo tài khoản`,
      userId: u.user_id,
      time: u.created_at,
    }));
  }
}

export default new UserService();
