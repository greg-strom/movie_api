/** 
 * @fileoverview The index.js file creates the Express application, sets up the server, and implements routes to the API
 * endpoints that are used for accessing, updating & deleting myFlix data. Requests made to API endpoints use mongoose 
 * models created in models.js and are authenticated using strategies implemented in passport.js. The connection between
 * mongoose and the database is established with the connect method. The database is hosted on MongoDB Atlas, and the 
 * server and endpoints are hosted on Heroku at https://cfmovieapp.herokuapp.com/.
 * @requires mongoose The mongoose module connects the app to the database and implements data schemas using models.
 * @requires './models.js' This is the file where data schemas and models are defined.
 * @requires express The express module creates an express application.
 * @requires morgan The morgan module logs requests made to the database.
 * @requires passport The passport module creates strategies for authenticating and authorizing requests to the API endpoints.
 * @requires './auth.js' This is the file that implements the user login route.
 * @requires cors The cors module is used to control origins from which requests to the server can be made.
 * @requires express-validator The express-validator validates data provided when creating or updating a user.
 */

require('dotenv').config();
const mongoose = require('mongoose');
const Models = require('./models.js');
const Movies = Models.Movie;
const Users = Models.User;
const config = require('./config');
const { check, validationResult } = require('express-validator');

mongoose.connect( process.env.CONNECTION_URI, { useNewUrlParser: true, useUnifiedTopology: true });
// mongoose.connect(config.CONNECTION_URI, { useNewUrlParser: true, useUnifiedTopology: true });
// mongoose.connect('mongodb://localhost:27017/myFlixDB', { useNewUrlParser: true, useUnifiedTopology: true });

const express = require('express'),
  morgan = require('morgan');
  uuid = require('uuid');
  bodyParser = require('body-parser');

const app = express();
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

const cors = require('cors');
app.use(cors());

// This is where the POST request to the login endpoint is referred to the auth file for implementation.
let auth = require('./auth')(app);
const passport = require('passport');
require('./passport');

app.use(morgan('common'));

// Note to self: at some point change this to make Mongoose use `findOneAndUpdate()`. Note that this option is `true`
// by default, you need to set it to false.
mongoose.set('useFindAndModify', false);


// * Here begins the sequence of API endpoints.



//  * General comments:
//  * 
//  * HTTP requests in express have three paramaters. The first parameter specifies the endpoint. The second parameter sets 
//  * conditions that have to be checked in order for the HTTP request to complete. In HTTP requests to protected endpoints,
//  * the second parameter invokes an authentication strategy callback function. (All HTTP requests in this application go 
//  * to protected endpoings except for the POST request for registering a new user.) The third parameter is another callback 
//  * function, which takes request (req) and response (res) objects as parameters that can be used to access data linked to 
//  * the request. If authentication succeeds, the authenticated user is attached to the request (req) object, and the 
//  * callback is fired.


/**
 * GET request to the /movies endpoint, returning all movies in the database.
 * @method GET
 * @param {string} URL - in this case, '/movies'
 * @param {authCallback} function - invokes authentication strategy
 * @param {reqResCallback} function - uses req & res parameters to access data linked to the request
 * @returns {Array} An array of all the movie records in the database.
 */

app.get('/movies', passport.authenticate('jwt', { session: false }), (req, res) => {
  Movies.find()
    .then((movies) => {
      res.status(201).json(movies);
    })
    .catch((err) => {
      console.error(err);
      res.status(500).send('Error: ' + err);
    });
});

/**
 * GET request to the /movies/:MovieID endpoint, returning data (description, genre, director, image URL, 
 * whether it???s one of the user's favorites) about a single movie by MovieID to the user
 * @method GET
 * @param {string} URL - in this case, '/movies/:MovieID
 * @example '/movies/60f1cc137a111c2a24f78e1b'
 * @param {authCallback} function - invokes authentication strategy
 * @param {reqResCallback} function - uses req & res parameters to access data linked to the request
 * @returns {Object} An object containing the movie record for the movie whose MovieID is included in the URL. 
 */

