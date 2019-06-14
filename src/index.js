import express from 'express';
import http from 'http';
import httpProxy from 'http-proxy';
import bodyParser from 'body-parser';
import { login, checkLogin } from './auth.js'
import video from './video.js';
import { config } from 'dotenv';
import { verifyJWT_MW, checkSocketAuthorized } from './jwt.js';

config();

const app = express();
const port = 8080;
const proxy = httpProxy.createProxyServer({
    target: process.env.PROXY_TARGET,
    ws: true
});
const server = http.createServer(app);

app.use(bodyParser.text());

app.post('/login', login);
app.get('/login', verifyJWT_MW, checkLogin);
app.get('/video', verifyJWT_MW, video);

app.use('/socket.io', (req, res) => {
    console.log('Got socket request. Send to proxy.');
    checkSocketAuthorized(req).then(({authorized, code, status}) => {
        if (authorized) {
            console.log('Socket authorized.');
            proxy.web(req, res, {target: process.env.PROXY_TARGET + '/socket.io'});
        } else {
            console.log('Socket request failed: ' + code + ": " + status);
            res.status(code).send(status);
        }
    })
});

app.use('/video', (req, res) => {
    console.log('Got video socket request. Send to proxy.');
    proxy.ws(req, res, {target: process.env.PROXY_VIDEO_TARGET});
})

proxy.on('proxyReqWs', (proxyReqWs, req, res) => {
    console.log('Got socket request in proxy from ' + req.headers.origin);
})

proxy.on('proxyReq', (proxyReq, req, res) => {
    console.log('Got request in proxy from ' + req.headers.origin);
})

proxy.on('error', err => {
    console.log(`ERROR with socket: ${err.code}`);
})

server.on('upgrade', (req, socket, header) => {
    proxy.ws(req, socket, header);
});

server.listen(port, () => console.log(`Server listening on ${port}.`))