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
                let params = { candidateId: null, noPublicAccess: null };

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
                    .project({ more: 0, phone: 0, file: 0, login: 0, userId: 0 })
                    .limit(10)
                    .toArray();
                    
                    res.status(200).send(vacancies);
            } else {
                const vacancies = await db.collection('vacancies').find({ candidateId: null, noPublicAccess: null })
                    .project({ more: 0, phone: 0, file: 0, login: 0, userId: 0 })
                    .limit(10)
                    .toArray();

                    res.status(200).send(vacancies);
            }
        } catch (err) {
            res.status(500).send(err);
        }
    });

    app.get('/details/:id', async (req, res) => {
        try {
            const vacancy = await db.collection('vacancies').findOne(
                {
                    _id: new ObjectId(req.params.id),
                },
                {
                    projection: { phone: 0, login: 0, userId: 0 },
                },
            );

            if (!vacancy) {
                return res.status(404).send("Not found");
            }

            return res.status(200).send(vacancy);
        } catch (err) {
            res.status(500).send(err);
        }
    })

    app.post('/register', async (req, res) => {
        const login = req.body.login;
        const password = req.body.password;
        
        if (!(login && password)) {
            return res.status(412).send({ message: "Login and password are necessary" });
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

            return res.status(200).send({ message: "User Registered successfully" });
        }

        return res.status(400).send({ message: "User Already Registered" })
    })

    app.post('/login', async (req, res) => {
        const login = req.body.login;
        const password = req.body.password;
        
        if (!(login && password)) {
            return res.status(412).send({ message: "Login and password are necessary" });
        }

        const users = db.collection('users');
        const user = await users.findOne({
            login: req.body.login,
        })

        if (!user) {
            return res.status(404).send({ message: "User Not Found" });
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

                const createRequest = await db.collection('create-request');

                await createRequest.deleteMany({
                    userId: new ObjectId(decode.id), 
                })

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

    app.post('/create-vacancy', upload.single('file'), async (req, res) => {
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
    
                const { description, city, more } = req.body;
    
                const createRequest = await db.collection('create-request');
    
                await createRequest.insertOne({
                    description,
                    city,
                    more,
                    file: req.file.filename,
                    company: user.company,
                    login: user.login,
                    phone: user.phone,
                    userId: user._id
                })
    
    
                return res.status(200).send();
            });
        } else {
            return res.status(403)
                .send({
                    message: "No JWT token"
            });
        }        
    })

    app.get('/get-confirm-create-vacancy-list', async (req, res) => {
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

                const createRequest = await db.collection('create-request');

                const list = await createRequest.find().toArray();

                return res.status(200).send(list);
            });
        } else {
            return res.status(403)
                .send({
                    message: "No JWT token"
            });
        }        
    })

    app.get('/accept-confirm-create-vacancy/:id', async (req, res) => {
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

                const createRequest = await db.collection('create-request');

                const {
                    description,
                    more,
                    city,
                    company,
                    file,
                    login,
                    phone,
                    userId,
                } = await createRequest.findOne({
                    _id: new ObjectId(req.params.id),
                })

                const vacancies = await db.collection('vacancies');

                const { insertedId } = await vacancies.insertOne({
                    description,
                    more,
                    city,
                    company,
                    file,
                    login,
                    phone,
                    userId,
                    status: 'создана',
                });

                await users.updateOne({
                    _id: userId,
                }, {
                    $push: { createdVacancies: { description, city, id: insertedId }  }
                })

                await createRequest.deleteOne({ _id: new ObjectId(req.params.id) });

                return res.status(200).send();
            });
        } else {
            return res.status(403)
                .send({
                    message: "No JWT token"
            });
        }        
    })

    app.get('/reject-confirm-create-vacancy/:id', async (req, res) => {
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

                const createRequest = await db.collection('create-request');

                await createRequest.deleteOne({ _id: new ObjectId(req.params.id) });

                return res.status(200).send();
            });
        } else {
            return res.status(403)
                .send({
                    message: "No JWT token"
            });
        }        
    })

    app.get('/assign-vacancy/:id', async (req, res) => {
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

                const vacancies = await db.collection('vacancies');

                const data = await vacancies.findOne({ _id: new ObjectId(req.params.id) });
                const { candidateId, description, city, company, userId, noPublicAccess } = data || {};

                if (!data || noPublicAccess || !!candidateId || userId.toString() === decode.id) {
                    return res.status(403).send({
                        message: "uninpossible assign to vacancy",
                    }); 
                }

                await vacancies.updateOne(
                    { _id: new ObjectId(req.params.id) },
                    {
                        $set: { candidateId: new ObjectId(decode.id), noPublicAccess: true, status: "ожидание заполнения данных соискателем" },
                    },
                );

                await users.updateOne(
                    { _id: new ObjectId(decode.id) },
                    { $push: { assignedVacancies: { description, city, company, id: new ObjectId(req.params.id) } } },
                )

                return res.status(200).send();
            });
        } else {
            return res.status(403)
                .send({
                    message: "No JWT token"
            });
        }        
    })

    app.get('/prefill-deal/:id', async (req, res) => {
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

                const vacancies = await db.collection('vacancies');
                const vacancy = await vacancies.findOne({ _id: new ObjectId(req.params.id) }, { projection: { description: 1, city: 1, company: 1, status: 1, userId: 1, candidateId: 1, clientInfo: 1, approveRegistration: 1 } });
  
                if (decode.id === vacancy?.userId?.toString() || decode.id === vacancy?.candidateId?.toString()) {
                    return res.status(200).send({ ...vacancy, userId: undefined, areYouCreater: vacancy?.userId?.toString() === decode.id });
                } else {
                    return res.status(403).send({
                        message: "доступ запрещен"
                    });
                }

            });
        } else {
            return res.status(403)
                .send({
                    message: "No JWT token"
            });
        }        
    })

    app.post('/send-data/:id', upload.single('file'), async (req, res) => {
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

                const { familyName, firstName, lastName, dateOfBorn, phone } = req.body;

                const vacancies = await db.collection('vacancies');
                const vacancy = await vacancies.findOne(
                    {
                        _id: new ObjectId(req.params.id),
                    },
                    {
                        projection: { candidateId: 1, status: 1 },
                    },
                );

                if (decode.id === vacancy?.candidateId?.toString() && vacancy?.status === "ожидание заполнения данных соискателем") {
                    await vacancies.updateOne(
                        { _id: new ObjectId(req.params.id) },
                        {
                            $set: { clientInfo: { familyName, firstName, lastName, dateOfBorn, phone, cv: req.file.filename, }, status: "внесение данных сотрудником в реферальную программу" },
                        },
                    )
                    
                    return res.status(200).send();
                } else {
                    return res.status(403).send({
                        message: "доступ запрещен"
                    });
                }

            });
        } else {
            return res.status(403)
                .send({
                    message: "No JWT token"
            });
        }        
    })

    app.post('/approve-registration/:id', upload.single('file'), async (req, res) => {
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

                const vacancies = await db.collection('vacancies');
                const vacancy = await vacancies.findOne(
                    {
                        _id: new ObjectId(req.params.id),
                    },
                    {
                        projection: { userId: 1, status: 1 },
                    },
                );

                if (decode.id === vacancy?.userId?.toString() && vacancy?.status === "внесение данных сотрудником в реферальную программу") {
                    await vacancies.updateOne(
                        { _id: new ObjectId(req.params.id) },
                        {
                            $set: { approveRegistration: req.file.filename, status: "ожидание результатов сделки" },
                        },
                    )
                    
                    return res.status(200).send();
                } else {
                    return res.status(403).send({
                        message: "доступ запрещен"
                    });
                }

            });
        } else {
            return res.status(403)
                .send({
                    message: "No JWT token"
            });
        }        
    })

    app.post('/complete-deal/:id', async (req, res) => {
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

                const vacancies = await db.collection('vacancies');
                const vacancy = await vacancies.findOne(
                    {
                        _id: new ObjectId(req.params.id),
                    },
                    {
                        projection: { candidateId: 1, status: 1 },
                    },
                );

                if (decode.id === vacancy?.candidateId?.toString() && vacancy?.status === "ожидание результатов сделки") {
                    await users.updateOne(
                        { _id: vacancy.candidateId },
                        {
                            $pull: { assignedVacancies: { id: new ObjectId(req.params.id) } },
                        },
                    );
                    await vacancies.updateOne(
                        { _id: new ObjectId(req.params.id) },
                        {
                            $set: { noPublicAccess: null, candidateId: null, clientInfo: null, approveRegistration: null, status: "создана" },
                        },
                    );
                    
                    return res.status(200).send();
                } else {
                    return res.status(403).send({
                        message: "доступ запрещен"
                    });
                }

            });
        } else {
            return res.status(403)
                .send({
                    message: "No JWT token"
            });
        }        
    })

    app.delete('/delete-vacancy/:id', async (req, res) => {
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

                const vacancies = await db.collection('vacancies');
                const vacancy = await vacancies.findOne(
                    {
                        _id: new ObjectId(req.params.id),
                    },
                    {
                        projection: { userId: 1, status: 1 },
                    },
                );

                if (decode.id === vacancy?.userId?.toString() && vacancy?.status === "создана") {
                    await users.updateOne(
                        { _id: vacancy.userId },
                        {
                            $pull: { createdVacancies: { id: new ObjectId(req.params.id) } },
                        },
                    );
                    await vacancies.deleteOne({ _id: new ObjectId(req.params.id) });
                    
                    return res.status(200).send();
                } else {
                    return res.status(403).send({
                        message: "доступ запрещен"
                    });
                }

            });
        } else {
            return res.status(403)
                .send({
                    message: "No JWT token"
            });
        }        
    })
};
