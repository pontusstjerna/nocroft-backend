import express from 'express';
import auth from './auth.js'

const app = express();
const port = 8080;

app.get('/login', auth);

app.listen(port, () => console.log(`Server listening on ${port}.`))