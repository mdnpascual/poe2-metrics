import { ApolloServer } from "@apollo/server";
import { expressMiddleware } from "@apollo/server/express4";
import express from "express";
import compression from "compression";
import cors from "cors";
import { typeDefs } from "./schema.js";
import { resolvers } from "./resolvers.js";
import { initDb } from "./db.js";

async function main() {
	const db = await initDb();

	const server = new ApolloServer({
		typeDefs,
		resolvers,
	});

	await server.start();

	const app = express();

	app.use(compression());
	app.use(cors());
	app.use(express.json({ limit: "10mb" }));

	app.use(
		expressMiddleware(server, {
			context: async () => ({ db }),
		}) as any,
	);

	const port = parseInt(process.env.PORT || "4000", 10);

	app.listen(port, () => {
		console.log(`🚀 GraphQL server ready at http://localhost:${port}/`);
	});
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});
