const request = require('request');
const express = require('express');
const app = express();

const {
  mongoose
} = require('./db/mongoose');

const bodyParser = require('body-parser');

// Load in the mongoose models
const {
  List,
  Task,
  User,
  IpAddress
} = require('./db/models');

const jwt = require('jsonwebtoken');


/* MIDDLEWARE  */

// Load middleware
app.use(bodyParser.json());


// CORS HEADERS MIDDLEWARE
app.use(function (req, res, next) {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "GET, POST, HEAD, OPTIONS, PUT, PATCH, DELETE");
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, x-access-token, x-refresh-token, _id");

  res.header(
    'Access-Control-Expose-Headers',
    'x-access-token, x-refresh-token'
  );

  next();
});


// check whether the request has a valid JWT access token
let authenticate = (req, res, next) => {
  let token = req.header('x-access-token');

  // verify the JWT
  jwt.verify(token, User.getJWTSecret(), (err, decoded) => {
    if (err) {
      // there was an error
      // jwt is invalid - * DO NOT AUTHENTICATE *
      res.status(401).send(err);
    } else {
      // jwt is valid
      req.user_id = decoded._id;
      next();
    }
  });
}

// Verify Refresh Token Middleware (which will be verifying the session)
let verifySession = (req, res, next) => {
  // grab the refresh token from the request header
  let refreshToken = req.header('x-refresh-token');

  // grab the _id from the request header
  let _id = req.header('_id');

  User.findByIdAndToken(_id, refreshToken).then((user) => {
    if (!user) {
      // user couldn't be found
      return Promise.reject({
        'error': 'User not found. Make sure that the refresh token and user id are correct'
      });
    }


    // if the code reaches here - the user was found
    // therefore the refresh token exists in the database - but we still have to check if it has expired or not

    req.user_id = user._id;
    req.userObject = user;
    req.refreshToken = refreshToken;

    let isSessionValid = false;

    user.sessions.forEach((session) => {
      if (session.token === refreshToken) {
        // check if the session has expired
        if (User.hasRefreshTokenExpired(session.expiresAt) === false) {
          // refresh token has not expired
          isSessionValid = true;
        }
      }
    });

    if (isSessionValid) {
      // the session is VALID - call next() to continue with processing this web request
      next();
    } else {
      // the session is not valid
      return Promise.reject({
        'error': 'Refresh token has expired or the session is invalid'
      })
    }

  }).catch((e) => {
    console.log('e from verifySession', e);
    res.status(401).send(e);
  })
}


let verifyIp = (req, res, next) => {
  let newIp = String(req.connection.remoteAddress);
  IpAddress.needsVerification(newIp).then(needsVerification => {
    req.needsVerification = needsVerification;
    // console.log('verify ip says, ', needsVerification);
    next();
  }).catch(err => {
    console.log('err', err);
    res.status(400).send(err);
  });

};

/* END MIDDLEWARE  */




/* ROUTE HANDLERS */

/* LIST ROUTES */

/**
 * GET /lists
 * Purpose: Get all lists
 */
app.get('/lists', authenticate, (req, res) => {
  // We want to return an array of all the lists that belong to the authenticated user 
  List.find({
    _userId: req.user_id
  }).then((lists) => {
    res.send(lists);
  }).catch((e) => {
    res.send(e);
  });
})

/**
 * POST /lists
 * Purpose: Create a list
 */
app.post('/lists', authenticate, (req, res) => {
  // We want to create a new list and return the new list document back to the user (which includes the id)
  // The list information (fields) will be passed in via the JSON request body
  let title = req.body.title;

  let newList = new List({
    title,
    _userId: req.user_id
  });

  newList.save().then((listDoc) => {
    // the full list document is returned (incl. id)
    res.send(listDoc);
  })
});

/**
 * PATCH /lists/:id
 * Purpose: Update a specified list
 */
