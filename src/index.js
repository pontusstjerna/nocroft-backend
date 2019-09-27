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

const proxy = httpProxy.createProxyServer({
    target: process.env.PROXY_TARGET,
    ws: true
});
const server = http.createServer(app);

app.use(bodyParser.text());

app.post('/login', login);
app.get('/access-token', verifyJWT_MW, getAccessToken);
app.get('/login', verifyJWT_MW, checkLogin);
process.env.VIDEO_ENDPOINTS.split(';').forEach(endpoint => app.get(endpoint, verifyJWT_MW, video));

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
    const videoEndpoints = process.env.VIDEO_ENDPOINTS.split(';');
    if (videoEndpoints.some(e => req.url.startsWith(e))) {
        const queryParameters = url.parse(req.url, true).query;
        verifyJWT(queryParameters.access_token)
            .then(() => {
                let endpoint;
                let proxyTarget;

                for (let i = 0; i < videoEndpoints.length; i++) {
                    if (req.url.startsWith(videoEndpoints[i])) {
                        endpoint = videoEndpoints[i];
                        proxyTarget = process.env.PROXY_VIDEO_TARGETS.split(';')[i];
                    }
                }

                console.log(`Video endpoint "${endpoint}" was authorized, proxying to ${proxyTarget}`);
                proxy.ws(req, socket, header, {target: proxyTarget})
            })
            .catch(e =>{
                console.log(e.message);
                console.log('Unauthorized video socket listener!');
                socket.destroy();
            });
    } else {
        proxy.ws(req, socket, header);
    }
});

server.listen(port, () => console.log(`Server listening on ${port}.`))