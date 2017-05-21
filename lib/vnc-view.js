
  var VncPassword, keyMap, rfb, toRfbKeycode, url,
    extend = function(child, parent) { for (var key in parent) { if (hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; },
    hasProp = {}.hasOwnProperty;

  const {clipboard} = require('electron').remote;
  const {BrowserWindow} = require('electron').remote;
  const Konva = require('konva')

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
      this._capturedEventsLog = []
    }

    get capturedEventsLog() {
      return this._capturedEventsLog
    }

    get captureEvents() {
      return this._captureEvents == true;
    }
    set captureEvents(value) {
      if (value && !this.captureEvents){
        this._capturedEventsLog = []
      }
      this._captureEvents = value;
    }

    get drawable() {
      return document.body.querySelector('[outlet=drawable]');
    }

    get decorations() {
      return document.body.querySelector('#decorations');
    }

    get konvacontainer() {
      return document.body.querySelector('#konvacontainer');
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
            // TODO: update height too
            _this.offScreenCanvas.attr("width", _this.connection.width).attr("height", _this.connection.height);
            _this.drawable.attr("width", _this.connection.width).attr("height", _this.connection.height);
            _this.decorations.attr("width", _this.connection.width).attr("height", _this.connection.height);
            _this.resized.bind(_this)()
          };
        })(this)
      );
      this.connection.on('error', (function(error) {
        debugger;

      }).bind(this));

      let recordingEventListener = (h) => {
        return (e) => {
          // TODO: configure event type capturing
          let willCapture = this.captureEvents && e.type != "mousemove"

          if (willCapture)
          {
            // TODO: capture frame grab
            this.captureFrame((data) => {
              // TODO: serialize relevant event data
              let newEvent = {
                timestamp: Date.now(),
                offsetX: e.offsetX,
                offsetY: e.offsetY,
                buttonStateBitset: e.buttonStateBitset,
                which: e.which,
                wheelDelta: e.wheelDelta,
                keyCode: e.keyCode,
                shiftKey: e.shiftKey,
                type: e.type,
                frame: data
              }
              // TODO: send data to main (async)
              this.capturedEventsLog.push(newEvent)
              h.bind(this)(e, this.drawable)
            })
          } else {
            h.bind(this)(e, this.drawable)
          }
        }
      }

      // events
      this.drawable.addEventListener("mousemove",     recordingEventListener(this.mouseMove))
      this.drawable.addEventListener("mouseup",       recordingEventListener(this.mouseUp))
      this.drawable.addEventListener("mousedown",     recordingEventListener(this.mouseDown))
      this.drawable.addEventListener("mousewheel",    recordingEventListener(this.mouseWheel))
      this.drawable.addEventListener("keyup",         recordingEventListener(this.keyUp))
      this.drawable.addEventListener("keydown",       recordingEventListener(this.keyDown))
      this.drawable.addEventListener("keypress",      (e, l) => this.disableEvent.bind(this)(e, this.drawable))
      this.drawable.addEventListener("contextmenu",   (e, l) => this.disableEvent.bind(this)(e, this.drawable))

      window.addEventListener("resize", this.resized.bind(this))

      // TODO: re-enable security (disabled because of atom imports)
      this.connection.params.credentialsCallback = (function(_this) {
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
      })(this);

      this.connection.on('rect', (function(_this) {
        return function(rect) {
          return _this.updateRectangle(rect);
        };
      })(this));

      this.connection.on('resize', (function(_this) {
        return function(size) {
          // TODO: update height too
          _this.offScreenCanvas.attr("width", size.width).attr("height", size.height);
          _this.drawable.attr("width", size.width).attr("height", size.height);
          _this.decorations.attr("width", size.width).attr("height", size.height);
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
      this.clipboardWatcher = setInterval(checkClipboard, 500);

      return this.ctx = this.drawable.getContext('2d');
    }

    updateRectangle(rect) {
      var b, canvasRectangle, g, i, j, r, ref, word;
      if (rect.encoding === rfb.encodings.raw) {
        canvasRectangle = this.ctx.createImageData(rect.width, rect.height);
        var data = canvasRectangle.data;
        var buffer = data.buffer;
        var canvasRect32 = new Uint32Array(buffer);

        var width = this.connection.bpp >> 3;
        var read  = width == 4 ? rect.buffer.readUInt32BE
                  : width == 2 ? rect.buffer.readUInt16LE
                  : rect.buffer.readUInt8;
        var read = read.bind(rect.buffer);

        if (width == 4) {
          //canvasRectangle = new ImageData(new Uint8ClampedArray(rect.buffer), rect.width, rect.height)
          for (i = j = 0; i < rect.buffer.length; i += width) {
            canvasRect32[j] = (read(i) >> 8) | 0xff000000;
            j++;
          }
        }

        if (width == 2) {
          for (i = j = 0, ref = rect.buffer.length - width; i <= ref; i += width) {
            word = read(i);
            r = (word >> this.connection.redShift) & this.connection.redMax;
            g = (word >> this.connection.greenShift) & this.connection.greenMax;
            b = (word >> this.connection.blueShift) & this.connection.blueMax;
            canvasRect32[j] = (r << 3) | (g << 10) | (b << 19) | (0xFF << 24);
            j += 1;
          }
        }
        this.offScreenCanvas.getContext("2d").putImageData(canvasRectangle, rect.x, rect.y);
        this.ctx.drawImage(this.offScreenCanvas, 0, 0);
        //this.ctx.putImageData(canvasRectangle, rect.x, rect.y);
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

    toRfbKeycode(code, shift) {
      var j, key, len;
      if (this.keyMap == null) {
        this.keyMap = require('./keycodes.js');
      }
      for (j = 0, len = this.keyMap.length; j < len; j++) {
        key = this.keyMap[j];
        if (code === key[0]) {
          return key[shift ? 2 : 1];
        }
      }
      return null;
    };

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

      return `<div id="vncdiv" class='vnc pane-item'>
      <canvas outlet='drawable' tabindex='1'>
        <canvas id='offscreen' outlet='offScreenCanvas'>
        </canvas>
      </canvas>

      <div id="konvacontainer" style="pointer-events:all;position:absolute;top:0px;left:0px;"></div>

      <canvas style='pointer-events:none;position:absolute;top:0px;left:0px;' tabindex='2' id='decorations'>
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

    clearDecorations() {
      // TODO: remove actions
      if (this.konvastage) {
        this.konvastage.clear()
      }
    }

    addDecoration(data) {
      if (this.konvastage == null) {
        this.konvastage = new Konva.Stage({
          container: 'konvacontainer',
          width: this.connection.width,
          height: this.connection.height
        })
      }
      let layer = new Konva.Layer()
      let circle = new Konva.Rect({
        x: data.x,
        y: data.y,
        width: data.width,
        height: data.height,
        fill: 'white',
        stroke: 'red',
        opacity: 0.3,
        strokeWidth: 2
      })
      let label = new Konva.Text({
        x: data.x,
        y: data.y + data.height,
        text: `c:${data.tag.confidence}`,
        fontSize: 30
      })
      let labelBg = new Konva.Rect({
        x: data.x,
        y: data.y + data.height,
        width: label.getWidth(),
        height: label.getHeight(),
        fill: 'white'
      })
      circle.on('mouseout', function(){
        console.log("mouse out of konva element!!")
      })
      layer.add(circle)
      layer.add(labelBg)
      layer.add(label)
      this.konvastage.add(layer)
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
       this.drawable.style.transform = rule
       this.decorations.style.transform = rule
       this.konvacontainer.style.transform = rule
    }

    disableScaling() {
      this.drawable.style.transform = ""
      this.scaling = false
    }

    enableScaling() {
      this.scaling = true
      this.resized(null)
    }

    resized(event) {
      if (this.scaling === false)
        return
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

    captureFrameRawSync() {
      return this.drawable.getContext("2d").getImageData(0,0,this.connection.width,this.connection.height)
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
