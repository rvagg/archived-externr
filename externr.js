/*!
  * Externr: Provide a plug-in mechanism for your objects, exposing their inmost secrets
  * (c) 2013 Rod Vagg <rod@vagg.org>
  * https://github.com/rvagg/externr
  * License: MIT
  */

(function (name, context, definition) {
  if (typeof module != 'undefined' && module.exports)
    module.exports = definition()
  else
    context[name] = definition()
})('externr', this, function() {

  var wrapNoop = function (that, args, callback) {
        return callback.apply(that, args)
      }
    , wrapReverseNoop = function (that, args, callback) {
        return callback.apply(that, args)
      }
    , extendNoop = function (arg) { return arg }
    , extendReverseNoop = function (arg) { return arg }

    , handleWrap = function (that, args, callback) {
        var i = this.length
          , handle = function () {
              if (i-- === 0)
                return callback.apply(that, arguments)
              var args = Array.prototype.slice.call(arguments)
              args.push(handle.bind(this))
              return this[i].apply(that, args)
            }

        return handle.apply(this, args)
      }

    , handleWrapReverse = function (that, args, callback) {
        var i = 0
          , handle = function () {
              if (i++ === this.length)
                return callback.apply(that, arguments)
              var args = Array.prototype.slice.call(arguments)
              args.push(handle.bind(this))
              return this[i - 1].apply(that, args)
            }

        return handle.apply(this, args)
      }

    , handleExtend = function (arg) {
        return this.reduce(function (arg, fn) { return fn(arg) }, arg)
      }

    , handleExtendReverse = function (arg) {
        return this.reduceRight(function (arg, fn) { return fn(arg) }, arg)
      }

    , Externs = {
          $register: function (handlers) {
            if (handlers == null)
              return
            if (Array.isArray(handlers))
              return handlers.forEach(this.$register.bind(this))
            if (typeof handlers != 'object')
              return

            Object.keys(handlers).forEach(function (m) {
              if (typeof handlers[m] != 'function')
                return

              var arkey = '$_' + m

              if (this[m] === wrapNoop) {
                this[arkey] = []
                this[m] = handleWrap.bind(this[arkey])
              } else if (this[m] === wrapReverseNoop) {
                this[arkey] = []
                this[m] = handleWrapReverse.bind(this[arkey])
              } else if (this[m] === extendNoop) {
                this[arkey] = []
                this[m] = handleExtend.bind(this[arkey])
              } else if (this[m] === extendReverseNoop) {
                this[arkey] = []
                this[m] = handleExtendReverse.bind(this[arkey])
              } else if (!Array.isArray(this[arkey])) {
                return
              }

              this[arkey].push(handlers[m])
            }.bind(this))
          }
      }

    , externs = function (methods) {
        var iface = Object.create(Externs)
        methods.wrap && methods.wrap.forEach(function (method) {
          iface[method] = wrapNoop
        })
        methods.wrapReverse && methods.wrapReverse.forEach(function (method) {
          iface[method] = wrapReverseNoop
        })
        methods.extend && methods.extend.forEach(function (fn) {
          iface[fn] = extendNoop
        })
        methods.extendReverse && methods.extendReverse.forEach(function (fn) {
          iface[fn] = extendReverseNoop
        })
        return iface
      }

    return externs

})