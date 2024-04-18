// server.js
const express        = require('express');
const MongoClient    = require('mongodb').MongoClient;
const bodyParser     = require('body-parser');
const db             = require('./config/db');
const app            = express();
const port = 8000;

app.use(bodyParser.urlencoded({ extended: true }));
app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', 'http://localhost:8080');

    next();
})
const client = new MongoClient(db.url);

MongoClient.connect(db.url, (err, database) => {
    if (err) return console.log(err)
    require('./app/routes')(app, database);
    app.listen(port, () => {
      console.log('We are live on ' + port);
    });               
  })

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