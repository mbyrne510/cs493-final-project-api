const express = require('express');
const axios = require('axios');
const jwt = require('express-jwt');
const jwksRsa = require('jwks-rsa');
const jwtDecode = require('jwt-decode');

const app = express();
var handlebars = require('express-handlebars').create({defaultLayout:'main'});

app.engine('handlebars', handlebars.engine);
app.set('view engine', 'handlebars');

const {Datastore} = require('@google-cloud/datastore');
const bodyParser = require('body-parser');

const datastore = new Datastore();

const USER = "User";
const BOAT = "Boat";
const LOAD = "Load";
const rootUrl = "https://cs493mbfinalproject.wl.r.appspot.com";
let token;

const router = express.Router();

app.use(bodyParser.json());

const checkJwt = jwt({
    secret: jwksRsa.expressJwtSecret({
        cache: true,
        rateLimit: true,
        jwksRequestsPerMinute: 100,
        jwksUri: 'https://www.googleapis.com/oauth2/v3/certs'
    }),
    issuer: 'https://accounts.google.com',
    algorithms: ['RS256']
});  

function fromDatastoreUser(item){
    item.id = item[Datastore.KEY].id;
    return item;
}

function fromDatastoreBoat(item){
    item.id = item[Datastore.KEY].id;
    item.self =  rootUrl + "/boats/" + item[Datastore.KEY].id;
    return item;
}

function fromDatastoreLoad(item){
    item.id = item[Datastore.KEY].id;
    item.self = rootUrl + "/loads/" + item[Datastore.KEY].id;
    return item;
}

/* ------------- Begin Model Functions ------------- */

function postUser(userId) {
    var key = datastore.key(USER);
	const newUser = {"userId": userId};
	return datastore.save({"key": key, "data": newUser}).then(() => {return key});
}

function getUsers() {
    const q = datastore.createQuery(USER);
    const results = {};

	return datastore.runQuery(q).then((entities) => {
        results.items = entities[0].map(fromDatastoreUser);
        return results;
	});
}

function postBoat(name, type, length, loads, owner) {
    var key = datastore.key(BOAT);
	const newBoat = {"name": name, "type": type, "length": length, "loads": loads, "owner": owner};
	return datastore.save({"key": key, "data": newBoat}).then(() => {return key});
}

function getBoat(id){
    const q = datastore
        .createQuery(BOAT)
        .filter("__key__", "=", datastore.key([BOAT, parseInt(id, 10)]));
	return datastore.runQuery(q).then( (entities) => {
		return entities[0].map(fromDatastoreBoat);
	});
}

function getBoats(req) {
    let q = datastore
        .createQuery(BOAT)
        .filter("owner", "=", req.user.sub)
        .limit(5)

    const results = {};

    if (Object.keys(req.query).includes("cursor")) {
        q = q.start(req.query.cursor);
    }

	return datastore.runQuery(q).then((entities) => {
        results.items = entities[0].map(fromDatastoreBoat);
        if (entities[1].moreResults !== Datastore.NO_MORE_RESULTS) {
            results.next = "https://" + req.get("host") + req.baseUrl + "?cursor=" + entities[1].endCursor;
        }
        return results;
	});
}

function getAllBoats() {
    const q = datastore.createQuery(BOAT);
    const results = {};

	return datastore.runQuery(q).then((entities) => {
        results.items = entities[0].map(fromDatastoreBoat);
        return results;
	});
}

function deleteBoat(id) {
    const key = datastore.key([BOAT, parseInt(id, 10)]);
    return datastore.delete(key);
}

function updateBoat(id, loads, name, type, length, owner) {
    const key = datastore.key([BOAT, parseInt(id, 10)]);
    const boatData = {"loads": loads, "name": name, "type": type, "length": length, "owner": owner};
    return datastore.save({"key": key, "data": boatData}).then(() => {return key});
}

function postLoad(weight, content, delivery_date) {
    var key = datastore.key(LOAD);
	const newLoad = {"weight": weight, "content": content, "delivery_date": delivery_date};
	return datastore.save({"key": key, "data": newLoad}).then(() => {return key});
}

