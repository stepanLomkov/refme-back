const ObjectId = require('mongodb').ObjectId;
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const multer  = require('multer')

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
      cb(null, 'uploads/')
    },
    filename: function (req, file, cb) {
      const uniquePreffix = Date.now() + '-' + Math.round(Math.random() * 1E9)
      cb(null, uniquePreffix + file.originalname)
    }
  })
  
const upload = multer({ storage: storage })

module.exports = function(app, db) {
    app.get('/list', async (req, res) => {
        try {
            const { description, company, city } = req.query;
            
            if (!!description || !!company || !!city) {
                let params = {};

                if (!!description) {
                    params = {
                        ...params,
                        description: { $regex: description, $options: 'i' }
                    }
                }

                if (!!company) {
                    params = {
                        ...params,
                        company: { $regex: company, $options: 'i' }
                    }
                }

                if (!!city) {
                    params = {
                        ...params,
                        city: { $regex: city, $options: 'i' }
                    }
                }

                const vacancies = await db.collection('vacancies').find(params)
                    .project({ more: 0 })
                    .limit(10)
                    .toArray();
                    
                    res.send(vacancies).status(200);
            } else {
                const vacancies = await db.collection('vacancies').find()
                    .project({ more: 0 })
                    .limit(10)
                    .toArray();

                    res.send(vacancies).status(200);
            }
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
            }

            return res.send(vacancy).status(200);
        } catch (err) {
            res.send(err).status(500);
        }
    })

    app.post('/register', async (req, res) => {
        const login = req.body.login;
        const password = req.body.password;
        
        if (!(login && password)) {
            return res.send({ message: "Login and password are necessary" })
                .status(412);
        }

        const users = db.collection('users');
        const user = await users.findOne({
            login: req.body.login,
        })

        if (!user) {
            users.insertOne({
                login: req.body.login,
                password: bcrypt.hashSync(req.body.password, 8),
                hasCrateVacancy: false,
                isAdmin: false,
            })

            return res.send({ message: "User Registered successfully" }).status(200);
        }

        return res.status(400).send({ message: "User Already Registered" })
    })

    app.post('/login', async (req, res) => {
        const login = req.body.login;
        const password = req.body.password;
        
        if (!(login && password)) {
            return res.send({ message: "Login and password are necessary" })
                .status(412);
        }

        const users = db.collection('users');
        const user = await users.findOne({
            login: req.body.login,
        })

        if (!user) {
            return res.send({ message: "User Not Found" }).status(404);
        }

        const isPasswordValid = bcrypt.compareSync(
            password,
            user.password
        );

        if (!isPasswordValid) {
            return res.status(401)
                .send({
                    accessToken: null,
                    message: "Invalid Password!"
                });
        }

        const token = jwt.sign({
            id: user._id
        }, process.env.API_SECRET, {
            expiresIn: '24h'
        });

        res.status(200).send({
            user: {
                id: user._id,
                email: user.email,
                fullName: user.fullName,
            },
            message: "Login successfull",
            accessToken: token,
        });
    })

    app.get('/some-with-auth', async (req, res) => {
        if (req.headers && req.headers.authorization && req.headers.authorization.split(' ')[0] === 'Bearer') {
            jwt.verify(req.headers.authorization.split(' ')[1], process.env.API_SECRET, async function (err, decode) {

                const users = await db.collection('users');
                const user = await users.findOne({
                    _id: new ObjectId(decode.id),
                }, { projection: { password: 0 } })

                if (err || !user) {
                    return res.status(403)
                        .send({
                            message: "Invalid JWT token"
                    });
                }

                return res.status(200).send(user);
            });
        } else {
            return res.status(403)
                .send({
                    message: "No JWT token"
            });
        }        
    })

    app.get('/profile', async (req, res) => {
        if (req.headers && req.headers.authorization && req.headers.authorization.split(' ')[0] === 'Bearer') {
            jwt.verify(req.headers.authorization.split(' ')[1], process.env.API_SECRET, async function (err, decode) {

                const users = await db.collection('users');
                const user = await users.findOne({
                    _id: new ObjectId(decode.id),
                }, { projection: { password: 0 } })

                if (err || !user) {
                    return res.status(403)
                        .send({
                            message: "Invalid JWT token"
                    });
                }

                return res.status(200).send(user);
            });
        } else {
            return res.status(403)
                .send({
                    message: "No JWT token"
            });
        }        
    })

    app.post('/confirm-employment', upload.single('file'), async (req, res) => {
        if (req.headers && req.headers.authorization && req.headers.authorization.split(' ')[0] === 'Bearer') {
            jwt.verify(req.headers.authorization.split(' ')[1], process.env.API_SECRET, async function (err, decode) {

                const users = await db.collection('users');
                const user = await users.findOne({
                    _id: new ObjectId(decode.id),
                }, { projection: { password: 0 } })

                if (err || !user) {
                    return res.status(403)
                        .send({
                            message: "Invalid JWT token"
                    });
                }

                const { company, phone } = req.body;

                const confirmEmploymentList = await db.collection('confirm-employment');

                const hasConfirmingUser = await confirmEmploymentList.findOne({
                    userId: user._id,
                });
                
                if (hasConfirmingUser) {
                    return res.status(400).send({
                        message: "user already confirming",
                    })
                } else {
                    confirmEmploymentList.insertOne( { company, phone, file: req.file.filename, userId: user._id, } );
                }
        
                users.updateOne(
                    { _id:  user._id },
                    {
                        $set: { activeConfirm: true },
                    },
                );

                return res.status(200).send();
            });
        } else {
            return res.status(403)
                .send({
                    message: "No JWT token"
            });
        }        
    })

    app.delete('/delete-confirm-employment',  async (req, res) => {
        if (req.headers && req.headers.authorization && req.headers.authorization.split(' ')[0] === 'Bearer') {
            jwt.verify(req.headers.authorization.split(' ')[1], process.env.API_SECRET, async function (err, decode) {

                const users = await db.collection('users');
                const user = await users.findOne({
                    _id: new ObjectId(decode.id),
                }, { projection: { password: 0 } })

                if (err || !user) {
                    return res.status(403)
                        .send({
                            message: "Invalid JWT token"
                        });
                }

                if (!user.activeConfirm && !user.hasCrateVacancy) {
                    return res.status(400).send({
                        message: "user no have confirm",
                    });
                }

                const confirmEmploymentList = await db.collection('confirm-employment');

                await confirmEmploymentList.deleteOne({ userId: user._id });
                await users.updateOne(
                    { _id:  user._id },
                    {
                        $set: { activeConfirm: false, hasCrateVacancy: false, company: undefined, phone: undefined, confirmFile: undefined },
                    },
                );

                return res.status(200).send();
            });
        } else {
            return res.status(403)
                .send({
                    message: "No JWT token"
            });
        }   
    })

    app.get('/get-confirm-employment-list', async (req, res) => {
        if (req.headers && req.headers.authorization && req.headers.authorization.split(' ')[0] === 'Bearer') {
            jwt.verify(req.headers.authorization.split(' ')[1], process.env.API_SECRET, async function (err, decode) {

                const users = await db.collection('users');
                const user = await users.findOne({
                    _id: new ObjectId(decode.id),
                    isAdmin: true,
                }, { projection: { password: 0 } })

                if (err || !user) {
                    return res.status(403)
                        .send({
                            message: "Invalid JWT token"
                    });
                }

                const confirmEmploymentList = await db.collection('confirm-employment');

                const list = await confirmEmploymentList.aggregate([
                    {
                        $lookup: {
                            from: "users",
                            localField: "userId",
                            foreignField: "_id",
                            as: "user_info"
                        }
                    },
                    {
                        $addFields: {
                            "userLogin": { $arrayElemAt: ["$user_info.login", 0] }
                        }
                    }
                ]).toArray();

                return res.status(200).send(list);
            });
        } else {
            return res.status(403)
                .send({
                    message: "No JWT token"
            });
        }        
    })

    app.get('/download/:path', (req, res) => {
        const file = `uploads/${req.params.path}`;

        res.download(file);
    });

    app.get('/accept-confirm-employment/:userId', async (req, res) => {
        if (req.headers && req.headers.authorization && req.headers.authorization.split(' ')[0] === 'Bearer') {
            jwt.verify(req.headers.authorization.split(' ')[1], process.env.API_SECRET, async function (err, decode) {

                const users = await db.collection('users');
                const adminUser = await users.findOne({
                    _id: new ObjectId(decode.id),
                    isAdmin: true,
                }, { projection: { password: 0 } })

                if (err || !adminUser) {
                    return res.status(403)
                        .send({
                            message: "Invalid JWT token"
                    });
                }

                const user = await users.findOne({
                    _id: new ObjectId(req.params.userId),
                }, { projection: { password: 0 } })

                if (user.hasCrateVacancy || !user.activeConfirm) {
                    return res.status(403).send({
                        message: 'пользователь не может быть подтвержден'
                    })
                }

                const confirmEmploymentList = await db.collection('confirm-employment');

                const confirmingUser = await confirmEmploymentList.findOne({
                    userId: new ObjectId(req.params.userId),
                });

                await users.updateOne(
                    { _id: new ObjectId(req.params.userId) },
                    {
                        $set: { activeConfirm: false, hasCrateVacancy: true, company: confirmingUser.company, phone: confirmingUser.phone, confirmFile: confirmingUser.file },
                    },
                );

                await confirmEmploymentList.deleteOne({ userId: new ObjectId(req.params.userId) });

                return res.status(200).send();
            });
        } else {
            return res.status(403)
                .send({
                    message: "No JWT token"
            });
        }        
    })

    app.get('/reject-confirm-employment/:userId', async (req, res) => {
        if (req.headers && req.headers.authorization && req.headers.authorization.split(' ')[0] === 'Bearer') {
            jwt.verify(req.headers.authorization.split(' ')[1], process.env.API_SECRET, async function (err, decode) {

                const users = await db.collection('users');
                const adminUser = await users.findOne({
                    _id: new ObjectId(decode.id),
                    isAdmin: true,
                }, { projection: { password: 0 } })

                if (err || !adminUser) {
                    return res.status(403)
                        .send({
                            message: "Invalid JWT token"
                    });
                }

                const user = await users.findOne({
                    _id: new ObjectId(req.params.userId),
                }, { projection: { password: 0 } })

                if (user.hasCrateVacancy || !user.activeConfirm) {
                    return res.status(403).send({
                        message: 'пользователь не может быть отклонен'
                    })
                }

                await users.updateOne(
                    { _id: new ObjectId(req.params.userId) },
                    {
                        $set: { activeConfirm: false, hasCrateVacancy: false },
                    },
                );

                const confirmEmploymentList = await db.collection('confirm-employment');

                await confirmEmploymentList.deleteOne({ userId: new ObjectId(req.params.userId) });

                return res.status(200).send();
            });
        } else {
            return res.status(403)
                .send({
                    message: "No JWT token"
            });
        }        
    })
};
