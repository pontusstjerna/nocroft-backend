import express from "express"
import http from "http"
import bodyParser from "body-parser"
import { login, checkLogin, ioVerifyJWT_MW } from "./auth.js"
import { config } from "dotenv"
import { verifyJWT_MW } from "./jwt.js"
import mqtt from "mqtt"
import { Server } from "socket.io"
import wildcardMW from "socketio-wildcard"

config()

const VIDEO_OFFER_SECRET = process.env.VIDEO_OFFER_SECRET

const app = express()
const port = 8080

const server = http.Server(app)
const io = new Server(server)

const availableVideoSources = []
const receiveVideoOffers = []

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
    if (error) console.log(error)
  })

  mqttClient.on("message", (topic, message) => {
    switch (topic) {
      case "robotpi/started":
        io.of("/robotpi").emit("started", message.toString())
        break
      case "robotpi/status":
        io.of("/robotpi").emit("status", message.toString())
        break
    }
  })
})

mqttClient.on("error", error => console.log(error))

app.use(bodyParser.text())

app.post("/login", login)
app.get("/login", verifyJWT_MW, checkLogin)

app.get("/video_sources", verifyJWT_MW, (req, res) => res.send(availableVideoSources))

app.post("/video_offer/:source", (request, response) => {
  const source = request.params.source
  console.log(`Video stream from '${source}' offered.`)
  const offer = request.body.offer
  if (request.body.secret !== VIDEO_OFFER_SECRET) {
    response.sendStatus(401)
  }
  response.send(availableVideoSources)
  io.of("/video").to(source).emit("offer", offer)
})

app.post("/receiving_video_offer", verifyJWT_MW, (request) => {
  console.log("Receiving video offer")
  const offer = request.body
  receiveVideoOffers.push(offer)
  mqttClient.publish("video", "receive_offer_available")
})

io.of("/video")
  .use(ioVerifyJWT_MW)
  .on("connection", socket => {
    // Add video listeners to specific rooms for each video stream
    const room = socket.handshake.auth.room
    socket.join(room)
  })

io.of("/robotpi")
  .use(ioVerifyJWT_MW)
  .use(wildcardMW())
  .on("connection", socket => {
    // Forward all socket messages to mqtt
    socket.on("*", ({ data }) => mqttClient.publish("robotpi", data[0]))
  })

server.setTimeout(0)
server.listen(port, () => console.log(`Server listening on ${port}.`))
