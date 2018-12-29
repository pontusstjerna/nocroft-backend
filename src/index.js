import express from 'express';
import bodyParser from 'body-parser';
import auth from './auth.js'
import { config } from 'dotenv';

config();

const app = express();
const port = 8080;

app.use(bodyParser.text());

app.post('/login', auth);

app.listen(port, () => console.log(`Server listening on ${port}.`))