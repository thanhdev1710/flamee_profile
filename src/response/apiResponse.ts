import { Response } from "express";

export function sendResponse<T>(
  res: Response,
  statusCode: number,
  message: string,
  data?: T
) {
  res.status(statusCode).json({
    status: statusCode < 400 ? "success" : "error",
    message,
    ...(data && { data }),
  });
}
