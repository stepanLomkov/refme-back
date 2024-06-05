// server.js
const express        = require('express');
const MongoClient    = require('mongodb').MongoClient;
const bodyParser     = require('body-parser');
const db             = require('./config/db');
const app            = express();
require("dotenv").config();
const port = 8000;

app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.json());

app.use((_, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', 'http://localhost:8080');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    next();
});

const client = new MongoClient(db.url);

const start = async () => {
    try {
        await client.connect()
        console.log('success connected')

        require('./app/routes')(app, client.db());
        app.listen(port, () => {
            console.log('We are live on ' + port);
        });
    } catch {
        console.log('fail connecting')
    }
}

start();