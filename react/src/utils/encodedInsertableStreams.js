export default (() => {
  // Force encodedInsertableStreams for Chrome
  if (
    typeof RTCPeerConnection !== "undefined" &&
    navigator.userAgent.indexOf("Chrome") > -1
  ) {
    const OriginalRTCPeerConnection = RTCPeerConnection;
    window.RTCPeerConnection = new Proxy(RTCPeerConnection, {
      construct(target, args) {
        console.log("construct called with:", args);
        if (args.length > 0) {
          args[0]["encodedInsertableStreams"] = true;
        } else {
          args.push({ encodedInsertableStreams: true });
        }
        return new OriginalRTCPeerConnection(...args);
      },
    });

    // @add: add encodedInsertableStreams when use setConfiguration
    const originalSetConfiguration =
      RTCPeerConnection.prototype.setConfiguration;

    window.RTCPeerConnection.prototype.setConfiguration = function (
      configuration
    ) {
      if (configuration) {
        configuration.encodedInsertableStreams = true;
        console.log("setConfiguration called with:", configuration);
      }
      return originalSetConfiguration.call(this, configuration);
    };
  }
})();