function getLoad(id){
    const q = datastore
        .createQuery(LOAD)
        .filter("__key__", "=", datastore.key([LOAD, parseInt(id, 10)]));
	return datastore.runQuery(q).then((entities) => {
		return entities[0].map(fromDatastoreLoad);
	});
}

function getLoads(req){
    let q = datastore.createQuery(LOAD).limit(5);
    const results = {};

    if (Object.keys(req.query).includes("cursor")) {
        q = q.start(req.query.cursor);
    }

	return datastore.runQuery(q).then((entities) => {
        results.items = entities[0].map(fromDatastoreLoad);
        if (entities[1].moreResults !== Datastore.NO_MORE_RESULTS) {
            results.next = "https://" + req.get("host") + '/loads' + "?cursor=" + entities[1].endCursor;
        }
        return results;
	});
}

function getAllLoads(){
    const q = datastore.createQuery(LOAD);
    const results = {};

	return datastore.runQuery(q).then((entities) => {
        results.items = entities[0].map(fromDatastoreLoad);
        return results;
	});
}

function deleteLoad(id) {
    const key = datastore.key([LOAD, parseInt(id, 10)]);
    return datastore.delete(key);
}

function takeLoadsOff(loads) {
    let loadDataForUpdate = [];
    loads.forEach((load) => {
        const key = datastore.key([LOAD, parseInt(load.id, 10)]);
        loadData = {"key": key, "data": {"content": load.content, "delivery_date": load.delivery_date, "weight": load.weight, "carrier": null}};
        loadDataForUpdate.push(loadData);
    });
    return datastore.save(loadDataForUpdate);
}

function updateLoad(id, carrier, weight, content, delivery_date) {
    const key = datastore.key([LOAD, parseInt(id, 10)]);
    const loadData = {"carrier": carrier, "weight": weight, "content": content, "delivery_date": delivery_date};
    return datastore.save({"key": key, "data": loadData}).then(() => {return key});
}

function putLoadsOn(loads, boat) {
    let loadDataForUpdate = [];
    loads.forEach((load) => {
        let carrier = {};
        carrier["id"] = boat.id;
        carrier["name"] = boat.name;
        carrier["self"] = boat.self;
        const key = datastore.key([LOAD, parseInt(load.id, 10)]);
        loadData = {"key": key, "data": {"content": load.content, "delivery_date": load.delivery_date, "weight": load.weight, "carrier": carrier}};
        loadDataForUpdate.push(loadData);
    });
    return datastore.save(loadDataForUpdate);
}

/* ------------- End Model Functions ------------- */

/* ------------- Begin Controller Functions ------------- */

app.get('/', function(req, res) {
    // code for random string generation sourced from:
    // https://stackoverflow.com/questions/105034/how-to-create-guid-uuid (joelpt)
    const randState = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    const url = `https://accounts.google.com/o/oauth2/v2/auth?response_type=code&client_id=137918004527-51veh6rjv3k0024j21s2scb58rve4373.apps.googleusercontent.com&redirect_uri=https://cs493mbfinalproject.wl.r.appspot.com/oauth&scope=profile&state=${randState}`
    let context = {urlState: url};

    res.render('home', context);
});
    
app.get('/oauth', function(req, res) {
    axios.post('https://oauth2.googleapis.com/token', {
        code: req.query.code,
        client_id: '137918004527-51veh6rjv3k0024j21s2scb58rve4373.apps.googleusercontent.com',
        client_secret: 'f-EN8aeP7MuSSgdKOuu7WlQP',
        redirect_uri: 'https://cs493mbfinalproject.wl.r.appspot.com/oauth',
        grant_type: 'authorization_code',
    })
    .then((response) => {
// syntax for decoding JWT and extracting sub value sourced from:
// https://stackoverflow.com/questions/23097928/node-js-throws-btoa-is-not-defined-error (mscdex)
        token = response.data.id_token;
        let base64Url = token.split('.')[1];
        let decoded = Buffer.from(base64Url, 'base64').toString();
        let parsed = JSON.parse(decoded);
        let subVal = parsed["sub"];
        let context = {jwtToken: token, jwtSub: subVal};
        postUser(subVal).then(res.render('userInfo', context));
    })
    .catch((error) => {
        console.log(error);
    });
});      

