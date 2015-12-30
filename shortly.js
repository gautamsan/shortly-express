var express = require('express');
var util = require('./lib/utility');
var partials = require('express-partials');
var bodyParser = require('body-parser');
var session = require('express-session');
var bcrypt = require('bcrypt-nodejs');
var keys = require('./secrets/keys');
var passport = require('passport');
var localStrategy = require('passport-local').Strategy;
var githubStrategy = require('passport-github2').Strategy;

var db = require('./app/config');
var Users = require('./app/collections/users');
var User = require('./app/models/user');
var Links = require('./app/collections/links');
var Link = require('./app/models/link');
var Click = require('./app/models/click');

passport.use(new localStrategy(function(username, password, done) {
  new User({'username' : username}).fetch()
    .then(function(model) {
      if(!model) return done(null, false);
      model.comparePassword(password, function(result) {
        console.log(result, ' in login process');
        if(result) {
          return done(null, username);
        }else{
          return done(null, false);
        }
      })
    });
}));
passport.serializeUser(function(user, done) {
  done(null, user);
});
passport.deserializeUser(function(user, done) {
  done(null, user);
})
passport.use(new githubStrategy({
  clientID: keys.ClientID,
  clientSecret: keys.ClientSecret,
  callbackURL: 'http://127.0.0.1:4568/loginGitHub/callback'
}, function(accessToken, refreshToken, profile, done) {
  console.log("github", profile)
  done(null, profile.username);
}));

var app = express();

app.set('views', __dirname + '/views');
app.set('view engine', 'ejs');
app.use(partials());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(__dirname + '/public'));
app.use(session({
  secret: 'our secret', 
  resave: true, 
  saveUninitialized: true
}));
app.use(passport.initialize());
app.use(passport.session());

app.get('/', util.checkUser, function(req, res) {
    res.render('index');
});

app.get('/create', util.checkUser, function(req, res) {
    res.render('index');
});

app.get('/links', util.checkUser, function(req, res) {
    Links.reset().fetch().then(function(links) {
      res.send(200, links.models);
    });
});

app.post('/links', 
function(req, res) {
  var uri = req.body.url;

  if (!util.isValidUrl(uri)) {
    console.log('Not a valid url: ', uri);
    return res.send(404);
  }

  new Link({ url: uri }).fetch().then(function(found) {
    if (found) {
      res.send(200, found.attributes);
    } else {
      util.getUrlTitle(uri, function(err, title) {
        if (err) {
          console.log('Error reading URL heading: ', err);
          return res.send(404);
        }

        var link = new Link({
          url: uri,
          title: title,
          base_url: req.headers.origin
        });

        link.save().then(function(newLink) {
          Links.add(newLink);
          res.send(200, newLink);
        });
      });
    }
  });
});
/*
    Authentication
*/

app.get('/login', 
function(req, res) {
  res.render('login');
});

app.get('/signup', 
function(req, res) {
  res.render('signup');
});

app.post('/login',
  passport.authenticate('local'), 
  function(req, res) {
    res.redirect('/');
  }
);

app.post('/signup', 
function(req, res){
  new User({'username': req.body.username, 'password': req.body.password}).save()
    .then(function() {
      req.session.regenerate(function(err) {
        req.session.passport.user = req.body.username;
        res.redirect('/');
      });
    });
});

app.get('/logout',
function(req, res){
  req.logout();
  res.redirect('/login');
});
/*
    GitHub Authorization
*/
app.get('/loginGitHub', passport.authenticate('github', {scope: ['user:email']}));
app.get('/loginGitHub/callback', passport.authenticate('github', {failureRedirect: '/login'}), 
  function(req, res) {
    res.redirect('/');
  });

app.get('/*', function(req, res) {
  new Link({ code: req.params[0] }).fetch().then(function(link) {
    if (!link) {
      res.redirect('/');
    } else {
      var click = new Click({
        link_id: link.get('id')
      });

      click.save().then(function() {
        db.knex('urls')
          .where('code', '=', link.get('code'))
          .update({
            visits: link.get('visits') + 1,
          }).then(function() {
            return res.redirect(link.get('url'));
          });
      });
    }
  });
});

console.log('Shortly is listening on 4568');
app.listen(4568);

