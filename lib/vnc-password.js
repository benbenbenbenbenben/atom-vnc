class VncPassword {
  constructor(options) {
    console.log("constructed", options)
    options.callback(null, "password")
  }

}

module.exports = VncPassword