app.get('/users', function(req, res) {
    getUsers().then((users) => {
        const accepts = req.accepts(['application/json']);
        if (!accepts) {
            res.status(406).json({"Error": "Application/JSON data not specified as acceptable in header"});
        } else if (accepts === 'application/json') {
            res.status(200).json(users);
        }
    })
});

app.post('/users', function(req, res) {
    res.set('Accept', 'GET');
    res.status(405).end();
});

app.put('/users', function(req, res) {
    res.set('Accept', 'GET');
    res.status(405).end();
});

app.patch('/users', function(req, res) {
    res.set('Accept', 'GET');
    res.status(405).end();
});

app.delete('/users', function(req, res) {
    res.set('Accept', 'GET');
    res.status(405).end();
});

router.get('/', checkJwt, function(req, res) {
    let totalRecords;
    const accepts = req.accepts(['application/json']);
    if (!accepts) {
        res.status(406).json({"Error": "Application/JSON data not specified as acceptable in header"});
    } else if (accepts === "application/json") {
        getAllBoats().then((boats) => {
            console.log(boats);
            totalRecords = boats.items.length;
            getBoats(req).then((boats) => {
                boats.totalRecords = totalRecords;
                res.status(200).json(boats);
            });    
        })
    }
});

router.get('/:boat_id', checkJwt, function(req, res) {
    const accepts = req.accepts(['application/json']);
    if (!accepts) {
        res.status(406).json({"Error": "Application/JSON data not specified as acceptable in header"});
    } else if (accepts === "application/json") {
        getBoat(req.params.boat_id).then((boat) => {
            if (boat[0].owner === req.user.sub) {
                res.status(200).json(boat[0]);
            } else {
                res.status(403).json({"Error": "Access to the specified boat from this account is forbidden."});
            }
        });
    }
});

router.post('/', checkJwt, function(req, res) {
    const accepts = req.accepts(['application/json']);
    if (!accepts) {
        res.status(406).json({"Error": "Application/JSON data not specified as acceptable in header"});
    } else if (accepts === "application/json") {
        let postedBoat = {
            name: req.body.name,
            type: req.body.type,
            length: req.body.length,
            loads: req.body.loads,
            owner: req.user.sub
        };
        postBoat(req.body.name, req.body.type, req.body.length, req.body.loads, req.user.sub)
            .then(key => {
                postedBoat.id = key.id;
                postedBoat.self = rootUrl + '/boats/' + key.id;
                res.status(201).json(postedBoat);
            });    
    }
});

router.put('/:boat_id', checkJwt, function(req, res) {
    const accepts = req.accepts(['application/json']);
    if (!accepts) {
        res.status(406).json({"Error": "Application/JSON data not specified as acceptable in header"});
    } else if (accepts === "application/json") {
        getBoat(req.params.boat_id).then((boat) => {
            if (boat[0].owner === req.user.sub) {
                let updatedBoat = {
                    name: req.body.name,
                    type: req.body.type,
                    length: req.body.length,
                    loads: boat[0].loads,
                    owner: boat[0].owner
                };
                updateBoat(req.params.boat_id, boat[0].loads, req.body.name, req.body.type, req.body.length, boat[0].owner)
                    .then(key => {
                        updatedBoat.id = key.id;
                        updatedBoat.self = rootUrl + "/boats/" + key.id;
                        res.status(200).json(updatedBoat);
                    });    
            } else {
                res.status(403).json({"Error": "Access to the specified boat from this account is forbidden."});
            }
        });    
    }
});

