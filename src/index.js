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

const VIDEO_ANSWER_SECRET = process.env.VIDEO_ANSWER_SECRET

const app = express()
const port = 8080

const server = http.Server(app)
const io = new Server(server)

// TODO: Cleanup after certain time period of silence?
const availableVideoSources = new Set()

// TODO: Cleanup for sources not available?
const receiveVideoOffers = {}

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
app.use(bodyParser.json())

app.post("/login", login)
app.get("/login", verifyJWT_MW, checkLogin)

app.get("/video_sources", verifyJWT_MW, (req, res) => res.send([...availableVideoSources]))

app.post("/register_video_source", (request, response) => {
  if (request.body.secret !== VIDEO_ANSWER_SECRET) {
    response.sendStatus(401)
  }

  availableVideoSources.add(request.body.source)
  response.sendStatus(204)
})

app.post("/video_answer/:source", (request, response) => {
  const source = request.params.source

  const answer = request.body.answer
  if (request.body.secret !== VIDEO_ANSWER_SECRET) {
    response.sendStatus(401)
  }
  const [first, ...rest] = receiveVideoOffers[source] || []
  console.log(`Video offer to stream '${source}' answered, emitting answer to ${source}: ${first.socketId}.`)
  io.of("/video").to(source).to(first.socketId).emit("answer", answer)
  receiveVideoOffers[source] = rest
  response.sendStatus(204)
})

app.post("/video_offer/:source", verifyJWT_MW, (request, response) => {
  console.log(`Receiving video offer to source ${request.params.source} from socket ID ${request.body.socketId}`)
  const offer = request.body.offer
  const source = request.params.source
  if (!receiveVideoOffers[source]) {
    receiveVideoOffers[source] = []
  }
  receiveVideoOffers[source].push(request.body)
  response.sendStatus(204)
  mqttClient.publish(`/video/client_offers/${request.params.source}`, JSON.stringify(offer))
})

io.of("/video")
  .use(ioVerifyJWT_MW)
  .on("connection", socket => {
    // Add video listeners to specific rooms for each video stream
    const room = socket.handshake.auth.room
    socket.join(room)
  })
  .on("disconnect", socket => {
    receiveVideoOffers[socket.id] = undefined
    console.log(`Removing video offer from socket ID ${socket.id}`)
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