app.get('/movies/:MovieID', passport.authenticate('jwt', { session: false }), (req, res) => {
  Movies.findOne({ _id: req.params.MovieID })
    .then((movie) => {
      res.json(movie);
    })
    .catch((err) => {
      console.error(err);
      res.status(500).send('Error: ' + err);
    });
});

/**
 * GET request to the /movies/genre/:genre endpoint, returning data about a genre by name (e.g., "Thriller")
 * @method GET 
 * @param {string} URL - in this case '/movies/genre/:genre'
 * @example '/movies/genre/Thriller'
 * @param {authCallback} function - invokes authentication strategy
 * @param {reqResCallback} function - uses req & res parameters to access data linked to the request
 * @returns {Array} An array of objects each of which has the genre in the URL as its "Genre" value 
 */

app.get('/movies/genres/:genre', passport.authenticate('jwt', { session: false }), (req, res) => {
  Movies.find({ 'Genre.Name': req.params.genre })
    .then((movies) => {
      res.json(movies);
    })
    .catch((err) => {
      console.error(err);
      res.status(500).send('Error: ' + err);
    });
});

/**
 * GET request to the /movies/director/:name endpoint, returning data about a director (bio, 
 * birth year, death year).
 * @method GET 
 * @param {string} URL - in this case '/movies/director/:name'
 * @example /movies/director/Alfred Hitchcock
 * @param {authCallback} function - invokes authentication strategy
 * @param {reqResCallback} function - uses req & res parameters to access data linked to the request
 * @returns {Object} An object containing the data about the director whose name is in the URL.
 */

app.get('/directors/:name', passport.authenticate('jwt', { session: false }), (req, res) => {
  Movies.findOne({ 'Director.Name': req.params.name })
    .then((movies) => {
      res.json(movies.Director);
    })
    .catch((err) => {
      console.error(err);
      res.status(500).send('Error: ' + err);
    });
});

/**
 * POST request to the /users endpoint to create a new user. This request requires a request body with 
 * the fields: Username, Password, Email, Birthday. The fields are first validated against specified 
 * validators before the new user record is created. The new user in the MongoDB users collection hosted 
 * on Atlas will also be given a unique integer ID once it is created, giving JSON in this format: { ID:
 * Integer, Username: String, Password: String, Email: String, Birthday: Date }
 * @method POST 
 * @param {string} URL - in this case, '/users'
 * @param {array} Array containing Username, Password, Email, Birthday. These are checked to ensure they 
 * are in an appropriate form before the code proceeds.
 * @param {reqResCallback} function - uses req & res parameters to access data linked to the request
 * @returns {Object} An object containing the new user record with Username, Email, and Birthday.
 */

app.post('/users',
  [
  check('Username', 'Username is required').isLength({min: 5}),
  check('Username', 'Username contains non alphanumeric characters - not allowed.').isAlphanumeric(),
  check('Password', 'Password is required').not().isEmpty(),
  check('Email', 'Email does not appear to be valid').isEmail()
  ], (req, res) => {

  let errors = validationResult(req);

  if (!errors.isEmpty()) {
    return res.status(422).json({ errors: errors.array() });
  }

  let hashedPassword = Users.hashPassword(req.body.Password);
  Users.findOne({ Username: req.body.Username })
    .then((user) => {
      if (user) {
        return res.status(400).send(req.body.Username + ' already exists');
      } else {
        Users
          .create({
            Username: req.body.Username,
            Password: hashedPassword,
            Email: req.body.Email,
            Birthday: req.body.Birthday
          })
          .then((user) =>{res.status(201).json({Username: user.Username, Email: user.Email, Birthday: user.Birthday}) })
        .catch((error) => {
          console.error(error);
          res.status(500).send('Error: ' + error);
        })
      }
    })
    .catch((error) => {
      console.error(error);
      res.status(500).send('Error: ' + error);
    });
});


