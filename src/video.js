import WebSocket from "ws"

export default (req, res) => {
  res.sendStatus(200)
}

export const startVideoStreamingServer = port => {
  const ws = new WebSocket.Server({
    perMessageDeflate: false,
    port,
  })

  ws.on("connection", socket => {
    console.log("Video listener connected")
  })
}
