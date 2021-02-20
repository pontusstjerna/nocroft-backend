import express from "express"
import http from "http"

const app = express()
const server = http.Server(app)

server.listen(8080, () => {
  // Receive local video stream
  app.use("/stream", (request, response) => {
    response.connection.setTimeout(0)
    console.log("Local video stream connected.")

    // Local stream of data is received, broadcast to all listeners
    request.on("data", data => {
      console.log("data")

      // Don't know that this does
      if (request.socket.recording) {
        request.socket.recording.write(data)
      }
    })

    request.on("end", () => {
      console.log("Local video stream closed")

      if (request.socket.recording) {
        request.socket.recording.close()
      }
    })
  })
  console.log("Internal server listening to " + 8080)
})
