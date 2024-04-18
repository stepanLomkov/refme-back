const ObjectId = require('mongodb').ObjectId;

module.exports = function(app, db) {
    app.get('/list', async (_, res) => {
        try {
            const vacancies = await db.collection('vacancies').find()
            .project({ more: 0 })
            .limit(50)
            .toArray();
            res.send(vacancies).status(200);
        } catch (err) {
            res.send(err).status(500);
        }
    });

    app.get('/details/:id', async (req, res) => {
        try {
            const query = {_id: new ObjectId(req.params.id)};
            const vacancy = await db.collection('vacancies').findOne(query);

            if (!vacancy) {
                res.send("Not found").status(404);
            } else {
                res.send(vacancy).status(200);
            }
        } catch (err) {
            res.send(err).status(500);
        }
    })
};
