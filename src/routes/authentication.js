(function(Auth) {

	var passport = require('passport'),
		passportLocal = require('passport-local').Strategy,
		passportTwitter = require('passport-twitter').Strategy,
		passportGoogle = require('passport-google-oauth').OAuth2Strategy,
		passportFacebook = require('passport-facebook').Strategy,
		login_strategies = [],

		user_module = require('./../user.js'),
		config = require('./../../config.js');




	passport.use(new passportLocal(function(user, password, next) {
		user_module.loginViaLocal(user, password, function(login) {
			if (login.status === 'ok') next(null, login.user);
			else next(null, false, login);
		});
	}));

	if (config.twitter && config.twitter.key && config.twitter.key.length > 0 && config.twitter.secret.length > 0) {
		passport.use(new passportTwitter({
			consumerKey: config.twitter.key,
			consumerSecret: config.twitter.secret,
			callbackURL: config.url + 'auth/twitter/callback'
		}, function(token, tokenSecret, profile, done) {
			user_module.loginViaTwitter(profile.id, profile.username, function(err, user) {
				if (err) { return done(err); }
				done(null, user);
			});
		}));

		login_strategies.push('twitter');
	}

	if (config.google && config.google.id.length > 0 && config.google.secret.length > 0) {
		passport.use(new passportGoogle({
			clientID: config.google.id,
			clientSecret: config.google.secret,
			callbackURL: config.url + 'auth/google/callback'
		}, function(accessToken, refreshToken, profile, done) {
			user_module.loginViaGoogle(profile.id, profile.displayName, profile.emails[0].value, function(err, user) {
				if (err) { return done(err); }
				done(null, user);
			});
		}));

		login_strategies.push('google');
	}

	if (config.facebook && config.facebook.app_id.length > 0 && config.facebook.secret.length > 0) {
		passport.use(new passportFacebook({
			clientID: config.facebook.app_id,
			clientSecret: config.facebook.secret,
			callbackURL: config.url + 'auth/facebook/callback'
		}, function(accessToken, refreshToken, profile, done) {
			user_module.loginViaFacebook(profile.id, profile.displayName, profile.emails[0].value, function(err, user) {
				if (err) { return done(err); }
				done(null, user);
			});
		}));

		login_strategies.push('facebook');
	}

	passport.serializeUser(function(user, done) {
		done(null, user.uid);
	});

	passport.deserializeUser(function(uid, done) {
		done(null, {
			uid: uid
		});
	});

	Auth.initialize = function(app) {
		app.use(passport.initialize());
		app.use(passport.session());
	}
	

	Auth.get_login_strategies = function() {
		return login_strategies;
	}

	Auth.create_routes = function(app) {
		app.get('/logout', function(req, res) {
			console.log('info: [Auth] Session ' + req.sessionID + ' logout (uid: ' + global.uid + ')');
			user_module.logout(req.sessionID, function(logout) {
				req.logout();
				res.send(templates['header'] + templates['logout'] + templates['footer']);
			});
		});

		if (login_strategies.indexOf('twitter') !== -1) {
			app.get('/auth/twitter', passport.authenticate('twitter'));

			app.get('/auth/twitter/callback', passport.authenticate('twitter', {
				successRedirect: '/',
				failureRedirect: '/login'
			}));
		}

		if (login_strategies.indexOf('google') !== -1) {
			app.get('/auth/google', passport.authenticate('google', { scope: 'https://www.googleapis.com/auth/userinfo.profile https://www.googleapis.com/auth/userinfo.email' }));

			app.get('/auth/google/callback', passport.authenticate('google', {
				successRedirect: '/',
				failureRedirect: '/login'
			}));
		}

		if (login_strategies.indexOf('facebook') !== -1) {
			app.get('/auth/facebook', passport.authenticate('facebook', { scope: 'email' }));

			app.get('/auth/facebook/callback', passport.authenticate('facebook', {
				successRedirect: '/',
				failureRedirect: '/login'
			}));
		}



		app.get('/reset/:code', function(req, res) {
			res.send(templates['header'] + templates['reset_code'].parse({ reset_code: req.params.code }) + templates['footer']);
		});

		app.get('/reset', function(req, res) {
			res.send(templates['header'] + templates['reset'] + templates['footer']);
		});


		app.post('/login', passport.authenticate('local', {
			successRedirect: '/',
			failureRedirect: '/login'
		}));
		
		app.post('/register', function(req, res) {
			console.log('wtf');
			user_module.create(req.body.username, req.body.password, req.body.email, function(err, uid) {
				if (err === null) {
					req.login({
						uid: uid
					}, function() {
						res.redirect('/');
					});
				} else {
					res.redirect('/register');
				}
			});
		});
	}
}(exports));