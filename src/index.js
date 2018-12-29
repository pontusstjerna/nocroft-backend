import express from 'express';
import bodyParser from 'body-parser';
import auth from './auth.js'
import video from './video.js';
import { config } from 'dotenv';
import { verifyJWT_MW } from './jwt.js'; 

config();

const app = express();
const port = 8080;

app.use(bodyParser.text());

app.post('/login', auth);
app.get('/video', verifyJWT_MW, video);

app.listen(port, () => console.log(`Server listening on ${port}.`))