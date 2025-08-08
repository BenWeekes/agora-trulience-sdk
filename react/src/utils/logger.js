const LOG_LEVELS = {
  debug: 1,
  log: 2,
  info: 3,
  warn: 4,
  error: 5,
};


let currentLogLevel = "warn"; // default fallback

const urlParams = new URLSearchParams(window.location.search);
const levelFromURL = urlParams.get("loglevel");

if (levelFromURL) {
  currentLogLevel = levelFromURL;
}

const noop = () => {};

const Logger = {
  debug: noop,
  log: noop,
  info: noop,
  warn: noop,
  error: noop,
};

setLogLevel(currentLogLevel)


export function setLogLevel(level) {
  const levelValue = LOG_LEVELS[level];

  if (levelValue === undefined) {
    console.warn(`[Logger]: Unknown log level "${level}"`);
    return;
  }

  currentLogLevel = levelValue;
  console.info(`[Logger]: Log level set to "${level}"`);

  Logger.debug = levelValue <= LOG_LEVELS.debug ? console.debug: noop;
  Logger.log   = levelValue <= LOG_LEVELS.log   ? console.log     : noop;
  Logger.info  = levelValue <= LOG_LEVELS.info  ? console.info   : noop;
  Logger.warn  = levelValue <= LOG_LEVELS.warn  ? console.warn  : noop;
  Logger.error = levelValue <= LOG_LEVELS.error ? console.error : noop;
}

export default Logger;