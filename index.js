'use strict'

/**
 * Module dependencies.
 */

const express = require('express');
const hash = require('pbkdf2-password')()
const path = require('path');
const session = require('express-session');
const Datastore = require('nedb');

const app = module.exports = express();

// config

app.set('view engine', 'ejs');
app.engine('ejs', require('ejs').__express);
app.set('views', path.join(__dirname, 'views'));

// middleware

app.use(express.urlencoded({ extended: false }))
app.use(session({
  resave: false, // don't save session if unmodified
  saveUninitialized: false, // don't create session until something stored
  secret: 'shhhh, very secret'
}));

// Session-persisted message middleware

app.use((req, res, next) => {
  const err = req.session.error;
  const msg = req.session.success;
  delete req.session.error;
  delete req.session.success;
  res.locals.message = '';
  if (err) res.locals.message = '<p class="msg error">' + err + '</p>';
  if (msg) res.locals.message = '<p class="msg success">' + msg + '</p>';
  next();
});


const database = new Datastore('database.db');
database.loadDatabase();

// const users = {
//   tj: { name: 'tj' }
// };

// when you create a user, generate a salt
// and hash the password ('foobar' is the pass here)

// hash({ password: 'foobar' }, (err, pass, salt, hash) => {
//   if (err) throw err;
//   // store the salt & hash in the "db"
//   users.tj.salt = salt;
//   users.tj.hash = hash;
// });


// Authenticate using our plain-object database of doom!

function authenticate(name, pass, fn) {
  if (!module.parent) console.log('authenticating %s:%s', name, pass);
  // query the db for the given username
  database.findOne({username: name}, (err, user) => {
		if (err) {
			response.end();
			return;	
    }
    //const user = data;
    if (!user) return fn(null, null)
    // apply the same algorithm to the POSTed password, applying
    // the hash against the pass / salt, if there is a match we
    // found the user
    hash({ password: pass, salt: user.salt }, (err, pass, salt, hash) => {
      if (err) return fn(err);
      if (hash === user.hash) return fn(null, user)
      fn(null, null)
    });
  });
}

function register(name, pass) {
  if (!module.parent) console.log('registering %s:%s', name, pass);
  const user = { 'username': name };
  const pword = pass;
  hash({ password: pword }, (err, pass, salt, hash) => {
    if (err) throw err;
    // set the salt & hash
    user.salt = salt;
    user.hash = hash;
    database.insert(user);
  });
}

function restrict(req, res, next) {
  if (req.session.user) {
    next();
  } else {
    req.session.error = 'Access denied!';
    res.redirect('/login');
  }
}

app.get('/', (req, res) => {
  res.redirect('/login');
});

app.get('/restricted', restrict, (req, res) => {
  res.send('Wahoo! restricted area, click to <a href="/logout">logout</a>');
});

app.get('/logout', (req, res) => {
  // destroy the user's session to log them out
  // will be re-created next request
  req.session.destroy(() => {
    res.redirect('/');
  });
});

app.get('/login', (req, res) => {
  res.render('login');
});

app.post('/login', (req, res, next) => {
  authenticate(req.body.username, req.body.password, (err, user) => {
    if (err) return next(err)
    if (user) {
      //console.log('user: ' + JSON.stringify(user, null, 4));
      // Regenerate session when signing in
      // to prevent fixation
      req.session.regenerate(() => {
        // Store the user's primary key
        // in the session store to be retrieved,
        // or in this case the entire user object
        req.session.user = user;
        req.session.success = 'Authenticated as ' + user.username
          + '<br />click to <a href="/logout">logout</a>. '
          + '<br />You may now access <a href="/restricted">/restricted</a>.';
        res.redirect('back');
      });
    } else {
      req.session.error = 'Authentication failed, please check your '
        + ' username and password.';
      res.redirect('/login');
    }
  });
});

app.get('/signup', (req, res) => {
  res.render('signup');
});

app.post('/signup', (req, res, next) => {
  console.log('i got a request');
	console.log(req.body);
  // probably write a function that checks for duplicate entries here?
	//const data = req.body;
  // database.insert(data);
  database.find({ username: req.body.username }, function (err, docs) {
    if (docs.length > 0 ) {
      console.log('name already in use');
      req.session.error = 'name already in use!';
      res.redirect('/signup');
    } else {
      register(req.body.username, req.body.password);
      req.session.regenerate(function () {
      req.session.success = `You are signed up as ${req.body.username}. Return to <a href="/login">login page to log in</a>.`;
      res.redirect('/signup');
      });
    }
  });
	//console.log(database);
	//res.json(data);
});

/* istanbul ignore next */
if (!module.parent) {
  app.listen(3000);
  console.log('Express started on port 3000');
}