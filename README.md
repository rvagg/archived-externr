# Externr [![Build Status](https://secure.travis-ci.org/rvagg/externr.png)](http://travis-ci.org/rvagg/externr)

**Provide a plug-in mechanism for JavaScript objects, exposing their inmost secrets.**

[![NPM](https://nodei.co/npm/externr.png?stars&downloads&downloadRank)](https://nodei.co/npm/externr/) [![NPM](https://nodei.co/npm-dl/externr.png?months=6&height=3)](https://nodei.co/npm/externr/)


## Example

Let's imagine a super-useful module that gives you an object, with a name, that can take a file path and return a humanised string as if the object is speaking the size. (See what I mean by super-useful??)

```js
var fs = require('fs')

function SizeSpeaker (name) {
  this.name = name
}

SizeSpeaker.prototype.getName = function () {
  return this.name
}

SizeSpeaker.prototype.fsize = function (path, callback) {
  fs.stat(path, function (err, stat) {
    if (err) return callback(err)

    var say = this.getName() + ' says that the size of ' + path + ' is ' + stat.size
    callback(null, say)
  }.bind(this))
}

module.exports = function (name) { return new SizeSpeaker(name) }
```

Then we might use it like this:

```js
var SizeSpeaker = require('size-speaker')
  , bruce = SizeSpeaker('Bruce')

bruce.fsize('/usr/share/dict/british-english', function (err, said) {
  if (err) throw err
  console.log(said)
})
```

Running our little program we get:

```
Bruce says that the size of /usr/share/dict/british-english is 938969
```


So, that's great, I really should put that in npm. Anyway, say you want to make it extendible so that users of your neat little module can easily *plug in* objects that alter the functionality without having to explicitly monkey-patch and get all dirty.

In comes **Externr**. Identify potential extension points and then set up an internal `Externr` object which is aware of the kinds of extensions you want.

In our example, lets let plugins modify the `getName()` result and also inject themselves into the async file-size call:

```js
var fs = require('fs')
  , Externr = require('externr')

function SizeSpeaker (name) {
  this.name = name
  this._externs = Externr({
      extend: [ 'getName' ] // `extend` is a simple wrapped function
    , wrap: [ 'fsize' ] // `wrap` is for more complicated async calls
  })
  // expose a `.use()` method that can inject plugins into our own Externr instance
  this.use = this._externs.$register.bind(this._externs)
}

SizeSpeaker.prototype.getName = function() {
  // pass our default return value through Externr, which is a noop by default
  return this._externs.getName(this.name)
}

SizeSpeaker.prototype.fsize = function (path, callback) {
  fs.stat(path, function (err, stat) {
    if (err) return callback(err)
    // allow async injections *after* the `stat()` but before our returning callback
    this._externs.fsize(this, [ path, stat, callback ], function (path, stat, callback) {
      var say = this.getName() + ' says that the size of ' + path + ' is ' + stat.size
      callback(null, say)
    })
  }.bind(this))
}

module.exports = function (name) { return new SizeSpeaker(name) }
```

By default, anything passed through your `Externr` instance is a noop and will just pass back what it was given as if it wasn't there. Thankfully VMs can optimise most of the overhead away so it's as if it didn't exist.

But, we can now inject plugins! Plugins are simply objects whose keys match the functions we registered with our `Externr` instance:

```js
// give our object a bit of personality by injecting a nickname along with the name
var personalityPlugin = {
  getName: function (name) { return name + ' the Spruce' }
}
```

```js
// byte sizes aren't so nice when the file is large, so we'll do it in *kB*
// by adjusting the `stat()` data
var niceSizePlugin = {
  fsize: function (path, stat, callback, next) {
    stat.size = (Math.round(stat.size / 1024 * 10) / 10) + ' kB'
    next(path, stat, callback)
  }
}
```

Now we just need to inject the plugins with the `.use()` method that our `SizeSpeaker` exposes. First we'll register the `personalityPlugin`:

```js
// ...
var bruce = SizeSpeaker('Bruce')
// ...

bruce.use(personalityPlugin)

bruce.fsize('/usr/share/dict/british-english', function (err, said) {
  if (err) throw err
  console.log(said)
})
```

Gives us the output:

```
Bruce the Spruce says that the size of /usr/share/dict/british-english is 938969
```

Now let's register both plugins:

```js
// ...
var bruce = SizeSpeaker('Bruce')
// ...

bruce.use(personalityPlugin)
bruce.use(niceSizePlugin)

bruce.fsize('/usr/share/dict/british-english', function (err, said) {
  if (err) throw err
  console.log(said)
})
```

And we get the output:

```
Bruce the Spruce says that the size of /usr/share/dict/british-english is 917 kB
```

We can take it further by adding multiple plugins for the same extension point:

```js
require('colors')
// for use on the console only, 'colors' provides ANSI colour codes
var boldNamePlugin = {
  getName: function (name) { return name.bold }
}
```

And we just register it as well, this time we'll bundle them all into an array (optional):

```js
bruce.use([ personalityPlugin, boldNamePlugin, niceSizePlugin ])
```

## API

### Externr(extensionPoints)
Creates a new `Externr` object that can deal with the specified extension points. The extension points are defined in a plain object with arrays of strings on any, or all, of the following types:

**<code>'extend'</code>**: a simple single-property extension. Our `getName()` method above is an example of this; it returns a single property (the `name`) but passing it through our `Externr` instance lets plugins mutate the value, or even replace it completely. Plugin functions take the form of `function (arg) { return arg /* or something else */ }`.

Your internal code simply passes the default property through its `Externr` instance, as in our example: `return this._externs.getName(this.name)`.

Plugin functions for this type simply take an argument and return a value.

**<code>'extendReverse'</code>**: the same as `'extend'` but if multiple plugins are registered then they are processed in reverse order. Handy if you have properties that come *in* to your API and properties that go *out* so you want plugins to be applied in the opposite order for both.

**<code>'wrap'</code>**: more complex multi-argument and/or async calls. When you pass a call through an `Externr` instance you have to provide it with a context to bind function calls to (usually `this`), an array of arguments (can be an empty array if that makes sense for your API) and a final callback function that provides the default behaviour.

As in our example:

```js
this._externs.fsize(
    this                              // the `this` property for function calls
  , [ path, stat, callback ]          // array of initial arguments
  , function (path, stat, callback) { /* default behaviour callback */ }
)
```

Plugin calls look just like the default behaviour callback *except* they have an additional `next()` function:

```js
function (path, stat, callback, next) {
  stat.size = (Math.round(stat.size / 1024 * 10) / 10) + ' kB' // do something
  next(path, stat, callback) // defer to the next plugin or default callback
}
```

The `next()` function *must* be called with the correct number of arguments, although they need not be the same objects as it were passed (for example you could replace the `callback` function if you wanted to be clever).

Additionally, you don't have to even call `next()` if your plugin decides that the default behaviour is not desirable. Since plugins have access to the `this` that you provide it (usually the actual parent object being operated on), your plugins can divert calls from one part of your API to another. For example a `put()` call may be diverted to a `batch()` call along with additional entries for your database.

<code>'wrapReverse'</code> is the same as `'wrap'` but the plugins are applied in reverse order.

### externr.$register(plugin)
Once you have an `Externr` object, it will have a `.$register()` method that will allow plugins to be injected into it. The `plugin` argument can be a single plugin object or an array of plugin objects.

You an expose this directly to your API users (like we have done with a `use()` method in our example) but you need to make sure it's bound to the `Externr` instance, i.e. usually something like this `this.use = this._externs.$register.bind(this._externs)`.

**Note that plugins can implement any number of the available extension points**, they just need to provide the right keys on the object passed in to `Externr`.

## Licence

Externr is Copyright (c) 2014 Rod Vagg [@rvagg](https://twitter.com/rvagg) and licensed under the MIT licence. All rights not explicitly granted in the MIT license are reserved. See the included LICENSE.md file for more details.