/**
 * PUT request to the /users/:Username endpoint to update the user's details. This request requires 
 * a request body with the fields: Username, Password, Email, Birthday. The fields are first 
 * validated against specified validators before the user record is updated.
 * @method PUT
 * @param {string} URL - in this case, '/users/:Username'
 * @example /users/revisedusername
 * @param {object} Object containing Username, Password, Email, Birthday. These are checked to ensure they 
 * are in an appropriate form before the code proceeds.
 * @param {authCallback} function - invokes authentication strategy
 * @param {reqResCallback} function - uses req & res parameters to access data linked to the request
 * @returns {Object} An object containing the updated user record.
 */

//Note to self for future: make this refer to users/: and then the userID, not the username
app.put('/users/:Username',
  [
  check('Username', 'Username is required').isLength({min: 5}),
  check('Username', 'Username contains non alphanumeric characters - not allowed.').isAlphanumeric(),
  check('Password', 'Password is required').not().isEmpty(),
  check('Email', 'Email does not appear to be valid').isEmail()
  ], passport.authenticate('jwt', { session: false }), (req, res) => {

  let errors = validationResult(req);

  if (!errors.isEmpty()) {
    return res.status(422).json({ errors: errors.array() });
  }

  let hashedPassword = Users.hashPassword(req.body.Password);

  let updateObj = {};

  if (req.body.Username) {
    updateObj.Username = req.body.Username
  }
  if (req.body.Password) {
    updateObj.Password = hashedPassword
  }
  if (req.body.Email) {
    updateObj.Email = req.body.Email
  }
  if (req.body.Birthday) {
    updateObj.Birthday = req.body.Birthday
  }

  Users.findOneAndUpdate({ Username: req.params.Username }, { $set: updateObj },
  { new: true }, // This line makes sure that the updated document is returned. otherwise the old object is returned because of standard procedure.
  (err, updatedUser) => {
    if(err) {
      console.error(err);
      res.status(500).send('Error: ' + err);
    } else {
      res.status(201).json(updatedUser);
    }
  });
});


/**
 * POST request to the /users/:Username/movies/:MovieID endpoint. This method is used to add a movie to the user's
 * favorites. Note that values that go in for :MovieID need to be in the form "89eaf...", not "ObjectID(89eaf...)"
 * @method POST
 * @param {string} URL - in this case, '/users/:Username/movies/:MovieID'
 * @example /users/exampleusername/movies/60f1cc137a111c2a24f78e1b
 * @param {authCallback} function - invokes authentication strategy
 * @param {reqResCallback} function - uses req & res parameters to access data linked to the request
 * @returns {Object} An object with the user information from MongoDB, including the updated favorite movies.
 */

// Add a movie to a user's list of favorites. Note that :MovieID needs to be "89eaf..." not "ObjectID(89eaf...)"
app.post('/users/:Username/movies/:MovieID', passport.authenticate('jwt', { session: false }), async (req, res) => {
  Users.findOneAndUpdate({ Username: req.params.Username }, {
     $push: { FavoriteMovies: req.params.MovieID }
   },
   { new: true }, // This line makes sure that the updated document is returned
  (err, updatedUser) => {
    if (err) {
      console.error(err);
      res.status(500).send('Error: ' + err);
    } else {
      //res.status(201).send('Your favorites have been updated.');
      res.json(updatedUser);
    }
  });
});

/**
 * DELETE request to the /users/:Username/movies/:MovieID endpoint. This is used to remove a movie from the user's
 * favorites.
 * @method DELETE 
 * @param {string} URL - in this case, '/user/:Username/movies/:MovieID'
 * @example /users/exampleusername/movies/60f1cc137a111c2a24f78e1b
 * @param {authCallback} function - invokes authentication strategy
 * @param {reqResCallback} function - uses req & res parameters to access data linked to the request
 * @returns {Object} An object with the user information from MongoDB, including the updated favorite movies.
 */

