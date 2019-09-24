import express from 'express';
import http from 'http';
import url from 'url';
import httpProxy from 'http-proxy';
import bodyParser from 'body-parser';
import { login, checkLogin, getAccessToken, checkSocketAuthorized } from './auth.js'
import video from './video.js';
import { config } from 'dotenv';
import { verifyJWT_MW, verifyJWT } from './jwt.js';

config();

const app = express();
const port = 8080;

// TODO: Create one proxy for each video streamer
const proxy = httpProxy.createProxyServer({
    target: process.env.PROXY_TARGET,
    ws: true
});
const server = http.createServer(app);

app.use(bodyParser.text());

app.post('/login', login);
app.get('/access-token', verifyJWT_MW, getAccessToken);
app.get('/login', verifyJWT_MW, checkLogin);
app.get('/video', verifyJWT_MW, video);

// SOCKET.IO
app.use('/socket.io', (req, res) => {
    checkSocketAuthorized(req).then(({authorized, code, status}) => {
        if (authorized) {
            console.log('Socket authorized');
            proxy.web(req, res, {target: process.env.PROXY_TARGET + '/socket.io'});
        } else {
            console.log('Socket request failed: ' + code + ": " + status);
            res.status(code).send(status);
        }
    })
});

proxy.on('proxyReqWs', (proxyReqWs, req, res) => {
    //console.log('Got socket request in proxy from ' + req.headers.host);
})

proxy.on('proxyReq', (proxyReq, req, res) => {
    //console.log('Got request in proxy from ' + req.headers.host);
})

proxy.on('error', err => {
    //console.log(`ERROR with socket: ${err.code}`);
})

// VIDEO
server.on('upgrade', (req, socket, header) => {
    if (req.url.startsWith('/video')) {
        const queryParameters = url.parse(req.url, true).query;
        verifyJWT(queryParameters.access_token)
            .then(() => {
                console.log('Video socket authenticated.');
                proxy.ws(req, socket, header, {target: process.env.PROXY_VIDEO_TARGET})
            })
            .catch(() =>{
                console.log('Unauthorized video socket listener!!!');
                socket.destroy();
            });
    } else {
        proxy.ws(req, socket, header);
    }
});

server.listen(port, () => console.log(`Server listening on ${port}.`))