app.patch('/lists/:id', authenticate, (req, res) => {
  // We want to update the specified list (list document with id in the URL) with the new values specified in the JSON body of the request
  List.findOneAndUpdate({
    _id: req.params.id,
    _userId: req.user_id
  }, {
    $set: req.body
  }).then(() => {
    res.send({
      'message': 'updated successfully'
    });
  });
});

/**
 * DELETE /lists/:id
 * Purpose: Delete a list
 */
app.delete('/lists/:id', authenticate, (req, res) => {
  // We want to delete the specified list (document with id in the URL)
  List.findOneAndRemove({
    _id: req.params.id,
    _userId: req.user_id
  }).then((removedListDoc) => {
    res.send(removedListDoc);

    // delete all the tasks that are in the deleted list
    deleteTasksFromList(removedListDoc._id);
  })
});


/**
 * GET /lists/:listId/tasks
 * Purpose: Get all tasks in a specific list
 */
app.get('/lists/:listId/tasks', authenticate, (req, res) => {
  // We want to return all tasks that belong to a specific list (specified by listId)
  Task.find({
    _listId: req.params.listId
  }).then((tasks) => {
    res.send(tasks);
  })
});


/**
 * POST /lists/:listId/tasks
 * Purpose: Create a new task in a specific list
 */
app.post('/lists/:listId/tasks', authenticate, (req, res) => {
  // We want to create a new task in a list specified by listId

  List.findOne({
    _id: req.params.listId,
    _userId: req.user_id
  }).then((list) => {
    if (list) {
      // list object with the specified conditions was found
      // therefore the currently authenticated user can create new tasks
      return true;
    }

    // else - the list object is undefined
    return false;
  }).then((canCreateTask) => {
    if (canCreateTask) {
      let newTask = new Task({
        title: req.body.title,
        _listId: req.params.listId
      });
      newTask.save().then((newTaskDoc) => {
        res.send(newTaskDoc);
      })
    } else {
      res.sendStatus(404);
    }
  })
})

/**
 * PATCH /lists/:listId/tasks/:taskId
 * Purpose: Update an existing task
 */
app.patch('/lists/:listId/tasks/:taskId', authenticate, (req, res) => {
  // We want to update an existing task (specified by taskId)

  List.findOne({
    _id: req.params.listId,
    _userId: req.user_id
  }).then((list) => {
    if (list) {
      // list object with the specified conditions was found
      // therefore the currently authenticated user can make updates to tasks within this list
      return true;
    }

    // else - the list object is undefined
    return false;
  }).then((canUpdateTasks) => {
    if (canUpdateTasks) {
      // the currently authenticated user can update tasks
      Task.findOneAndUpdate({
        _id: req.params.taskId,
        _listId: req.params.listId
      }, {
        $set: req.body
      }).then(() => {
        res.send({
          message: 'Updated successfully.'
        })
      })
    } else {
      res.sendStatus(404);
    }
  })
});

/**
 * DELETE /lists/:listId/tasks/:taskId
 * Purpose: Delete a task
 */
app.delete('/lists/:listId/tasks/:taskId', authenticate, (req, res) => {

  List.findOne({
    _id: req.params.listId,
    _userId: req.user_id
  }).then((list) => {
    if (list) {
      // list object with the specified conditions was found
      // therefore the currently authenticated user can make updates to tasks within this list
      return true;
    }

    // else - the list object is undefined
    return false;
  }).then((canDeleteTasks) => {

    if (canDeleteTasks) {
      Task.findOneAndRemove({
        _id: req.params.taskId,
        _listId: req.params.listId
      }).then((removedTaskDoc) => {
        res.send(removedTaskDoc);
      })
    } else {
      res.sendStatus(404);
    }
  });
});



/* USER ROUTES */

/**
 * POST /users
 * Purpose: Sign up
 */
