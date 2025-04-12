import { z } from "zod";
import AppError from "../utils/error/AppError";

export const createUserSchema = z.object({
  user_id: z.string().uuid(),
  email: z.string().email(),
  username: z
    .string()
    .min(3, "Username phải có ít nhất 3 ký tự")
    .max(50, "Username tối đa 50 ký tự")
    .regex(
      /^(?!.*[_.]{2})(?![_.])[a-zA-Z0-9._]+(?<![_.])$/,
      "Username chỉ được chứa chữ cái, số, dấu _ và ., không được bắt đầu/kết thúc bằng _ hoặc ., và không có dấu liên tiếp"
    ),
  fullname: z
    .string()
    .min(3, "Username phải có ít nhất 3 ký tự")
    .max(50, "Username tối đa 50 ký tự"),
  bio: z.string().optional(),
  avatar_url: z.string().url().optional(),
});

export type CreateUserType = z.infer<typeof createUserSchema>;

export function CheckUserId(user_id: string) {
  const idSchema = createUserSchema.pick({ user_id: true });

  const check = idSchema.safeParse({ user_id });

  if (!check.success) throw new Error("User id không hợp lệ");

  return check.data.user_id;
}

export function CheckUsername(username: string) {
  const usernameSchema = createUserSchema.pick({ username: true });

  const check = usernameSchema.safeParse({ username });

  if (!check.success) throw new Error("Username không đúng hợp lệ");

  return check.data.username;
}

export function CheckUser(user: CreateUserType) {
  const check = createUserSchema.safeParse(user);
  if (!check.success) {
    const errors = check.error.errors.map((e) => ({
      field: e.path.join("."),
      message: e.message,
    }));
    throw new AppError("Dữ liệu không hợp lệ", 400, errors);
  }

  return check.data;
}
