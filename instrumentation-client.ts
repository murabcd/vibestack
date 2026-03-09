import { initBotId } from "botid/client/core";
import { protectedBotIdRoutes } from "@/lib/botid/protected-routes";

initBotId({
	protect: protectedBotIdRoutes,
});
