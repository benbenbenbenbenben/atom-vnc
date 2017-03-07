
  var VncPassword, keyMap, rfb, toRfbKeycode, url,
    extend = function(child, parent) { for (var key in parent) { if (hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; },
    hasProp = {}.hasOwnProperty;

  const {clipboard} = require('electron').remote;
  const {BrowserWindow} = require('electron').remote;

  HTMLElement.prototype.attr = function(name, value) {
    this.setAttribute(name, value);
    return this;
  };

  url = require('url');

  VncPassword = null;

  rfb = null;

  keyMap = null;

  toRfbKeycode = function(code, shift) {
    var j, key, len;
    if (keyMap == null) {
      keyMap = require('./keycodes.js');
    }
    for (j = 0, len = keyMap.length; j < len; j++) {
      key = keyMap[j];
      if (code === key[0]) {
        return key[shift ? 2 : 1];
      }
    }
    return null;
  };

  class VncView {
    constructor() {
      //super();
    }

    get drawable() {
      return document.body.querySelector('[outlet=drawable]');
    }

    get offScreenCanvas() {
      return document.body.querySelector('[outlet=offScreenCanvas]');
    }

    initialize(params = {uri:"http://127.0.0.1:5900"}) {
      var checkClipboard, connectionParams, lastClipboard, view;
      if (rfb == null) {
        rfb = require('rfb2');
      }
      connectionParams = url.parse(params.uri);
      if (connectionParams.hostname === '') {
        connectionParams.hostname = '127.0.0.1';
      }
      this.connection = rfb.createConnection({
        host: connectionParams.hostname,
        port: connectionParams.port,
        encodings: [rfb.encodings.raw, rfb.encodings.copyRect, rfb.encodings.pseudoDesktopSize]
      });
      this.connection.autoUpdate = true;
      this.buttonStateBitset = 0;
      this.connection.on('connect', (function(_this) {
          return function() {
            _this.connected = true;
            _this.title = _this.connection.title;
            //_this.trigger('title-changed');
            _this.offScreenCanvas.attr("width", _this.connection.width).attr("height", _this.connection.height);
            _this.drawable.attr("width", _this.connection.width).attr("height", _this.connection.height);
            _this.resized.bind(_this)()
          };
        })(this)
      );

      // events
      this.drawable.addEventListener("mousemove", (e, l) => this.mouseMove.bind(this)(e, this.drawable))
      this.drawable.addEventListener("mouseup", (e, l) => this.mouseUp.bind(this)(e, this.drawable))
      this.drawable.addEventListener("mousedown", (e, l) => this.mouseDown.bind(this)(e, this.drawable))
      this.drawable.addEventListener("mousewheel", (e, l) => this.mouseWheel.bind(this)(e, this.drawable))
      this.drawable.addEventListener("keyup", (e, l) => this.keyUp.bind(this)(e, this.drawable))
      this.drawable.addEventListener("keydown", (e, l) => this.keyDown.bind(this)(e, this.drawable))
      this.drawable.addEventListener("keypress", (e, l) => this.disableEvent.bind(this)(e, this.drawable))
      this.drawable.addEventListener("contextmenu", (e, l) => this.disableEvent.bind(this)(e, this.drawable))

      window.addEventListener("resize", this.resized.bind(this))

      // TODO: re-enable security (disabled because of atom imports)
      /*this.connection.params.credentialsCallback = (function(_this) {
        return function(cb) {
          var dialog, done, securityType;
          done = function(err, password) {
            if (!err) {
              return cb(password);
            }
            return this.connection.end();
          };
          securityType = _this.connection.securityType;
          console.log(securityType);

          if (securityType === rfb.security.VNC) {
            if (VncPassword == null) {
              VncPassword = require('./vnc-password');
            }
            return dialog = new VncPassword({
              host: _this.connection.params.host,
              port: _this.connection.params.port,
              callback: done
            });
          } else {
            return console.log("Unknown RFB security type: " + securityType);
          }
        };
      })(this);*/
      this.connection.on('rect', (function(_this) {
        return function(rect) {
          return _this.updateRectangle(rect);
        };
      })(this));
      this.connection.on('resize', (function(_this) {
        return function(size) {
          _this.offScreenCanvas.attr("width", size.width).attr("height", size.height);
          _this.drawable.attr("width", size.width).attr("height", size.height);
        };
      })(this));
      this.connection.on('clipboard', function(text) {
        return clipboard.write(text);
      });
      view = this;
      lastClipboard = clipboard.readText();
      checkClipboard = function() {
        var currentClipboard;
        currentClipboard = clipboard.readText();
        if (lastClipboard === currentClipboard) {
          return;
        }
        lastClipboard = currentClipboard;
        return view.connection.updateClipboard(currentClipboard);
      };
      this.clipboardWatcher = setInterval(checkClipboard, 50);

      return this.ctx = this.drawable.getContext('2d');
    }

    updateRectangle(rect) {
      var b, canvasRectangle, g, i, j, r, ref, word;
      if (rect.encoding === rfb.encodings.raw) {
        canvasRectangle = this.ctx.createImageData(rect.width, rect.height);
        for (i = j = 0, ref = rect.buffer.length - 4; j <= ref; i = j += 4) {
          word = rect.buffer.readUInt32LE(i);
          r = (word & (this.connection.redMax << this.connection.redShift)) >> this.connection.redShift;
          g = (word & (this.connection.greenMax << this.connection.greenShift)) >> this.connection.greenShift;
          b = (word & (this.connection.blueMax << this.connection.blueShift)) >> this.connection.blueShift;
          canvasRectangle.data[i + 0] = r;
          canvasRectangle.data[i + 1] = g;
          canvasRectangle.data[i + 2] = b;
          canvasRectangle.data[i + 3] = 255;
        }
        this.offScreenCanvas.getContext("2d").putImageData(canvasRectangle, rect.x, rect.y);
        this.ctx.drawImage(this.offScreenCanvas, 0, 0);
      } else if (rect.encoding === rfb.encodings.copyRect) {
        this.ctx.drawImage(this.offScreenCanvas, rect.src.x, rect.src.y, rect.width, rect.height, rect.x, rect.y, rect.width, rect.height);
        this.offScreenCanvas.getContext("2d").drawImage(this.offScreenCanvas, rect.src.x, rect.src.y, rect.width, rect.height, rect.x, rect.y, rect.width, rect.height);
      } else {
        console.log("Unsupported rectangle encoding: " + rect.encoding);
      }
    }

    mouseMove(event, element) {
      if (!this.connected) {
        return;
      }
      return this.connection.pointerEvent(event.offsetX, event.offsetY, this.buttonStateBitset);
    }

    mouseUp(event, element) {
      this.buttonStateBitset &= ~(1 << (event.which - 1));
      return this.connection.pointerEvent(event.offsetX, event.offsetY, this.buttonStateBitset);
    }

    mouseDown(event, element) {
      this.buttonStateBitset |= 1 << (event.which - 1);
      return this.connection.pointerEvent(event.offsetX, event.offsetY, this.buttonStateBitset);
    }

    mouseWheel(event, element) {
      var delta;
      delta = event.wheelDelta;
      if (delta > 0) {
        this.connection.pointerEvent(event.offsetX, event.offsetY, this.buttonStateBitset | 1 << 3);
      } else {
        this.connection.pointerEvent(event.offsetX, event.offsetY, this.buttonStateBitset | 1 << 4);
      }
      this.connection.pointerEvent(event.offsetX, event.offsetY, this.buttonStateBitset);
    }

    keyUp(event, element) {
      console.log("keyup")
      var keyCode;
      keyCode = toRfbKeycode(event.keyCode, event.shiftKey);
      return this.connection.keyEvent(keyCode, 0);
    }

    keyDown(event, element) {
      console.log("keydown")
      var keyCode;
      keyCode = toRfbKeycode(event.keyCode, event.shiftKey);
      return this.connection.keyEvent(keyCode, 1);
    }

    disableEvent() {
      return false;
    }

    content() {

      return `<div class='vnc pane-item'>
      <canvas outlet='drawable' tabindex='1'>
        <canvas id='offscreen' outlet='offScreenCanvas'></canvas>
      </canvas>
      </div>`;

      return this.div({
        "class": 'vnc pane-item'
      }, (function(_this) {
        return function() {
          _this.canvas({
            width: 80,
            height: 80,
            tabindex: '1',
            outlet: 'drawable',
            mousemove: 'mouseMove',
            mousedown: 'mouseDown',
            mouseup: 'mouseUp',
            mousewheel: 'mouseWheel',
            keyup: 'keyUp',
            keydown: 'keyDown',
            keypress: 'disableEvent',
            contextmenu: 'disableEvent'
          });
          return _this.canvas({
            id: 'offscreen',
            outlet: 'offScreenCanvas'
          });
        };
      })(this));
    }

    destroy() {
      this.connection.end();
      clearInterval(this.clipboardWatcher);
      return this.detach();
    }

    getTitle() {
      return this.title;
    }

    getIconName() {
      return 'telescope';
    }

    get scale() {
      var transform = this.drawable.style.transform
      if (transform && transform.length) {
        return parseFloat(/scale\((\d+\.?\d*)/.exec(transform)[1])
      }
      return 1.0
    }
    set scale(value) {
      //this.drawable.style.transformOrigin = `${(this.connection.width / 2) * value} ${(this.connection.height / 2) * value}`
      //this.drawable.style.transform = `scale(${value})`


       // 2d vectors to store various sizes
       var browser = [window.innerWidth, window.innerHeight];
       // Minimum scale to fit whole canvas
       var scale = value;
       // Scaled content size
       var size = [this.connection.width, this.connection.height];
       // Offset from top/left
       //var offset = [browser[0] - size[0], browser[1] - size[1]];
       var offset = this.offset = [(browser[0] - size[0]) / 2, (browser[1] - size[1]) / 2];

       // Apply CSS transform
       var rule = `translate(${offset[0]}px, ${offset[1]}px) scale(${scale})`;
       //var rule = `scale(${scale})`;
       this.drawable.style.transform = rule;
    }

    resized(event) {
      var availWidth = document.body.clientWidth
      var availHeight = document.body.clientHeight
      var desiredWidth = this.connection.width
      var desiredHeight = this.connection.height
      var wF = availWidth / desiredWidth
      var hF = availHeight / desiredHeight
      this.scale = Math.min(wF, hF)
    }

    captureCanvas(canvas, callback) {
      canvas.toBlob(function(blob) {
        let reader = new FileReader()
        reader.onloadend = function(res) {
          let arr = new Uint8Array(reader.result)
          callback(arr)
        }
        reader.readAsArrayBuffer(blob)
      }, 'image/png')
    }

    captureFrame(callback) {
      this.captureCanvas(this.drawable, callback)
    }

    captureFrameRegion(x, y, width, height, callback) {
      let buffer = document.createElement('canvas')
      buffer.width = width
      buffer.height = height
      buffer.getContext('2d').drawImage(this.drawable, x, y, width, height, 0, 0, width, height)
      this.captureCanvas(buffer, function(data) {
        callback(data)
        buffer = null
      })
    }
}

module.exports = VncView;
