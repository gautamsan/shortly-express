var db = require('../config');
var bcrypt = require('bcrypt-nodejs');
var Promise = require('bluebird');

var User = db.Model.extend({
  tableName: 'users',
  initialize: function(){
    this.on('creating', this.hashPass)
  },
  comparePassword: function(password, callback){
    bcrypt.compare(password, this.get('password'), function(err, result) {
      callback(result);
    });
  },
  hashPass: function(model, attr, options){
    var promiseHash = Promise.promisify(bcrypt.hash);
    return promiseHash(model.get('password'), null, null)
      .then(function(hash) {
        model.set('password', hash);
      });
  }
});

module.exports = User;