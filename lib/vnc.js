// Generated by CoffeeScript 1.12.4
(function() {
  var CompositeDisposable, url;

  CompositeDisposable = require('atom').CompositeDisposable;

  url = require('url');

  module.exports = {
    vncProtocol: 'vnc:',
    activate: function(state) {
      this.subscriptions = new CompositeDisposable;
      this.subscriptions.add(atom.commands.add('atom-workspace', {
        'vnc:open': (function(_this) {
          return function() {
            return _this.vncOpen();
          };
        })(this)
      }));
      return atom.workspace.addOpener((function(_this) {
        return function(uri) {
          var u;
          u = url.parse(uri);
          if (u.protocol === _this.vncProtocol) {
            return _this.createVncView({
              uri: uri
            });
          }
        };
      })(this));
    },
    deactivate: function() {
      return this.subscriptions.dispose();
    },
    vncOpen: function() {
      if (this.VncConnectView == null) {
        this.VncConnectView = require('./connect-view');
      }
      return new this.VncConnectView();
    },
    createVncView: function(opts) {
      if (this.VncView == null) {
        this.VncView = require('./vnc-view');
      }
      return new this.VncView(opts);
    }
  };

}).call(this);