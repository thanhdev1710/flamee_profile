const PORT = process.env.PORT || 3000;

export const env = {
  port: Number(PORT),
  nodeEnv: process.env.NODE_ENV || "development",
};