app.delete('/users/:Username/movies/:MovieID', passport.authenticate('jwt', { session: false }), (req, res) => {
  Users.findOneAndUpdate({ Username: req.params.Username }, {
     $pull: { FavoriteMovies: req.params.MovieID }
   },
   { new: true }, // This line makes sure that the updated document is returned
  (err, updatedUser) => {
    if (err) {
      console.error(err);
      res.status(500).send('Error: ' + err);
    } else {
      //res.status(201).send('Your favorites have been updated.');
      res.json(updatedUser);
    }
  });
});

/**
 * GET request to the /users/:Username/favorites endpoint.
 * @method GET 
 * @param {string} URL - in this case, '/users/:Username/favorites'
 * @example /users/exampleusername/favorites
 * @param {authCallback} function - invokes authentication strategy
 * @param {reqResCallback} function - uses req & res parameters to access data linked to the request
 * @returns {Object} An object with one key - "Movies" - whose value is an array of the IDs of the 
 * user's favorite movies.
 */

app.get('/users/:Username/favorites', passport.authenticate('jwt', {session: false }), (req, res) => {
  Users.findOne({ Username: req.params.Username })
    .then((user) => {
      console.log(user);
      res.status(201).json({FavoriteMovies: user.FavoriteMovies});
    })
    .catch((err) => {
      console.error(err);
      res.status(500).send('Error: ' + err);
    })
});


/**
 * DELETE request to the /users/:Username endpoint. Used to remove a user from the database.
 * @method DELETE
 * @param {string} URL - in thise case, '/users/:Username'
 * @example /users/exampleusername
 * @param {authCallback} function - invokes authentication strategy
 * @param {reqResCallback} function - uses req & res parameters to access data linked to the request
 * @returns {string} A text message: '[Username] was deleted'.
 */
// Delete a user by username
app.delete('/users/:Username', passport.authenticate('jwt', { session: false }), (req, res) => {
  Users.findOneAndRemove({ Username: req.params.Username })
    .then((user) => {
      if (!user) {
        res.status(400).send(req.params.Username + ' was not found');
      } else {
        res.status(200).send(req.params.Username + ' was deleted.');
      }
    })
    .catch((err) => {
      console.error(err);
      res.status(500).send('Error: ' + err);
    });
});


// Get all users -- This endpoint was created early on in the project to test whether express is working properly.
// It is not currently operational but I have kept it here in case it might be useful later.
// app.get('/users', (req, res) => {
//   Users.find()
//     .then((users) => {
//       res.status(201).json(users);
//     })
//     .catch((err) => {
//       console.error(err);
//       res.status(500).send('Error: ' + err);
//     });
// });

/**
 * GET request to the /users/:Username endpoint. Used to acquire information about a given user.
 * @method GET 
 * @param {string} URL - in this case, '/users/:Username'
 * @example /users/exampleusername
 * @param {authCallback} function - invokes authentication strategy
 * @param {reqResCallback} function - uses req & res parameters to access data linked to the request
 * @returns {Object} An object containing the record for the user included in the URL.
 */
// Get a user by username
app.get('/users/:Username', /*passport.authenticate('jwt', { session: false }),*/ (req, res) => {
  Users.findOne({ Username: req.params.Username })
    .then((user) => {
      res.json(user);
    })
    .catch((err) => {
      console.error(err);
      res.status(500).send('Error: ' + err);
    });
});

// This implements express.static to serve the documentation file from the public folder.
app.use(express.static('public'));

// This is an error handling function to catch any previously uncaught errors and log them to the console.
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).send('Something didn\'t work!');
});

// This creates a reference to the port on the hosted server
const port = process.env.PORT || 8080;
app.listen(port, '0.0.0.0',() => {
 console.log('Listening on Port ' + port);
});
