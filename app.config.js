const { networkInterfaces } = require("node:os");

const baseConfig = require("./app.json");

const DEV_LOCAL_NETWORK_DESCRIPTION =
  "Allow TalkPilot to access local development servers on your network.";

function isPrivateIPv4(address) {
  return (
    /^10\./.test(address) ||
    /^192\.168\./.test(address) ||
    /^172\.(1[6-9]|2\d|3[0-1])\./.test(address) ||
    /^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./.test(address)
  );
}

function getDevAtsExceptionDomains() {
  const localIPv4s = Object.values(networkInterfaces())
    .flatMap((items) => items ?? [])
    .filter(
      (item) =>
        item.family === "IPv4" && !item.internal && isPrivateIPv4(item.address),
    )
    .map((item) => item.address);

  const envIPv4s = (
    process.env.TALKPILOT_IOS_ATS_IPS ??
    process.env.TALKPILOT_DEV_IPS ??
    ""
  )
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);

  return [...new Set([...localIPv4s, ...envIPv4s])]
    .sort()
    .reduce((domains, ip) => {
      domains[ip] = {
        NSIncludesSubdomains: true,
        NSExceptionAllowsInsecureHTTPLoads: true,
      };
      return domains;
    }, {});
}

module.exports = () => {
  const config = JSON.parse(JSON.stringify(baseConfig));
  const appEnv = process.env.APP_ENV ?? "development";
  const appVersion = config.expo.version;
  const infoPlist = (config.expo.ios.infoPlist ??= {});

  // Bare workflow does not support runtimeVersion policies, so emit a string.
  config.expo.runtimeVersion = appVersion;

  if (appEnv === "development") {
    const exceptionDomains = getDevAtsExceptionDomains();
    if (Object.keys(exceptionDomains).length > 0) {
      infoPlist.NSLocalNetworkUsageDescription = DEV_LOCAL_NETWORK_DESCRIPTION;
      infoPlist.NSAppTransportSecurity = {
        NSAllowsLocalNetworking: true,
        NSExceptionDomains: exceptionDomains,
      };
    }
  }

  return config;
};
