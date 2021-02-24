import express from "express"
import http from "http"
import bodyParser from "body-parser"
import { login, checkLogin, ioVerifyJWT_MW } from "./auth.js"
import { config } from "dotenv"
import { verifyJWT_MW } from "./jwt.js"
import mqtt from "mqtt"
import startSocket from "socket.io"
import wildcardMW from "socketio-wildcard"

config()

const app = express()
const port = 8080

const server = http.Server(app)
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

app.use("/video_stream/:source", (request, response) => {
  response.connection.setTimeout(0)
  const source = request.params.source
  console.log(`Video stream from "${source}" started`)

  // Stream of data is received, broadcast to socket listeners
  request.on("data", data => {
    io.of(`/video`).to(source).emit("video_data", data)
  })

  request.on("end", () => {
    console.log(`Video stream from "${source} ended`)
  })
})

io.of("/video")
  .use(ioVerifyJWT_MW)
  .on("connection", socket => {
    // Add video listeners to specific rooms for each video stream
    const room = socket.handshake.auth.room
    socket.join(room)

    // Tell the video streamer to start streaming!
    mqttClient.publish(room, "start")
  })

io.of("/robotpi")
  .use(ioVerifyJWT_MW)
  .use(wildcardMW())
  .on("connection", socket => {
    // Forward all socket messages to mqtt
    socket.on("*", ({ data }) => mqttClient.publish("robotpi", data[0]))
  })

server.listen(port, () => console.log(`Server listening on ${port}.`))
