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
  firstName: z
    .string()
    .min(2, "Tên phải có ít nhất 2 ký tự")
    .max(50, "Tên tối đa 50 ký tự"),

  lastName: z
    .string()
    .min(2, "Họ phải có ít nhất 2 ký tự")
    .max(50, "Họ tối đa 50 ký tự"),
  phone: z
    .string()
    .regex(
      /^0\d{9}$/,
      "Số điện thoại không hợp lệ (phải có 10 chữ số và bắt đầu bằng số 0)"
    )
    .optional(),

  address: z
    .string()
    .min(5, "Địa chỉ quá ngắn")
    .max(200, "Địa chỉ quá dài")
    .optional(),

  dob: z.preprocess(
    (val) => {
      if (typeof val === "string" || val instanceof Date) {
        return new Date(val);
      }
    },
    z.date({
      required_error: "Ngày sinh là bắt buộc",
      invalid_type_error: "Ngày sinh không hợp lệ",
    })
  ),

  gender: z.enum(["Nam", "Nữ", "Khác"], {
    required_error: "Giới tính là bắt buộc",
  }),

  favorites: z
    .array(z.string())
    .max(5, "Bạn chỉ có thể chọn tối đa 5 sở thích"),

  avatar: z.string().url("Avatar phải là một URL hợp lệ").optional(),

  bio: z.string().max(500, "Giới thiệu bản thân tối đa 500 ký tự").optional(),
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
