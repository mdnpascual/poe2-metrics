import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
	plugins: [react()],
	server: {
		port: 5173,
		host: "127.0.0.1",
		allowedHosts: ["localhost", ".ngrok-free.app", ".localto.net"],
		proxy: {
			"/graphql": {
				target: "http://localhost:4000",
				changeOrigin: true,
				rewrite: (path) => "/",
				configure: (proxy) => {
					proxy.on("proxyReq", (proxyReq, req) => {
						if (req.headers["accept-encoding"]) {
							proxyReq.setHeader("accept-encoding", req.headers["accept-encoding"]);
						}
					});
				},
			},
			"/api/trade2": {
				target: "https://www.pathofexile.com",
				changeOrigin: true,
			},
		},
	},
});
