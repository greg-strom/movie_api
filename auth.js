/**
 * @fileoverview The auth file implements the login route for registered users.
 * @requires passport The passport module creates strategies for authenticating and authorizing requests to API endpoints.
 * @requires './passport.js' This file is where passport strategies are implemented.
 * @requires jsonwebtoken The jsonwebstoken module creates JWTs for authorizing requests to protected endpoints.
 * @requires xss The xss module filters input from users to prevent XSS attacks.
 */

//const config = require('./config.js')

const jwtSecret = 'your_jwt_secret'; // This stores the value of the secret used to decode the JWTs. Has to be the same key used in the JWTStrategy

const jwt = require('jsonwebtoken'),
  passport = require('passport'),
  xss = require('xss');


require('./passport'); // Your local passport file

/**
 * This function generates a JWT that is used to authorize requests to protected routes that implement 
 * the JWT passport strategy.
 * @function generateJWTToken 
 * @param {*} user - Authenticated user returned by the local passport strategy.
 * @returns {string} A json web token.
 */

let generateJWTToken = (user) => {
  return jwt.sign(user, jwtSecret, {
    subject: user.Username, // This is the username we're encoding in the JWT
    expiresIn: '7d', // This specifies that the token will expire in 7 days
    algorithm: 'HS256' // This is the algorithm used to “sign” or encode the values of the JWT
  });
}

/* POST login. */
/**
 * This function implements and exports a POST request to the /login endpoint for logging in a registered user. 
 * The request parameters require a Username and Password, but no body is required because these fields are submitted
 * in html form in the front end attached to the login URL as a query string. Then the request is authenticated using 
 * the local passport strategy. If there is no error, a JWT is created by calling the generateJWTToken function.
 * Finally, this JWT is returned along with the user object from MongoDB.
 * @function
 * @param {*} router The express router created in index.js.
 * @returns {Object} An object containing the JWT and the user object from MongoDB corresponding to the logged-in user.
 */
module.exports = (router) => {
  router.post('/login', (req, res) => {
    passport.authenticate('local', { session: false }, (error, user, info) => {
      if (error || !user) {
        return res.status(400).json({
          message: 'Something is not right',
          user: user
        });
      }
      req.login(user, { session: false }, (error) => {
        if (error) {
          res.send(error);
        }
        let token = generateJWTToken(user.toJSON());
        return res.json({ 
          token,
          user: {
            Username: xss(user.Username),
            FavoriteMovies: user.FavoriteMovies,
            Email: xss(user.Email),
            Birthday: xss(user.Birthday)
          }
        });
      });
    })(req, res);
  });
}
