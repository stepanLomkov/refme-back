// server.js
const express        = require('express');
const MongoClient    = require('mongodb').MongoClient;
const bodyParser     = require('body-parser');
const db             = require('./config/db');
const app            = express();
const port = 8000;

app.use(bodyParser.urlencoded({ extended: true }));

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
        // const vacancies = await client.db().collection('vacancies').find().toArray();
        // console.log({ vacancies })
    } catch {
        console.log('fail connecting')
    }
}

start();