router.patch('/:boat_id', checkJwt, function(req, res) {
    const accepts = req.accepts(['application/json']);
    if (!accepts) {
        res.status(406).json({"Error": "Application/JSON data not specified as acceptable in header"});
    } else if (accepts === "application/json") {
        getBoat(req.params.boat_id).then((boat) => {
            if (boat[0].owner === req.user.sub) {
                let boatToUpdate = {};
                if (req.body.name) {
                    boatToUpdate.name = req.body.name;
                } else {
                    boatToUpdate.name = boat[0].name;
                }
                if (req.body.type) {
                    boatToUpdate.type = req.body.type;
                } else {
                    boatToUpdate.type = boat[0].type;
                }
                if (req.body.length) {
                    boatToUpdate.length = req.body.length;
                } else {
                    boatToUpdate.length = boat[0].length;
                }
                boatToUpdate.loads = boat[0].loads;
                boatToUpdate.owner = boat[0].owner;
                updateBoat(req.params.boat_id, boat[0].loads, boatToUpdate.name, boatToUpdate.type, req.body.length, boat[0].owner)
                    .then( key => {
                        boatToUpdate.id = key.id;
                        boatToUpdate.self = rootUrl + "/boats/" + key.id;
                        res.status(200).json(boatToUpdate);
                    });    
            } else {
                res.status(403).json({"Error": "Access to the specified boat from this account is forbidden."});
            }
        });
    }
});

router.delete('/:boat_id', checkJwt, function(req, res) {
    getBoat(req.params.boat_id).then((boat) => {
        if (boat[0].owner === req.user.sub) {
            let loadsToUpdate = [];
            getAllLoads().then((loads) => {
                loads.items.forEach((load) => {
                    boat[0].loads.forEach((loadOnBoat) => {
                        if (load.id === loadOnBoat.id.toString()) {
                            loadsToUpdate.push(load);
                        }
                    });
                });
                deleteBoat(boat[0].id)
                .then(takeLoadsOff(loadsToUpdate))
                .then(res.status(204).end());
            })    
        } else {
            res.status(403).json({"Error": "Access to the specified boat from this account is forbidden."});
        }
    });
});

router.put('/:boat_id/loads/:load_id', checkJwt, function(req, res) {
    getLoad(req.params.load_id).then((load) => {
        getBoat(req.params.boat_id).then((boat) => {
            console.log(boat[0].owner);
            console.log(req.user.sub);
            if (boat[0].owner === req.user.sub) {
                if (!load[0].carrier) {
                    let loadForBoat = {};
                    loadForBoat["id"] = load[0].id;
                    loadForBoat["self"] = load[0].self;
                    boat[0].loads.push(loadForBoat);
                    putLoadsOn(load, boat[0])
                    .then(updateBoat(boat[0].id, boat[0].loads, boat[0].name, boat[0].type, boat[0].length, boat[0].owner))
                    .then(res.status(204).end());        
                }
                else {
                    res.status(403).json({"Error": "The load is already associated to a boat"});
                }    
            } else {
                res.status(403).json({"Error": "Access to the specified boat from this account is forbidden"});
            }
        })
    });
});

router.delete('/:boat_id/loads/:load_id', checkJwt, function(req, res) {
    getLoad(req.params.load_id).then((load) => {
        getBoat(req.params.boat_id).then((boat) => {
            if (boat[0].owner === req.user.sub) {
                boat[0].loads.forEach((loadOnBoat, index) => {
                    if (loadOnBoat.id.toString() === load[0].id) {
                        boat[0].loads.splice(index, 1);
                        boatToUpdate = boat[0];
                    }
                })
                takeLoadsOff(load)
                .then(updateBoat(boatToUpdate.id, boatToUpdate.loads, boatToUpdate.name, boatToUpdate.type, boatToUpdate.length, boat[0].owner))
                .then(res.status(204).end());        
            } else {
                res.status(403).json({"Error": "Access to the specified boat from this account is forbidden."});
            }
        });
    });
});

app.post('/loads', function(req, res) {
    const accepts = req.accepts(['application/json']);
    if (!accepts) {
        res.status(406).json({"Error": "Application/JSON data not specified as acceptable in header"});
    } else if (accepts === "application/json") {
        let postedLoad = {
            weight: req.body.weight,
            content: req.body.content,
            delivery_date: req.body.delivery_date
        };
        postLoad(req.body.weight, req.body.content, req.body.delivery_date)
            .then(key => {
                postedLoad.id = key.id;
                postedLoad.self = rootUrl + "/loads/" + key.id;
                res.status(201).json(postedLoad);
            });
    }
});

