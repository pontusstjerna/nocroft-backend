import express from "express"
import http from "http"
import bodyParser from "body-parser"
import { login, checkLogin, getAccessToken, ioVerifyJWT_MW } from "./auth.js"
import video from "./video.js"
import { config } from "dotenv"
import { verifyJWT_MW } from "./jwt.js"
import mqtt from "mqtt"
import startSocket from "socket.io"

config()

const app = express()
const port = 8080

const server = http.createServer(app)
const io = startSocket(server)

const mqttClient = mqtt.connect({
  hostname: process.env.MQTT_BROKER_URL || "mqtt://127.0.0.1",
  username: process.env.MQTT_USERNAME,
  password: process.env.MQTT_PASSWORD,
  protocol: "mqtt",
})

mqttClient.on("connect", () => {
  console.log("mqtt client connected successfully")
  // TODO: Possibly allow for client to specify which robot to control
  mqttClient.subscribe(["robotpi/started", "robotpi/status"], error => {
    if (error) {
      console.log(error)
    } else {
      console.log("Subscribed to topics with mqtt")
    }
  })

  mqttClient.on("message", (topic, message) => {
    console.log({ topic, message: message.toString() })

    switch (topic) {
      case "robotpi/started":
        io.emit("started", message.toString())
        break
      case "robotpi/status":
        io.emit("status", message.toString())
        break
    }
  })
})

mqttClient.on("error", error => console.log(error))

app.use(bodyParser.text())

app.post("/login", login)
app.get("/access-token", verifyJWT_MW, getAccessToken)
app.get("/login", verifyJWT_MW, checkLogin)
process.env.VIDEO_ENDPOINTS.split(";").forEach(endpoint =>
  app.get(endpoint, verifyJWT_MW, video)
)

io.use(ioVerifyJWT_MW).on("connection", socket => {
  socket.on("started", () => mqttClient.publish("robotpi", "started"))
  socket.on("status", () => mqttClient.publish("robotpi", "status"))
})

// SOCKET.IO
/*app.use("/socket.io", (req, res) => {
  checkSocketAuthorized(req).then(({ authorized, code, status }) => {
    if (authorized) {
      // TODO: Maybe use unique IDs for different robots in the future?
      client.publish("robotpi", )
    } else {
      console.log("Socket request failed: " + code + ": " + status)
      res.status(code).send(status)
    }
  })
})*/

// VIDEO
/*
server.on("upgrade", (req, socket, header) => {
  const videoEndpoints = process.env.VIDEO_ENDPOINTS.split(";")
  if (videoEndpoints.some((e) => req.url.startsWith(e))) {
    const queryParameters = url.parse(req.url, true).query
    verifyJWT(queryParameters.access_token)
      .then(() => {
        let endpoint
        let proxyTarget

        for (let i = 0; i < videoEndpoints.length; i++) {
          if (req.url.startsWith(videoEndpoints[i])) {
            endpoint = videoEndpoints[i]
            proxyTarget = process.env.PROXY_VIDEO_TARGETS.split(";")[i]
          }
        }

        console.log(
          `Video endpoint "${endpoint}" was authorized, proxying to ${proxyTarget}`
        )
        proxy.ws(req, socket, header, { target: proxyTarget })
      })
      .catch((e) => {
        console.log(e.message)
        console.log("Unauthorized video socket listener!")
        socket.destroy()
      })
  } else {
    proxy.ws(req, socket, header)
  }
})
*/

server.listen(port, () => console.log(`Server listening on ${port}.`))
