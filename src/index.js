import express from 'express';
import http from 'http';
import httpProxy from 'http-proxy';
import bodyParser from 'body-parser';
import { login, checkLogin } from './auth.js'
import video from './video.js';
import { config } from 'dotenv';
import { verifyJWT_MW, checkAuthorized } from './jwt.js';

config();

const app = express();
const port = 8080;
const proxy = httpProxy.createProxyServer({
    target: 'http://localhost:4000',
    ws: true
});
const server = http.createServer(app);

app.use(bodyParser.text());

app.post('/login', login);
app.get('/login', verifyJWT_MW, checkLogin);
app.get('/video', verifyJWT_MW, video);

app.use('/socket.io', (req, res) => {
    console.log('Got socket request. Send to proxy.');
    proxy.web(req, res, {target: 'http://localhost:4000/socket.io'});
});

proxy.on('proxyReqWs', (proxyReqWs, req, res) => {

    console.log('Got socket request in proxy from ' + req.headers.host);
})

proxy.on('proxyReq', (proxyReq, req, res) => {
    console.log('Got request in proxy from ' + req.headers.host);
})

proxy.on('error', err => {
    console.log(`ERROR with socket: ${err.code}`);
})

server.on('upgrade', (req, socket, header) => {
    console.log('Proxying upgrade request');
    checkAuthorized(req).then(({authorized, code, status}) => {
        if (authorized) {
            proxy.ws(req, socket, header);
        } else {
            console.log('Socket upgrade request failed: ' + code + ": " + status);
            socket.end(code + ': ' + status);
        }
    })
});

server.listen(port, () => console.log(`Server listening on ${port}.`))