app.post('/users', verifyIp, (req, res) => {

  let signup = () => {
    const body = req.body;
    const newUser = new User(body);

    // Now we construct and send the response to the user with their auth tokens in the header and the user object in the body
    saveNewUser(newUser).then(authTokens => {
      res.header('x-refresh-token', authTokens.refreshToken)
        .header('x-access-token', authTokens.accessToken)
        .send(newUser);
    }).catch(e => {
      console.log('error from save user', e);
      res.status(400).send(e);
    });
  }

  // User sign up
  if (req.needsVerification) {
    // console.log('**needs verification');
    if (!req.body.sitekey) {
      // console.log('but no captcha**');
      res.status(400).send({
        "message": 'captcha not checked',
        'captcha': true
      });

    } else {
      // console.log('captcha provided ', req.body.sitekey);
      verifyCaptcha(req).then(result => {
        if (result.success) {
          // console.log('**verified with captcha**');
          signup();
        }
      }).catch(e => {
        // console.log('captcha verification failed', e);
        reject(e);
      });

    }

  } else if (false === req.needsVerification) {
    signup();
  }




});

let verifyCaptcha = req => {
  return new Promise((resolve, reject) => {
    const secretKey = '6Lf1C-UUAAAAAGm8csTzZzdi68kzKQYitfAt7CDk';
    const verifyUrl = `https://www.google.com/recaptcha/api/siteverify?secret=${secretKey}&response=${req.body.sitekey}&remoteip=${req.connection.remoteAddress}`;

    // send the request to google api
    request(verifyUrl, (err, res, verification) => {
      // if verification fails send back an error response
      if (!verification.success && undefined !== verification.success) {
        reject({
          "error": 'captcha verification failed',
          'captcha': true
        });
      }

      // if verification succeeds 
      resolve({
        "success": true
      });
    });

  });
}

let saveNewUser = newUser => {
  return new Promise((resolve, reject) => {
    newUser.save().then(() => {
      return newUser.createSession();
    }).then((refreshToken) => {
      // Session created successfully - refreshToken returned.
      // now we geneate an access auth token for the user
      return newUser.generateAccessAuthToken().then((accessToken) => {
        // access auth token generated successfully, now we return an object containing the auth tokens
        const authTokens = {
          accessToken,
          refreshToken
        };
        resolve(authTokens);
      });
    }).catch((e) => {
      reject(e);
    });
  });
}




/**
 * POST /users/login
 * Purpose: Login
 */
app.post('/users/login', (req, res) => {
  let email = req.body.email;
  let password = req.body.password;

  User.findByCredentials(email, password).then((user) => {
    return user.createSession().then((refreshToken) => {
      // Session created successfully - refreshToken returned.
      // now we geneate an access auth token for the user

      return user.generateAccessAuthToken().then((accessToken) => {
        // access auth token generated successfully, now we return an object containing the auth tokens
        return {
          accessToken,
          refreshToken
        }
      });
    }).then((authTokens) => {
      // Now we construct and send the response to the user with their auth tokens in the header and the user object in the body
      res
        .header('x-refresh-token', authTokens.refreshToken)
        .header('x-access-token', authTokens.accessToken)
        .send(user);
    })
  }).catch((e) => {
    res.status(400).send(e);
  });
})


/**
 * GET /users/me/access-token
 * Purpose: generates and returns an access token
 */
app.get('/users/me/access-token', verifySession, (req, res) => {
  // we know that the user/caller is authenticated and we have the user_id and user object available to us
  req.userObject.generateAccessAuthToken().then((accessToken) => {
    res.header('x-access-token', accessToken).send({
      accessToken
    });
  }).catch((e) => {
    console.log('e from me/access-token', e);
    res.status(400).send(e);
  });
});


/**
 * POST / users / ip / address
 * Purpose: generates and returns an access token
 */
app.post('/users/ip/address', function (req, res) {
  // access to IP address here
});



/* HELPER METHODS */
let deleteTasksFromList = (_listId) => {
  Task.deleteMany({
    _listId
  }).then(() => {
    console.log("Tasks from " + _listId + " were deleted!");
  })
}




app.listen(3000, () => {
  console.log("Server is listening on port 3000");
})