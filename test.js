const tape       = require('tape')
    , Externr    = require('./')


tape('simple extend', function (t) {
  var externr = Externr({ extend: [ 'sqr' ] })
    , o = { sqr: function (x) { return externr.sqr(x * x) } }

  t.equal(o.sqr(2), 4)
  externr.$register({ 'sqr': function (x) { return x + 1 }})
  t.equal(o.sqr(4), 4 * 4 + 1)
  externr.$register({ 'sqr': function (x) { return x / 2 }})
  t.equal(o.sqr(3), (3 * 3 + 1) / 2)
  t.end()
})


// same as previous but last one demonstrates reverse order
tape('simple extendReverse', function (t) {
  var externr = Externr({ extendReverse: [ 'sqr' ] })
    , o = { sqr: function (x) { return externr.sqr(x * x) } }

  t.equal(o.sqr(2), 4)
  externr.$register({ 'sqr': function (x) { return x + 1 }})
  t.equal(o.sqr(4), 4 * 4 + 1)
  externr.$register({ 'sqr': function (x) { return x / 2 }})
  t.equal(o.sqr(3), (3 * 3) / 2 + 1)
  t.end()
})


tape('simple wrap', function (t) {
  var externr = Externr({ wrap: [ 'sqr' ] })
    , o = {
          sqr: function (x) {
            return externr.sqr(this, [ x ], function (x) {
              return x * x
            })
          }
      }

  t.equal(o.sqr(2), 4)
  externr.$register({ 'sqr': function (x, next) { return next(x) + 1 }})
  t.equal(o.sqr(4), 4 * 4 + 1)
  externr.$register({ 'sqr': function (x, next) { return next(x) / 2 }})
  t.equal(o.sqr(3), (3 * 3) / 2 + 1)
  t.end()
})


tape('simple wrapReverse', function (t) {
  var externr = Externr({ wrapReverse: [ 'sqr' ] })
    , o = {
          sqr: function (x) {
            return externr.sqr(this, [ x ], function (x) {
              return x * x
            })
          }
      }

  t.equal(o.sqr(2), 4)
  externr.$register({ 'sqr': function (x, next) { return next(x) + 1 }})
  t.equal(o.sqr(4), 4 * 4 + 1)
  externr.$register({ 'sqr': function (x, next) { return next(x) / 2 }})
  t.equal(o.sqr(3), (3 * 3 + 1) / 2)
  t.end()
})
