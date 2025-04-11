import { env } from "./config/env";
import server from "./app";

server.listen(env.port, () => {
  console.log(`Server is running at http://localhost:${env.port}`);
});
