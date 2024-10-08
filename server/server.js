const WebSocket = require("ws")
const http = require("http")
const wss = new WebSocket.Server({noServer: true})
const setupWSConnection = require("./utils.js").setupWSConnection
const serveHandler = require("serve-handler")

const host = process.env.HOST || "0.0.0.0"
const port = process.env.PORT || 5000

const server = http.createServer((request, response) =>
    serveHandler(request, response, {
        public: "public",
    }),
)

wss.on("connection", setupWSConnection)

server.on("upgrade", (request, socket, head) => {
    // You may check auth of request here..
    /**
     * @param {any} ws
     */
    const handleAuth = (ws) => {
        wss.emit("connection", ws, request)
    }
    wss.handleUpgrade(request, socket, head, handleAuth)
})

server.listen({host, port})

console.log(`running at '${host}' on port ${port}`)