app.get('/loads/:load_id', function(req, res) {
    const accepts = req.accepts(['application/json']);
    if (!accepts) {
        res.status(406).json({"Error": "Application/JSON data not specified as acceptable in header"});
    } else if (accepts === "application/json") {
        getLoad(req.params.load_id).then((load) => {
            if (load.length > 0) {
                if (!load[0].carrier) {
                    load[0].carrier = null;
                    res.status(200).json(load[0]);
                }
                else {
                    res.status(200).json(load[0]);
                }
            }
            else {
                res.status(404).json({"Error": "No load with this load_id exists"});
            }
        });
    }
});

app.get('/loads', function(req, res) {
    let totalRecords;
    const accepts = req.accepts(['application/json']);
    if (!accepts) {
        res.status(406).json({"Error": "Application/JSON data not specified as acceptable in header"});
    } else if (accepts === "application/json") {
        getAllLoads().then((loads) => {
            totalRecords = loads.items.length;
            getLoads(req).then((loads) => {
                loads["items"].forEach((load) => {
                    if (!load.carrier) {
                        load.carrier = null;
                    }
                });
                loads.totalRecords = totalRecords;
                res.status(200).json(loads);
            });    
        });
    }
});

app.put('/loads/:load_id', function(req, res) {
    const accepts = req.accepts(['application/json']);
    if (!accepts) {
        res.status(406).json({"Error": "Application/JSON data not specified as acceptable in header"});
    } else if (accepts === "application/json") {
        getLoad(req.params.load_id).then((load) => {
            let updatedLoad = {
                weight: req.body.weight,
                content: req.body.content,
                delivery_date: req.body.delivery_date
            };
            updatedLoad.carrier = load[0].carrier;
            updateLoad(req.params.load_id, load[0].carrier, req.body.weight, req.body.content, req.body.delivery_date)
                .then(key => {
                    updatedLoad.id = key.id;
                    updatedLoad.self = rootUrl + "/loads/" + key.id;
                    res.status(200).json(updatedLoad);
                });
        });
    }
});

app.patch('/loads/:load_id', function(req, res) {
    const accepts = req.accepts(['application/json']);
    if (!accepts) {
        res.status(406).json({"Error": "Application/JSON data not specified as acceptable in header"});
    } else if (accepts === "application/json") {
        getLoad(req.params.load_id).then((load) => {
            let loadToUpdate = {};
            if (req.body.weight) {
                loadToUpdate.weight = req.body.weight;
            } else {
                loadToUpdate.weight = load[0].weight;
            }
            if (req.body.content) {
                loadToUpdate.content = req.body.content;
            } else {
                loadToUpdate.content = load[0].content;
            }
            if (req.body.delivery_date) {
                loadToUpdate.delivery_date = req.body.delivery_date;
            } else {
                loadToUpdate.delivery_date = load[0].delivery_date;
            }
            loadToUpdate.carrier = load[0].carrier;
            updateLoad(req.params.load_id, load[0].carrier, loadToUpdate.weight, loadToUpdate.content, req.body.delivery_date)
                .then(key => {
                    loadToUpdate.id = key.id;
                    loadToUpdate.self = rootUrl + "/loads/" + key.id;
                    res.status(200).json(loadToUpdate);
                });
        });
    }
});

app.delete('/loads/:load_id', function(req, res) {
    let boatToUpdate;
    getLoad(req.params.load_id).then((load) => {
        if (load.length > 0) {
            getAllBoats()
            .then((boats) => {
                boats.items.forEach(boat => {
                    boat.loads.forEach(load => {
                        if (load != null && load.id.toString() === req.params.load_id) {
                            boat.loads.forEach((loadOnBoat, index) => {
                                if (loadOnBoat.id.toString() === load.id.toString()) {
                                    boat.loads.splice(index, 1);
                                }
                            })
                            boatToUpdate = boat;
                        }
                    });
                });
                updateBoat(boatToUpdate.id, boatToUpdate.loads, boatToUpdate.name, boatToUpdate.type, boatToUpdate.length, boatToUpdate.owner)
                .then(deleteLoad(req.params.load_id))
                .then(res.status(204).end());
            })
        }
        else {
            res.status(404).json({"Error": "No load with this load_id exists"});
        }    
    });
});

/* ------------- End Controller Functions ------------- */

app.use('/boats', router);

// Listen to the App Engine-specified port, or 8080 otherwise
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}...`);
});