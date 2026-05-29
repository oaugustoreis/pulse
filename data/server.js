const jsonServer = require("json-server");
const server = jsonServer.create();
const router = jsonServer.router("data/db.json");
const middlewares = jsonServer.defaults();

server.use(middlewares);
server.use(jsonServer.bodyParser);

server.post("/authentication", (req, res) => {
    console.log("--- Mock Auth Request Received ---");
    res.json({
        accessToken: "mock-access-token-12345",
        expiresIn: 3600,
    });
});

server.use(router);

server.listen(3333, () => {
    console.log(" JSON Server is running on http://localhost:3333");
});
