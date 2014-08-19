// our core API

var fs      = require('fs')
  , Externr = require('./')


function SizeSpeaker (name) {
  this.name = name
  this._externs = Externr({
      extend: [ 'getName' ]
    , wrap: [ 'fsize' ]
  })
  this.use = this._externs.$register.bind(this._externs)
}


SizeSpeaker.prototype.getName = function () {
  return this._externs.getName(this.name)
}


SizeSpeaker.prototype.fsize = function (path, callback) {
  fs.stat(path, function (err, stat) {
    if (err) return callback(err)
    this._externs.fsize(this, [ path, stat, callback ], function (path, stat, callback) {
      var say = this.getName() + ' says that the size of ' + path + ' is ' + stat.size
      callback(null, say)
    })
  }.bind(this))
}


// the user of the API, along with plugins

var bruce = new SizeSpeaker('Bruce')

  , personalityPlugin = {
      getName: function (name) { return name + ' the Spruce' }
    }

  , niceSizePlugin = {
      fsize: function (path, stat, callback, next) {
        stat.size = (Math.round(stat.size / 1024 * 10) / 10) + ' kB'
        next(path, stat, callback)
      }
    }

  , boldNamePlugin = {
      getName: function (name) { return name.bold }
    }


require('colors')


bruce.use([ personalityPlugin, boldNamePlugin, niceSizePlugin ])


bruce.fsize('/usr/share/dict/words', function (err, said) {
  if (err) throw err
  console.log(said)
})
