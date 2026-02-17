var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __commonJS = (cb, mod) => function __require() {
  return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// node_modules/sdp/sdp.js
var require_sdp = __commonJS({
  "node_modules/sdp/sdp.js"(exports, module) {
    "use strict";
    var SDPUtils2 = {};
    SDPUtils2.generateIdentifier = function() {
      return Math.random().toString(36).substring(2, 12);
    };
    SDPUtils2.localCName = SDPUtils2.generateIdentifier();
    SDPUtils2.splitLines = function(blob) {
      return blob.trim().split("\n").map((line) => line.trim());
    };
    SDPUtils2.splitSections = function(blob) {
      const parts = blob.split("\nm=");
      return parts.map((part, index) => (index > 0 ? "m=" + part : part).trim() + "\r\n");
    };
    SDPUtils2.getDescription = function(blob) {
      const sections = SDPUtils2.splitSections(blob);
      return sections && sections[0];
    };
    SDPUtils2.getMediaSections = function(blob) {
      const sections = SDPUtils2.splitSections(blob);
      sections.shift();
      return sections;
    };
    SDPUtils2.matchPrefix = function(blob, prefix) {
      return SDPUtils2.splitLines(blob).filter((line) => line.indexOf(prefix) === 0);
    };
    SDPUtils2.parseCandidate = function(line) {
      let parts;
      if (line.indexOf("a=candidate:") === 0) {
        parts = line.substring(12).split(" ");
      } else {
        parts = line.substring(10).split(" ");
      }
      const candidate = {
        foundation: parts[0],
        component: { 1: "rtp", 2: "rtcp" }[parts[1]] || parts[1],
        protocol: parts[2].toLowerCase(),
        priority: parseInt(parts[3], 10),
        ip: parts[4],
        address: parts[4],
        // address is an alias for ip.
        port: parseInt(parts[5], 10),
        // skip parts[6] == 'typ'
        type: parts[7]
      };
      for (let i = 8; i < parts.length; i += 2) {
        switch (parts[i]) {
          case "raddr":
            candidate.relatedAddress = parts[i + 1];
            break;
          case "rport":
            candidate.relatedPort = parseInt(parts[i + 1], 10);
            break;
          case "tcptype":
            candidate.tcpType = parts[i + 1];
            break;
          case "ufrag":
            candidate.ufrag = parts[i + 1];
            candidate.usernameFragment = parts[i + 1];
            break;
          default:
            if (candidate[parts[i]] === void 0) {
              candidate[parts[i]] = parts[i + 1];
            }
            break;
        }
      }
      return candidate;
    };
    SDPUtils2.writeCandidate = function(candidate) {
      const sdp2 = [];
      sdp2.push(candidate.foundation);
      const component = candidate.component;
      if (component === "rtp") {
        sdp2.push(1);
      } else if (component === "rtcp") {
        sdp2.push(2);
      } else {
        sdp2.push(component);
      }
      sdp2.push(candidate.protocol.toUpperCase());
      sdp2.push(candidate.priority);
      sdp2.push(candidate.address || candidate.ip);
      sdp2.push(candidate.port);
      const type = candidate.type;
      sdp2.push("typ");
      sdp2.push(type);
      if (type !== "host" && candidate.relatedAddress && candidate.relatedPort) {
        sdp2.push("raddr");
        sdp2.push(candidate.relatedAddress);
        sdp2.push("rport");
        sdp2.push(candidate.relatedPort);
      }
      if (candidate.tcpType && candidate.protocol.toLowerCase() === "tcp") {
        sdp2.push("tcptype");
        sdp2.push(candidate.tcpType);
      }
      if (candidate.usernameFragment || candidate.ufrag) {
        sdp2.push("ufrag");
        sdp2.push(candidate.usernameFragment || candidate.ufrag);
      }
      return "candidate:" + sdp2.join(" ");
    };
    SDPUtils2.parseIceOptions = function(line) {
      return line.substring(14).split(" ");
    };
    SDPUtils2.parseRtpMap = function(line) {
      let parts = line.substring(9).split(" ");
      const parsed = {
        payloadType: parseInt(parts.shift(), 10)
        // was: id
      };
      parts = parts[0].split("/");
      parsed.name = parts[0];
      parsed.clockRate = parseInt(parts[1], 10);
      parsed.channels = parts.length === 3 ? parseInt(parts[2], 10) : 1;
      parsed.numChannels = parsed.channels;
      return parsed;
    };
    SDPUtils2.writeRtpMap = function(codec) {
      let pt = codec.payloadType;
      if (codec.preferredPayloadType !== void 0) {
        pt = codec.preferredPayloadType;
      }
      const channels = codec.channels || codec.numChannels || 1;
      return "a=rtpmap:" + pt + " " + codec.name + "/" + codec.clockRate + (channels !== 1 ? "/" + channels : "") + "\r\n";
    };
    SDPUtils2.parseExtmap = function(line) {
      const parts = line.substring(9).split(" ");
      return {
        id: parseInt(parts[0], 10),
        direction: parts[0].indexOf("/") > 0 ? parts[0].split("/")[1] : "sendrecv",
        uri: parts[1],
        attributes: parts.slice(2).join(" ")
      };
    };
    SDPUtils2.writeExtmap = function(headerExtension) {
      return "a=extmap:" + (headerExtension.id || headerExtension.preferredId) + (headerExtension.direction && headerExtension.direction !== "sendrecv" ? "/" + headerExtension.direction : "") + " " + headerExtension.uri + (headerExtension.attributes ? " " + headerExtension.attributes : "") + "\r\n";
    };
    SDPUtils2.parseFmtp = function(line) {
      const parsed = {};
      let kv;
      const parts = line.substring(line.indexOf(" ") + 1).split(";");
      for (let j = 0; j < parts.length; j++) {
        kv = parts[j].trim().split("=");
        parsed[kv[0].trim()] = kv[1];
      }
      return parsed;
    };
    SDPUtils2.writeFmtp = function(codec) {
      let line = "";
      let pt = codec.payloadType;
      if (codec.preferredPayloadType !== void 0) {
        pt = codec.preferredPayloadType;
      }
      if (codec.parameters && Object.keys(codec.parameters).length) {
        const params = [];
        Object.keys(codec.parameters).forEach((param) => {
          if (codec.parameters[param] !== void 0) {
            params.push(param + "=" + codec.parameters[param]);
          } else {
            params.push(param);
          }
        });
        line += "a=fmtp:" + pt + " " + params.join(";") + "\r\n";
      }
      return line;
    };
    SDPUtils2.parseRtcpFb = function(line) {
      const parts = line.substring(line.indexOf(" ") + 1).split(" ");
      return {
        type: parts.shift(),
        parameter: parts.join(" ")
      };
    };
    SDPUtils2.writeRtcpFb = function(codec) {
      let lines = "";
      let pt = codec.payloadType;
      if (codec.preferredPayloadType !== void 0) {
        pt = codec.preferredPayloadType;
      }
      if (codec.rtcpFeedback && codec.rtcpFeedback.length) {
        codec.rtcpFeedback.forEach((fb) => {
          lines += "a=rtcp-fb:" + pt + " " + fb.type + (fb.parameter && fb.parameter.length ? " " + fb.parameter : "") + "\r\n";
        });
      }
      return lines;
    };
    SDPUtils2.parseSsrcMedia = function(line) {
      const sp = line.indexOf(" ");
      const parts = {
        ssrc: parseInt(line.substring(7, sp), 10)
      };
      const colon = line.indexOf(":", sp);
      if (colon > -1) {
        parts.attribute = line.substring(sp + 1, colon);
        parts.value = line.substring(colon + 1);
      } else {
        parts.attribute = line.substring(sp + 1);
      }
      return parts;
    };
    SDPUtils2.parseSsrcGroup = function(line) {
      const parts = line.substring(13).split(" ");
      return {
        semantics: parts.shift(),
        ssrcs: parts.map((ssrc) => parseInt(ssrc, 10))
      };
    };
    SDPUtils2.getMid = function(mediaSection) {
      const mid = SDPUtils2.matchPrefix(mediaSection, "a=mid:")[0];
      if (mid) {
        return mid.substring(6);
      }
    };
    SDPUtils2.parseFingerprint = function(line) {
      const parts = line.substring(14).split(" ");
      return {
        algorithm: parts[0].toLowerCase(),
        // algorithm is case-sensitive in Edge.
        value: parts[1].toUpperCase()
        // the definition is upper-case in RFC 4572.
      };
    };
    SDPUtils2.getDtlsParameters = function(mediaSection, sessionpart) {
      const lines = SDPUtils2.matchPrefix(
        mediaSection + sessionpart,
        "a=fingerprint:"
      );
      return {
        role: "auto",
        fingerprints: lines.map(SDPUtils2.parseFingerprint)
      };
    };
    SDPUtils2.writeDtlsParameters = function(params, setupType) {
      let sdp2 = "a=setup:" + setupType + "\r\n";
      params.fingerprints.forEach((fp) => {
        sdp2 += "a=fingerprint:" + fp.algorithm + " " + fp.value + "\r\n";
      });
      return sdp2;
    };
    SDPUtils2.parseCryptoLine = function(line) {
      const parts = line.substring(9).split(" ");
      return {
        tag: parseInt(parts[0], 10),
        cryptoSuite: parts[1],
        keyParams: parts[2],
        sessionParams: parts.slice(3)
      };
    };
    SDPUtils2.writeCryptoLine = function(parameters) {
      return "a=crypto:" + parameters.tag + " " + parameters.cryptoSuite + " " + (typeof parameters.keyParams === "object" ? SDPUtils2.writeCryptoKeyParams(parameters.keyParams) : parameters.keyParams) + (parameters.sessionParams ? " " + parameters.sessionParams.join(" ") : "") + "\r\n";
    };
    SDPUtils2.parseCryptoKeyParams = function(keyParams) {
      if (keyParams.indexOf("inline:") !== 0) {
        return null;
      }
      const parts = keyParams.substring(7).split("|");
      return {
        keyMethod: "inline",
        keySalt: parts[0],
        lifeTime: parts[1],
        mkiValue: parts[2] ? parts[2].split(":")[0] : void 0,
        mkiLength: parts[2] ? parts[2].split(":")[1] : void 0
      };
    };
    SDPUtils2.writeCryptoKeyParams = function(keyParams) {
      return keyParams.keyMethod + ":" + keyParams.keySalt + (keyParams.lifeTime ? "|" + keyParams.lifeTime : "") + (keyParams.mkiValue && keyParams.mkiLength ? "|" + keyParams.mkiValue + ":" + keyParams.mkiLength : "");
    };
    SDPUtils2.getCryptoParameters = function(mediaSection, sessionpart) {
      const lines = SDPUtils2.matchPrefix(
        mediaSection + sessionpart,
        "a=crypto:"
      );
      return lines.map(SDPUtils2.parseCryptoLine);
    };
    SDPUtils2.getIceParameters = function(mediaSection, sessionpart) {
      const ufrag = SDPUtils2.matchPrefix(
        mediaSection + sessionpart,
        "a=ice-ufrag:"
      )[0];
      const pwd = SDPUtils2.matchPrefix(
        mediaSection + sessionpart,
        "a=ice-pwd:"
      )[0];
      if (!(ufrag && pwd)) {
        return null;
      }
      return {
        usernameFragment: ufrag.substring(12),
        password: pwd.substring(10)
      };
    };
    SDPUtils2.writeIceParameters = function(params) {
      let sdp2 = "a=ice-ufrag:" + params.usernameFragment + "\r\na=ice-pwd:" + params.password + "\r\n";
      if (params.iceLite) {
        sdp2 += "a=ice-lite\r\n";
      }
      return sdp2;
    };
    SDPUtils2.parseRtpParameters = function(mediaSection) {
      const description = {
        codecs: [],
        headerExtensions: [],
        fecMechanisms: [],
        rtcp: []
      };
      const lines = SDPUtils2.splitLines(mediaSection);
      const mline = lines[0].split(" ");
      description.profile = mline[2];
      for (let i = 3; i < mline.length; i++) {
        const pt = mline[i];
        const rtpmapline = SDPUtils2.matchPrefix(
          mediaSection,
          "a=rtpmap:" + pt + " "
        )[0];
        if (rtpmapline) {
          const codec = SDPUtils2.parseRtpMap(rtpmapline);
          const fmtps = SDPUtils2.matchPrefix(
            mediaSection,
            "a=fmtp:" + pt + " "
          );
          codec.parameters = fmtps.length ? SDPUtils2.parseFmtp(fmtps[0]) : {};
          codec.rtcpFeedback = SDPUtils2.matchPrefix(
            mediaSection,
            "a=rtcp-fb:" + pt + " "
          ).map(SDPUtils2.parseRtcpFb);
          description.codecs.push(codec);
          switch (codec.name.toUpperCase()) {
            case "RED":
            case "ULPFEC":
              description.fecMechanisms.push(codec.name.toUpperCase());
              break;
            default:
              break;
          }
        }
      }
      SDPUtils2.matchPrefix(mediaSection, "a=extmap:").forEach((line) => {
        description.headerExtensions.push(SDPUtils2.parseExtmap(line));
      });
      const wildcardRtcpFb = SDPUtils2.matchPrefix(mediaSection, "a=rtcp-fb:* ").map(SDPUtils2.parseRtcpFb);
      description.codecs.forEach((codec) => {
        wildcardRtcpFb.forEach((fb) => {
          const duplicate = codec.rtcpFeedback.find((existingFeedback) => {
            return existingFeedback.type === fb.type && existingFeedback.parameter === fb.parameter;
          });
          if (!duplicate) {
            codec.rtcpFeedback.push(fb);
          }
        });
      });
      return description;
    };
    SDPUtils2.writeRtpDescription = function(kind, caps) {
      let sdp2 = "";
      sdp2 += "m=" + kind + " ";
      sdp2 += caps.codecs.length > 0 ? "9" : "0";
      sdp2 += " " + (caps.profile || "UDP/TLS/RTP/SAVPF") + " ";
      sdp2 += caps.codecs.map((codec) => {
        if (codec.preferredPayloadType !== void 0) {
          return codec.preferredPayloadType;
        }
        return codec.payloadType;
      }).join(" ") + "\r\n";
      sdp2 += "c=IN IP4 0.0.0.0\r\n";
      sdp2 += "a=rtcp:9 IN IP4 0.0.0.0\r\n";
      caps.codecs.forEach((codec) => {
        sdp2 += SDPUtils2.writeRtpMap(codec);
        sdp2 += SDPUtils2.writeFmtp(codec);
        sdp2 += SDPUtils2.writeRtcpFb(codec);
      });
      let maxptime = 0;
      caps.codecs.forEach((codec) => {
        if (codec.maxptime > maxptime) {
          maxptime = codec.maxptime;
        }
      });
      if (maxptime > 0) {
        sdp2 += "a=maxptime:" + maxptime + "\r\n";
      }
      if (caps.headerExtensions) {
        caps.headerExtensions.forEach((extension) => {
          sdp2 += SDPUtils2.writeExtmap(extension);
        });
      }
      return sdp2;
    };
    SDPUtils2.parseRtpEncodingParameters = function(mediaSection) {
      const encodingParameters = [];
      const description = SDPUtils2.parseRtpParameters(mediaSection);
      const hasRed = description.fecMechanisms.indexOf("RED") !== -1;
      const hasUlpfec = description.fecMechanisms.indexOf("ULPFEC") !== -1;
      const ssrcs = SDPUtils2.matchPrefix(mediaSection, "a=ssrc:").map((line) => SDPUtils2.parseSsrcMedia(line)).filter((parts) => parts.attribute === "cname");
      const primarySsrc = ssrcs.length > 0 && ssrcs[0].ssrc;
      let secondarySsrc;
      const flows = SDPUtils2.matchPrefix(mediaSection, "a=ssrc-group:FID").map((line) => {
        const parts = line.substring(17).split(" ");
        return parts.map((part) => parseInt(part, 10));
      });
      if (flows.length > 0 && flows[0].length > 1 && flows[0][0] === primarySsrc) {
        secondarySsrc = flows[0][1];
      }
      description.codecs.forEach((codec) => {
        if (codec.name.toUpperCase() === "RTX" && codec.parameters.apt) {
          let encParam = {
            ssrc: primarySsrc,
            codecPayloadType: parseInt(codec.parameters.apt, 10)
          };
          if (primarySsrc && secondarySsrc) {
            encParam.rtx = { ssrc: secondarySsrc };
          }
          encodingParameters.push(encParam);
          if (hasRed) {
            encParam = JSON.parse(JSON.stringify(encParam));
            encParam.fec = {
              ssrc: primarySsrc,
              mechanism: hasUlpfec ? "red+ulpfec" : "red"
            };
            encodingParameters.push(encParam);
          }
        }
      });
      if (encodingParameters.length === 0 && primarySsrc) {
        encodingParameters.push({
          ssrc: primarySsrc
        });
      }
      let bandwidth = SDPUtils2.matchPrefix(mediaSection, "b=");
      if (bandwidth.length) {
        if (bandwidth[0].indexOf("b=TIAS:") === 0) {
          bandwidth = parseInt(bandwidth[0].substring(7), 10);
        } else if (bandwidth[0].indexOf("b=AS:") === 0) {
          bandwidth = parseInt(bandwidth[0].substring(5), 10) * 1e3 * 0.95 - 50 * 40 * 8;
        } else {
          bandwidth = void 0;
        }
        encodingParameters.forEach((params) => {
          params.maxBitrate = bandwidth;
        });
      }
      return encodingParameters;
    };
    SDPUtils2.parseRtcpParameters = function(mediaSection) {
      const rtcpParameters = {};
      const remoteSsrc = SDPUtils2.matchPrefix(mediaSection, "a=ssrc:").map((line) => SDPUtils2.parseSsrcMedia(line)).filter((obj) => obj.attribute === "cname")[0];
      if (remoteSsrc) {
        rtcpParameters.cname = remoteSsrc.value;
        rtcpParameters.ssrc = remoteSsrc.ssrc;
      }
      const rsize = SDPUtils2.matchPrefix(mediaSection, "a=rtcp-rsize");
      rtcpParameters.reducedSize = rsize.length > 0;
      rtcpParameters.compound = rsize.length === 0;
      const mux = SDPUtils2.matchPrefix(mediaSection, "a=rtcp-mux");
      rtcpParameters.mux = mux.length > 0;
      return rtcpParameters;
    };
    SDPUtils2.writeRtcpParameters = function(rtcpParameters) {
      let sdp2 = "";
      if (rtcpParameters.reducedSize) {
        sdp2 += "a=rtcp-rsize\r\n";
      }
      if (rtcpParameters.mux) {
        sdp2 += "a=rtcp-mux\r\n";
      }
      if (rtcpParameters.ssrc !== void 0 && rtcpParameters.cname) {
        sdp2 += "a=ssrc:" + rtcpParameters.ssrc + " cname:" + rtcpParameters.cname + "\r\n";
      }
      return sdp2;
    };
    SDPUtils2.parseMsid = function(mediaSection) {
      let parts;
      const spec = SDPUtils2.matchPrefix(mediaSection, "a=msid:");
      if (spec.length === 1) {
        parts = spec[0].substring(7).split(" ");
        return { stream: parts[0], track: parts[1] };
      }
      const planB = SDPUtils2.matchPrefix(mediaSection, "a=ssrc:").map((line) => SDPUtils2.parseSsrcMedia(line)).filter((msidParts) => msidParts.attribute === "msid");
      if (planB.length > 0) {
        parts = planB[0].value.split(" ");
        return { stream: parts[0], track: parts[1] };
      }
    };
    SDPUtils2.parseSctpDescription = function(mediaSection) {
      const mline = SDPUtils2.parseMLine(mediaSection);
      const maxSizeLine = SDPUtils2.matchPrefix(mediaSection, "a=max-message-size:");
      let maxMessageSize;
      if (maxSizeLine.length > 0) {
        maxMessageSize = parseInt(maxSizeLine[0].substring(19), 10);
      }
      if (isNaN(maxMessageSize)) {
        maxMessageSize = 65536;
      }
      const sctpPort = SDPUtils2.matchPrefix(mediaSection, "a=sctp-port:");
      if (sctpPort.length > 0) {
        return {
          port: parseInt(sctpPort[0].substring(12), 10),
          protocol: mline.fmt,
          maxMessageSize
        };
      }
      const sctpMapLines = SDPUtils2.matchPrefix(mediaSection, "a=sctpmap:");
      if (sctpMapLines.length > 0) {
        const parts = sctpMapLines[0].substring(10).split(" ");
        return {
          port: parseInt(parts[0], 10),
          protocol: parts[1],
          maxMessageSize
        };
      }
    };
    SDPUtils2.writeSctpDescription = function(media, sctp) {
      let output = [];
      if (media.protocol !== "DTLS/SCTP") {
        output = [
          "m=" + media.kind + " 9 " + media.protocol + " " + sctp.protocol + "\r\n",
          "c=IN IP4 0.0.0.0\r\n",
          "a=sctp-port:" + sctp.port + "\r\n"
        ];
      } else {
        output = [
          "m=" + media.kind + " 9 " + media.protocol + " " + sctp.port + "\r\n",
          "c=IN IP4 0.0.0.0\r\n",
          "a=sctpmap:" + sctp.port + " " + sctp.protocol + " 65535\r\n"
        ];
      }
      if (sctp.maxMessageSize !== void 0) {
        output.push("a=max-message-size:" + sctp.maxMessageSize + "\r\n");
      }
      return output.join("");
    };
    SDPUtils2.generateSessionId = function() {
      return Math.random().toString().substr(2, 22);
    };
    SDPUtils2.writeSessionBoilerplate = function(sessId, sessVer, sessUser) {
      let sessionId;
      const version = sessVer !== void 0 ? sessVer : 2;
      if (sessId) {
        sessionId = sessId;
      } else {
        sessionId = SDPUtils2.generateSessionId();
      }
      const user = sessUser || "thisisadapterortc";
      return "v=0\r\no=" + user + " " + sessionId + " " + version + " IN IP4 127.0.0.1\r\ns=-\r\nt=0 0\r\n";
    };
    SDPUtils2.getDirection = function(mediaSection, sessionpart) {
      const lines = SDPUtils2.splitLines(mediaSection);
      for (let i = 0; i < lines.length; i++) {
        switch (lines[i]) {
          case "a=sendrecv":
          case "a=sendonly":
          case "a=recvonly":
          case "a=inactive":
            return lines[i].substring(2);
          default:
        }
      }
      if (sessionpart) {
        return SDPUtils2.getDirection(sessionpart);
      }
      return "sendrecv";
    };
    SDPUtils2.getKind = function(mediaSection) {
      const lines = SDPUtils2.splitLines(mediaSection);
      const mline = lines[0].split(" ");
      return mline[0].substring(2);
    };
    SDPUtils2.isRejected = function(mediaSection) {
      return mediaSection.split(" ", 2)[1] === "0";
    };
    SDPUtils2.parseMLine = function(mediaSection) {
      const lines = SDPUtils2.splitLines(mediaSection);
      const parts = lines[0].substring(2).split(" ");
      return {
        kind: parts[0],
        port: parseInt(parts[1], 10),
        protocol: parts[2],
        fmt: parts.slice(3).join(" ")
      };
    };
    SDPUtils2.parseOLine = function(mediaSection) {
      const line = SDPUtils2.matchPrefix(mediaSection, "o=")[0];
      const parts = line.substring(2).split(" ");
      return {
        username: parts[0],
        sessionId: parts[1],
        sessionVersion: parseInt(parts[2], 10),
        netType: parts[3],
        addressType: parts[4],
        address: parts[5]
      };
    };
    SDPUtils2.isValidSDP = function(blob) {
      if (typeof blob !== "string" || blob.length === 0) {
        return false;
      }
      const lines = SDPUtils2.splitLines(blob);
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].length < 2 || lines[i].charAt(1) !== "=") {
          return false;
        }
      }
      return true;
    };
    if (typeof module === "object") {
      module.exports = SDPUtils2;
    }
  }
});

// src/protocol.ts
var BOARD_WIDTH = 12;
var BOARD_HEIGHT = 9;
var COL_LABELS = "ABCDEFGHIJKL".split("");
function getSideLabel(side) {
  return side === "blue" ? "\u84DD\u65B9" : "\u7EA2\u65B9";
}
function getPlayerIdBySide(side) {
  return side === "blue" ? "p1" : "p2";
}
function isCoordInBounds(coord) {
  return coord.x >= 0 && coord.x < BOARD_WIDTH && coord.y >= 0 && coord.y < BOARD_HEIGHT;
}
function chebyshevDistance(a, b) {
  return Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
}
function isOrthogonalStep(a, b) {
  const dx = Math.abs(a.x - b.x);
  const dy = Math.abs(a.y - b.y);
  return dx + dy === 1;
}
function coordsEqual(a, b) {
  return a.x === b.x && a.y === b.y;
}
function coordToKey(coord) {
  return `${COL_LABELS[coord.x]}${coord.y + 1}`;
}
function coordToDisplayKey(coord) {
  return `${COL_LABELS[coord.x]}:${coord.y + 1}`;
}
function keyToCoord(key) {
  if (key.length < 2) {
    return null;
  }
  const colRaw = key[0]?.toUpperCase();
  const yRaw = Number(key.slice(1));
  const x = COL_LABELS.indexOf(colRaw);
  const y = yRaw - 1;
  if (x < 0 || Number.isNaN(yRaw)) {
    return null;
  }
  const coord = { x, y };
  return isCoordInBounds(coord) ? coord : null;
}
function oppositeSide(side) {
  return side === "blue" ? "red" : "blue";
}
function isRoleSkillId(skill) {
  return skill === "role1" || skill === "role2" || skill === "role3" || skill === "role4";
}

// src/game.ts
var BLUE_SPAWN = { x: 1, y: 4 };
var RED_SPAWN = { x: 10, y: 4 };
var SKILL_UNLOCK_COST = 100;
var NEEDLE_INTERVAL_MS = 140;
var MAX_ANNOUNCEMENTS = 80;
var RAY_EPSILON = 1e-9;
var INITIAL_WALL_COORDS = [];
for (let y = 3; y <= 8; y += 1) {
  INITIAL_WALL_COORDS.push({ x: 3, y });
  INITIAL_WALL_COORDS.push({ x: 8, y });
}
var INITIAL_WALL_KEYS = new Set(INITIAL_WALL_COORDS.map((item) => coordToKey(item)));
function isInRect(coord, minX, minY, maxX, maxY) {
  return coord.x >= minX && coord.x <= maxX && coord.y >= minY && coord.y <= maxY;
}
function isGrass(coord) {
  return isInRect(coord, 2, 0, 4, 1) || // C1:E2
  isInRect(coord, 7, 0, 9, 1) || // H1:J2
  isInRect(coord, 4, 7, 7, 8);
}
function getBaseTerrain(coord) {
  if (coordsEqual(coord, BLUE_SPAWN)) {
    return "spawnBlue";
  }
  if (coordsEqual(coord, RED_SPAWN)) {
    return "spawnRed";
  }
  if (isGrass(coord)) {
    return "grass";
  }
  return "ground";
}
function createUnit(side, pos, initialSpirit) {
  return {
    id: getPlayerIdBySide(side),
    side,
    pos: { ...pos },
    stats: {
      hp: 10,
      spirit: initialSpirit,
      maxSpirit: 25,
      atk: 1,
      vision: 1,
      moveRange: 1,
      gold: 100
    },
    skills: {
      role1: false,
      role2: false,
      role3: false,
      role4: false
    },
    effects: {
      orbVisionRadius: 0,
      orbTurns: 0
    }
  };
}
function createWalls() {
  const walls = {};
  for (const coord of INITIAL_WALL_COORDS) {
    walls[coordToKey(coord)] = {
      hp: 5,
      maxHp: 5,
      alive: true
    };
  }
  return walls;
}
function cloneUnit(unit) {
  return {
    ...unit,
    pos: { ...unit.pos },
    stats: { ...unit.stats },
    skills: { ...unit.skills },
    effects: { ...unit.effects }
  };
}
function clonePlayers(players) {
  return {
    blue: cloneUnit(players.blue),
    red: cloneUnit(players.red)
  };
}
function cloneWalls(walls) {
  const next = {};
  for (const key of Object.keys(walls)) {
    next[key] = { ...walls[key] };
  }
  return next;
}
function createInitialState() {
  return {
    seq: 0,
    turn: {
      side: "blue",
      round: 1,
      acted: false,
      pendingAnnouncement: null
    },
    players: {
      blue: createUnit("blue", BLUE_SPAWN, 0),
      red: createUnit("red", RED_SPAWN, 1)
    },
    walls: createWalls(),
    announcements: [],
    winner: null
  };
}
function createMoveCommand(actor, to) {
  return {
    type: "move",
    actor,
    to: coordToKey(to)
  };
}
function createBuildCommand(actor, to, spirit) {
  return {
    type: "build",
    actor,
    to: coordToKey(to),
    spirit
  };
}
function createScoutCommand(actor) {
  return {
    type: "scout",
    actor
  };
}
function createAttackCommand(actor, to) {
  return {
    type: "attack",
    actor,
    to: coordToKey(to)
  };
}
function createNeedleCommand(actor, to, spirit) {
  return {
    type: "needle",
    actor,
    to: coordToKey(to),
    spirit
  };
}
function createAmuletCommand(actor, to) {
  return {
    type: "amulet",
    actor,
    to: coordToKey(to),
    spirit: 1
  };
}
function createOrbCommand(actor, spirit) {
  return {
    type: "orb",
    actor,
    spirit
  };
}
function createBlinkCommand(actor, to, spirit) {
  return {
    type: "blink",
    actor,
    to: coordToKey(to),
    spirit
  };
}
function createUnlockSkillCommand(actor, skill) {
  return {
    type: "unlockSkill",
    actor,
    skill
  };
}
function createEndTurnCommand(actor) {
  return {
    type: "endTurn",
    actor
  };
}
function canIssueCommandByTurn(state, actor) {
  return !state.winner && state.turn.side === actor;
}
function canIssueAction(state, actor) {
  return canIssueCommandByTurn(state, actor) && !state.turn.acted;
}
function canEndTurn(state, actor) {
  return canIssueCommandByTurn(state, actor);
}
function containsCoord(list, target) {
  return list.some((item) => coordsEqual(item, target));
}
function isWallAliveAt(state, coord) {
  return Boolean(state.walls[coordToKey(coord)]?.alive);
}
function isWallAliveInMap(walls, coord) {
  return Boolean(walls[coordToKey(coord)]?.alive);
}
function hasAnyUnitAt(state, coord) {
  return isWallAliveAt(state, coord) || coordsEqual(state.players.blue.pos, coord) || coordsEqual(state.players.red.pos, coord);
}
function isAttackTargetAt(state, actor, coord) {
  if (isWallAliveAt(state, coord)) {
    return true;
  }
  const enemy = state.players[oppositeSide(actor)];
  return coordsEqual(enemy.pos, coord);
}
function floorDamage(value) {
  return Math.max(0, Math.floor(value));
}
function getWinnerFromPlayers(state) {
  if (state.players.blue.stats.hp <= 0) {
    return "red";
  }
  if (state.players.red.stats.hp <= 0) {
    return "blue";
  }
  return null;
}
function getVisionRadius(state, side) {
  const unit = state.players[side];
  if (unit.effects.orbTurns > 0) {
    return Math.max(unit.stats.vision, unit.effects.orbVisionRadius);
  }
  return unit.stats.vision;
}
function computeRayMaxT(startX, startY, dirX, dirY) {
  let maxT = Number.POSITIVE_INFINITY;
  if (dirX > 0) {
    maxT = Math.min(maxT, (BOARD_WIDTH - startX) / dirX);
  } else if (dirX < 0) {
    maxT = Math.min(maxT, (0 - startX) / dirX);
  }
  if (dirY > 0) {
    maxT = Math.min(maxT, (BOARD_HEIGHT - startY) / dirY);
  } else if (dirY < 0) {
    maxT = Math.min(maxT, (0 - startY) / dirY);
  }
  return maxT;
}
function intersectRayCell(startX, startY, dirX, dirY, maxT, cellX, cellY) {
  const minX = cellX;
  const maxX = cellX + 1;
  const minY = cellY;
  const maxY = cellY + 1;
  let enterT = 0;
  let exitT = maxT;
  if (Math.abs(dirX) <= RAY_EPSILON) {
    if (startX < minX || startX > maxX) {
      return null;
    }
  } else {
    const tx1 = (minX - startX) / dirX;
    const tx2 = (maxX - startX) / dirX;
    const txEnter = Math.min(tx1, tx2);
    const txExit = Math.max(tx1, tx2);
    enterT = Math.max(enterT, txEnter);
    exitT = Math.min(exitT, txExit);
  }
  if (Math.abs(dirY) <= RAY_EPSILON) {
    if (startY < minY || startY > maxY) {
      return null;
    }
  } else {
    const ty1 = (minY - startY) / dirY;
    const ty2 = (maxY - startY) / dirY;
    const tyEnter = Math.min(ty1, ty2);
    const tyExit = Math.max(ty1, ty2);
    enterT = Math.max(enterT, tyEnter);
    exitT = Math.min(exitT, tyExit);
  }
  if (exitT < enterT - RAY_EPSILON) {
    return null;
  }
  if (exitT <= RAY_EPSILON) {
    return null;
  }
  return {
    enterT: Math.max(0, enterT),
    exitT: Math.max(0, Math.min(maxT, exitT))
  };
}
function buildRayPath(from, to) {
  const startX = from.x + 0.5;
  const startY = from.y + 0.5;
  const targetX = to.x + 0.5;
  const targetY = to.y + 0.5;
  const dirX = targetX - startX;
  const dirY = targetY - startY;
  if (Math.abs(dirX) <= RAY_EPSILON && Math.abs(dirY) <= RAY_EPSILON) {
    return null;
  }
  const maxT = computeRayMaxT(startX, startY, dirX, dirY);
  if (!Number.isFinite(maxT) || maxT <= 0) {
    return null;
  }
  const cells = [];
  for (let y = 0; y < BOARD_HEIGHT; y += 1) {
    for (let x = 0; x < BOARD_WIDTH; x += 1) {
      if (x === from.x && y === from.y) {
        continue;
      }
      const hit = intersectRayCell(startX, startY, dirX, dirY, maxT, x, y);
      if (!hit) {
        continue;
      }
      cells.push({
        coord: { x, y },
        enterT: hit.enterT,
        exitT: hit.exitT
      });
    }
  }
  cells.sort((a, b) => {
    const enterDelta = a.enterT - b.enterT;
    if (Math.abs(enterDelta) > RAY_EPSILON) {
      return enterDelta;
    }
    const exitDelta = a.exitT - b.exitT;
    if (Math.abs(exitDelta) > RAY_EPSILON) {
      return exitDelta;
    }
    if (a.coord.y !== b.coord.y) {
      return a.coord.y - b.coord.y;
    }
    return a.coord.x - b.coord.x;
  });
  return {
    cells,
    startX,
    startY,
    dirX,
    dirY,
    maxT
  };
}
function getRayPoint(path, t) {
  const clampedT = Math.max(0, Math.min(path.maxT, t));
  return {
    x: path.startX + path.dirX * clampedT,
    y: path.startY + path.dirY * clampedT
  };
}
function applyEnemyDamage(players, targetSide, amount, damageAnnouncements) {
  if (amount <= 0) {
    return false;
  }
  const target = players[targetSide];
  if (target.stats.hp <= 0) {
    return false;
  }
  const hpAfter = Math.max(0, target.stats.hp - amount);
  target.stats.hp = hpAfter;
  damageAnnouncements.push(`${getSideLabel(targetSide)}\u53D7\u5230\u4E86${amount}\u70B9\u4F24\u5BB3`);
  return true;
}
function applyWallDamage(players, walls, actor, coord, amount) {
  if (amount <= 0) {
    return false;
  }
  const key = coordToKey(coord);
  const wall = walls[key];
  if (!wall || !wall.alive) {
    return false;
  }
  const hpAfter = wall.hp - amount;
  if (hpAfter <= 0) {
    const reward = 10 * wall.maxHp;
    players[actor].stats.gold += reward;
    walls[key] = {
      ...wall,
      hp: 0,
      alive: false
    };
  } else {
    walls[key] = {
      ...wall,
      hp: hpAfter
    };
  }
  return true;
}
function buildProjectileEffect(kind, actor, origin, path, delayMs, rayEnd) {
  return {
    kind,
    actor,
    origin: coordToKey(origin),
    path: path.map((cell) => coordToKey(cell)),
    delayMs,
    ...rayEnd ? { rayEnd } : {}
  };
}
function appendAnnouncements(base, additions) {
  if (additions.length === 0) {
    if (base.length <= MAX_ANNOUNCEMENTS) {
      return base;
    }
    return base.slice(base.length - MAX_ANNOUNCEMENTS);
  }
  const merged = [...base, ...additions];
  if (merged.length <= MAX_ANNOUNCEMENTS) {
    return merged;
  }
  return merged.slice(merged.length - MAX_ANNOUNCEMENTS);
}
function formatTurnAnnouncement(round, side, text) {
  const playerNo = side === "blue" ? 1 : 2;
  return `[\u56DE\u5408${round}P${playerNo}: ${text}]`;
}
function appendTurnAnnouncements(base, round, side, additions) {
  if (additions.length === 0) {
    return appendAnnouncements(base, []);
  }
  return appendAnnouncements(
    base,
    additions.map((text) => formatTurnAnnouncement(round, side, text))
  );
}
function formatCoordDisplay(coord) {
  return `${COL_LABELS[coord.x]}:${coord.y + 1}`;
}
function getLegalMoveTargets(state, actor) {
  if (!canIssueAction(state, actor)) {
    return [];
  }
  const result = [];
  const self = state.players[actor];
  const enemy = state.players[oppositeSide(actor)];
  for (let dy = -1; dy <= 1; dy += 1) {
    for (let dx = -1; dx <= 1; dx += 1) {
      if (dx === 0 && dy === 0) {
        continue;
      }
      const target = { x: self.pos.x + dx, y: self.pos.y + dy };
      if (!isCoordInBounds(target)) {
        continue;
      }
      if (chebyshevDistance(self.pos, target) > self.stats.moveRange) {
        continue;
      }
      if (isWallAliveAt(state, target)) {
        continue;
      }
      if (coordsEqual(enemy.pos, target)) {
        continue;
      }
      result.push(target);
    }
  }
  return result;
}
function getLegalBuildTargets(state, actor, spiritSpend) {
  if (!canIssueAction(state, actor)) {
    return [];
  }
  if (!Number.isInteger(spiritSpend) || spiritSpend <= 0) {
    return [];
  }
  if (state.players[actor].stats.spirit < spiritSpend) {
    return [];
  }
  const result = [];
  const self = state.players[actor];
  for (let y = 0; y < BOARD_HEIGHT; y += 1) {
    for (let x = 0; x < BOARD_WIDTH; x += 1) {
      const target = { x, y };
      const distance = chebyshevDistance(self.pos, target);
      if (distance <= 0 || distance > spiritSpend) {
        continue;
      }
      if (hasAnyUnitAt(state, target)) {
        continue;
      }
      result.push(target);
    }
  }
  return result;
}
function canUseScout(state, actor) {
  return canIssueAction(state, actor) && state.players[actor].stats.spirit >= 1;
}
function getLegalAttackTargets(state, actor) {
  if (!canIssueAction(state, actor)) {
    return [];
  }
  const result = [];
  const self = state.players[actor];
  for (let dy = -1; dy <= 1; dy += 1) {
    for (let dx = -1; dx <= 1; dx += 1) {
      if (dx === 0 && dy === 0) {
        continue;
      }
      const target = { x: self.pos.x + dx, y: self.pos.y + dy };
      if (!isCoordInBounds(target)) {
        continue;
      }
      if (chebyshevDistance(self.pos, target) > 1) {
        continue;
      }
      if (!isAttackTargetAt(state, actor, target)) {
        continue;
      }
      result.push(target);
    }
  }
  return result;
}
function getLegalBlinkTargets(state, actor, spiritSpend) {
  if (!canIssueAction(state, actor)) {
    return [];
  }
  if (!Number.isInteger(spiritSpend) || spiritSpend <= 0) {
    return [];
  }
  if (state.players[actor].stats.spirit < spiritSpend) {
    return [];
  }
  if (!state.players[actor].skills.role4) {
    return [];
  }
  const self = state.players[actor];
  const result = [];
  for (let y = 0; y < BOARD_HEIGHT; y += 1) {
    for (let x = 0; x < BOARD_WIDTH; x += 1) {
      const target = { x, y };
      const distance = chebyshevDistance(self.pos, target);
      if (distance <= 0 || distance > spiritSpend) {
        continue;
      }
      if (hasAnyUnitAt(state, target)) {
        continue;
      }
      result.push(target);
    }
  }
  return result;
}
function getQuickCastTargets(state, actor) {
  const moveTargets = getLegalMoveTargets(state, actor);
  const attackTargets = getLegalAttackTargets(state, actor).filter(
    (coord) => !containsCoord(moveTargets, coord)
  );
  return {
    moveTargets,
    attackTargets
  };
}
function applyMove(state, command) {
  if (command.type !== "move") {
    return { ok: false, reason: "invalid move command type" };
  }
  const actor = command.actor;
  if (!canIssueAction(state, actor)) {
    return { ok: false, reason: "cannot act now" };
  }
  const target = keyToCoord(command.to);
  if (!target) {
    return { ok: false, reason: "invalid target coordinate" };
  }
  const legal = containsCoord(getLegalMoveTargets(state, actor), target);
  if (!legal) {
    return { ok: false, reason: "illegal move target" };
  }
  const self = state.players[actor];
  const nextSpirit = isOrthogonalStep(self.pos, target) ? Math.min(self.stats.maxSpirit, self.stats.spirit + 1) : self.stats.spirit;
  const nextPlayers = clonePlayers(state.players);
  nextPlayers[actor].pos = { ...target };
  nextPlayers[actor].stats.spirit = nextSpirit;
  const nextState = {
    ...state,
    players: nextPlayers,
    announcements: appendTurnAnnouncements(state.announcements, state.turn.round, actor, [
      `${getSideLabel(actor)}\u79FB\u52A8\u5230${formatCoordDisplay(target)}`
    ]),
    turn: {
      ...state.turn,
      acted: true,
      pendingAnnouncement: null
    }
  };
  return { ok: true, state: nextState };
}
function applyBuild(state, command) {
  if (command.type !== "build") {
    return { ok: false, reason: "invalid build command type" };
  }
  const actor = command.actor;
  if (!canIssueAction(state, actor)) {
    return { ok: false, reason: "cannot act now" };
  }
  const target = keyToCoord(command.to);
  if (!target) {
    return { ok: false, reason: "invalid target coordinate" };
  }
  if (!Number.isInteger(command.spirit) || command.spirit <= 0) {
    return { ok: false, reason: "invalid spirit spend" };
  }
  if (state.players[actor].stats.spirit < command.spirit) {
    return { ok: false, reason: "not enough spirit" };
  }
  const legal = containsCoord(getLegalBuildTargets(state, actor, command.spirit), target);
  if (!legal) {
    return { ok: false, reason: "illegal build target" };
  }
  const nextPlayers = clonePlayers(state.players);
  nextPlayers[actor].stats.spirit -= command.spirit;
  const wallKey = coordToKey(target);
  const nextWalls = cloneWalls(state.walls);
  nextWalls[wallKey] = {
    hp: command.spirit,
    maxHp: command.spirit,
    alive: true
  };
  const nextState = {
    ...state,
    players: nextPlayers,
    walls: nextWalls,
    announcements: appendTurnAnnouncements(state.announcements, state.turn.round, actor, [
      `${getSideLabel(actor)}\u5728${formatCoordDisplay(target)}\u5EFA\u9020\u4E86\u751F\u547D\u4E0A\u9650\u4E3A${command.spirit}\u7684\u5899\u4F53`
    ]),
    turn: {
      ...state.turn,
      acted: true,
      pendingAnnouncement: null
    }
  };
  return { ok: true, state: nextState };
}
function applyScout(state, command) {
  if (command.type !== "scout") {
    return { ok: false, reason: "invalid scout command type" };
  }
  const actor = command.actor;
  if (!canIssueAction(state, actor)) {
    return { ok: false, reason: "cannot act now" };
  }
  const self = state.players[actor];
  if (self.stats.spirit < 1) {
    return { ok: false, reason: "not enough spirit" };
  }
  const enemy = state.players[oppositeSide(actor)];
  const scoutResult = isGrass(enemy.pos) ? "\u76EE\u6807\u4F4D\u4E8E\u8349\u4E1B\u4E2D\uFF0C\u65E0\u6CD5\u88AB\u4FA6\u5BDF" : `\u76EE\u6807\u5750\u6807\u4E3A${formatCoordDisplay(enemy.pos)}`;
  const nextPlayers = clonePlayers(state.players);
  nextPlayers[actor].stats.spirit -= 1;
  const nextState = {
    ...state,
    players: nextPlayers,
    announcements: appendTurnAnnouncements(state.announcements, state.turn.round, actor, [
      `${getSideLabel(actor)}\u8FDB\u884C\u4E86\u4FA6\u5BDF\uFF0C${scoutResult}`
    ]),
    turn: {
      ...state.turn,
      acted: true,
      pendingAnnouncement: null
    }
  };
  return { ok: true, state: nextState };
}
function applyAttack(state, command) {
  if (command.type !== "attack") {
    return { ok: false, reason: "invalid attack command type" };
  }
  const actor = command.actor;
  if (!canIssueAction(state, actor)) {
    return { ok: false, reason: "cannot act now" };
  }
  const target = keyToCoord(command.to);
  if (!target) {
    return { ok: false, reason: "invalid target coordinate" };
  }
  const self = state.players[actor];
  if (chebyshevDistance(self.pos, target) > 1 || coordsEqual(self.pos, target)) {
    return { ok: false, reason: "attack target out of range" };
  }
  if (!isAttackTargetAt(state, actor, target)) {
    return { ok: false, reason: "no valid target in tile" };
  }
  const damage = floorDamage(self.stats.atk);
  const enemySide = oppositeSide(actor);
  const nextPlayers = clonePlayers(state.players);
  const nextWalls = cloneWalls(state.walls);
  const damageAnnouncements = [];
  if (coordsEqual(nextPlayers[enemySide].pos, target)) {
    applyEnemyDamage(nextPlayers, enemySide, damage, damageAnnouncements);
  }
  applyWallDamage(nextPlayers, nextWalls, actor, target, damage);
  const winner = getWinnerFromPlayers({
    ...state,
    players: nextPlayers,
    walls: nextWalls
  });
  const nextState = {
    ...state,
    players: nextPlayers,
    walls: nextWalls,
    announcements: appendTurnAnnouncements(state.announcements, state.turn.round, actor, [
      `${getSideLabel(actor)}\u5BF9${formatCoordDisplay(target)}\u53D1\u52A8\u4E86\u666E\u901A\u653B\u51FB`,
      ...damageAnnouncements
    ]),
    turn: {
      ...state.turn,
      acted: true,
      pendingAnnouncement: null
    },
    winner
  };
  return { ok: true, state: nextState };
}
function applyUnlockSkill(state, command) {
  if (command.type !== "unlockSkill") {
    return { ok: false, reason: "invalid unlock command type" };
  }
  const actor = command.actor;
  if (!canIssueCommandByTurn(state, actor)) {
    return { ok: false, reason: "cannot unlock now" };
  }
  const self = state.players[actor];
  if (self.skills[command.skill]) {
    return { ok: false, reason: "skill already unlocked" };
  }
  if (self.stats.gold < SKILL_UNLOCK_COST) {
    return { ok: false, reason: "not enough gold" };
  }
  const nextPlayers = clonePlayers(state.players);
  nextPlayers[actor].stats.gold -= SKILL_UNLOCK_COST;
  nextPlayers[actor].skills[command.skill] = true;
  return {
    ok: true,
    state: {
      ...state,
      players: nextPlayers
    }
  };
}
function applyNeedle(state, command) {
  if (command.type !== "needle") {
    return { ok: false, reason: "invalid needle command type" };
  }
  const actor = command.actor;
  if (!canIssueAction(state, actor)) {
    return { ok: false, reason: "cannot act now" };
  }
  const self = state.players[actor];
  if (!self.skills.role1) {
    return { ok: false, reason: "skill role1 not unlocked" };
  }
  if (!Number.isInteger(command.spirit) || command.spirit <= 0) {
    return { ok: false, reason: "invalid spirit spend" };
  }
  if (self.stats.spirit < command.spirit) {
    return { ok: false, reason: "not enough spirit" };
  }
  const target = keyToCoord(command.to);
  if (!target) {
    return { ok: false, reason: "invalid target coordinate" };
  }
  const ray = buildRayPath(self.pos, target);
  if (!ray || ray.cells.length === 0) {
    return { ok: false, reason: "invalid needle direction" };
  }
  const enemySide = oppositeSide(actor);
  const nextPlayers = clonePlayers(state.players);
  const nextWalls = cloneWalls(state.walls);
  const damageAnnouncements = [];
  const projectiles = [];
  for (let index = 0; index < command.spirit; index += 1) {
    const traveled = [];
    let traveledExitT = 0;
    let endT = ray.maxT;
    let cellIndex = 0;
    while (cellIndex < ray.cells.length) {
      const groupEnterT = ray.cells[cellIndex].enterT;
      const group = [];
      while (cellIndex < ray.cells.length && Math.abs(ray.cells[cellIndex].enterT - groupEnterT) <= RAY_EPSILON) {
        const hit = ray.cells[cellIndex];
        group.push(hit);
        traveled.push(hit.coord);
        traveledExitT = Math.max(traveledExitT, hit.exitT);
        cellIndex += 1;
      }
      let groupHit = false;
      for (const hit of group) {
        if (isWallAliveInMap(nextWalls, hit.coord)) {
          applyWallDamage(nextPlayers, nextWalls, actor, hit.coord, 1);
          groupHit = true;
        }
      }
      for (const hit of group) {
        if (coordsEqual(nextPlayers[enemySide].pos, hit.coord)) {
          groupHit = applyEnemyDamage(nextPlayers, enemySide, 1, damageAnnouncements) || groupHit;
        }
      }
      if (groupHit) {
        endT = Math.max(groupEnterT + RAY_EPSILON, traveledExitT);
        break;
      }
    }
    if (traveledExitT > RAY_EPSILON && endT === ray.maxT) {
      endT = traveledExitT;
    }
    const rayEnd = getRayPoint(ray, endT);
    projectiles.push(
      buildProjectileEffect(
        "needle",
        actor,
        nextPlayers[actor].pos,
        traveled,
        index * NEEDLE_INTERVAL_MS,
        rayEnd
      )
    );
  }
  nextPlayers[actor].stats.spirit -= command.spirit;
  const winner = getWinnerFromPlayers({
    ...state,
    players: nextPlayers,
    walls: nextWalls
  });
  const nextState = {
    ...state,
    players: nextPlayers,
    walls: nextWalls,
    announcements: appendTurnAnnouncements(state.announcements, state.turn.round, actor, [
      `${getSideLabel(actor)}\u671D${formatCoordDisplay(target)}\u53D1\u5C04\u4E86\u5C01\u9B54\u9488`,
      ...damageAnnouncements
    ]),
    turn: {
      ...state.turn,
      acted: true,
      pendingAnnouncement: null
    },
    winner
  };
  const effects = {
    projectiles
  };
  return {
    ok: true,
    state: nextState,
    effects
  };
}
function applyAmulet(state, command) {
  if (command.type !== "amulet") {
    return { ok: false, reason: "invalid amulet command type" };
  }
  const actor = command.actor;
  if (!canIssueAction(state, actor)) {
    return { ok: false, reason: "cannot act now" };
  }
  const self = state.players[actor];
  if (!self.skills.role2) {
    return { ok: false, reason: "skill role2 not unlocked" };
  }
  if (!Number.isInteger(command.spirit) || command.spirit !== 1) {
    return { ok: false, reason: "amulet spirit must be 1" };
  }
  if (self.stats.spirit < 1) {
    return { ok: false, reason: "not enough spirit" };
  }
  const target = keyToCoord(command.to);
  if (!target) {
    return { ok: false, reason: "invalid target coordinate" };
  }
  const ray = buildRayPath(self.pos, target);
  if (!ray || ray.cells.length === 0) {
    return { ok: false, reason: "invalid amulet direction" };
  }
  const enemySide = oppositeSide(actor);
  const nextPlayers = clonePlayers(state.players);
  const nextWalls = cloneWalls(state.walls);
  const damageAnnouncements = [];
  const traveled = [];
  let hitEnemy = false;
  for (const hit of ray.cells) {
    traveled.push(hit.coord);
    if (isWallAliveInMap(nextWalls, hit.coord)) {
      applyWallDamage(nextPlayers, nextWalls, actor, hit.coord, 1);
    }
    if (coordsEqual(nextPlayers[enemySide].pos, hit.coord)) {
      hitEnemy = applyEnemyDamage(nextPlayers, enemySide, 1, damageAnnouncements) || hitEnemy;
    }
  }
  const spiritAfter = nextPlayers[actor].stats.spirit - 1 + (hitEnemy ? 1 : 0);
  nextPlayers[actor].stats.spirit = Math.max(
    0,
    Math.min(nextPlayers[actor].stats.maxSpirit, spiritAfter)
  );
  const winner = getWinnerFromPlayers({
    ...state,
    players: nextPlayers,
    walls: nextWalls
  });
  const nextState = {
    ...state,
    players: nextPlayers,
    walls: nextWalls,
    announcements: appendTurnAnnouncements(state.announcements, state.turn.round, actor, [
      `${getSideLabel(actor)}\u671D${formatCoordDisplay(target)}\u53D1\u5C04\u4E86\u7B26\u672D`,
      ...damageAnnouncements
    ]),
    turn: {
      ...state.turn,
      acted: true,
      pendingAnnouncement: null
    },
    winner
  };
  return {
    ok: true,
    state: nextState,
    effects: {
      projectiles: [
        buildProjectileEffect(
          "amulet",
          actor,
          nextPlayers[actor].pos,
          traveled,
          0,
          getRayPoint(ray, ray.maxT)
        )
      ]
    }
  };
}
function applyOrb(state, command) {
  if (command.type !== "orb") {
    return { ok: false, reason: "invalid orb command type" };
  }
  const actor = command.actor;
  if (!canIssueAction(state, actor)) {
    return { ok: false, reason: "cannot act now" };
  }
  const self = state.players[actor];
  if (!self.skills.role3) {
    return { ok: false, reason: "skill role3 not unlocked" };
  }
  if (!Number.isInteger(command.spirit) || command.spirit <= 0) {
    return { ok: false, reason: "invalid spirit spend" };
  }
  if (self.stats.spirit < command.spirit) {
    return { ok: false, reason: "not enough spirit" };
  }
  const nextPlayers = clonePlayers(state.players);
  nextPlayers[actor].stats.spirit -= command.spirit;
  nextPlayers[actor].effects.orbVisionRadius = command.spirit;
  nextPlayers[actor].effects.orbTurns = command.spirit;
  return {
    ok: true,
    state: {
      ...state,
      players: nextPlayers,
      announcements: appendTurnAnnouncements(state.announcements, state.turn.round, actor, [
        `${getSideLabel(actor)}\u83B7\u5F97\u4E86\u534A\u5F84\u4E3A${command.spirit}\u7684\u89C6\u91CE`
      ]),
      turn: {
        ...state.turn,
        acted: true,
        pendingAnnouncement: null
      }
    }
  };
}
function applyBlink(state, command) {
  if (command.type !== "blink") {
    return { ok: false, reason: "invalid blink command type" };
  }
  const actor = command.actor;
  if (!canIssueAction(state, actor)) {
    return { ok: false, reason: "cannot act now" };
  }
  const self = state.players[actor];
  if (!self.skills.role4) {
    return { ok: false, reason: "skill role4 not unlocked" };
  }
  if (!Number.isInteger(command.spirit) || command.spirit <= 0) {
    return { ok: false, reason: "invalid spirit spend" };
  }
  if (self.stats.spirit < command.spirit) {
    return { ok: false, reason: "not enough spirit" };
  }
  const target = keyToCoord(command.to);
  if (!target) {
    return { ok: false, reason: "invalid target coordinate" };
  }
  const legal = containsCoord(getLegalBlinkTargets(state, actor, command.spirit), target);
  if (!legal) {
    return { ok: false, reason: "illegal blink target" };
  }
  const nextPlayers = clonePlayers(state.players);
  nextPlayers[actor].stats.spirit -= command.spirit;
  nextPlayers[actor].pos = { ...target };
  return {
    ok: true,
    state: {
      ...state,
      players: nextPlayers,
      announcements: appendTurnAnnouncements(state.announcements, state.turn.round, actor, [
        `${getSideLabel(actor)}\u95EA\u73B0\u5230\u4E86${formatCoordDisplay(target)}`
      ]),
      turn: {
        ...state.turn,
        acted: true,
        pendingAnnouncement: null
      }
    }
  };
}
function decrementOrbWhenTurnStarts(players, enteringSide) {
  const effect = players[enteringSide].effects;
  if (effect.orbTurns <= 0) {
    return;
  }
  effect.orbTurns = Math.max(0, effect.orbTurns - 1);
  if (effect.orbTurns === 0) {
    effect.orbVisionRadius = 0;
  }
}
function advanceTurnState(state, actor) {
  const nextSide = oppositeSide(actor);
  const nextRound = actor === "red" ? state.turn.round + 1 : state.turn.round;
  const nextPlayers = clonePlayers(state.players);
  decrementOrbWhenTurnStarts(nextPlayers, nextSide);
  return {
    ...state,
    players: nextPlayers,
    turn: {
      side: nextSide,
      round: nextRound,
      acted: false,
      pendingAnnouncement: null
    }
  };
}
function applyEndTurn(state, command) {
  if (command.type !== "endTurn") {
    return { ok: false, reason: "invalid endTurn command type" };
  }
  if (state.winner) {
    return { ok: false, reason: "game has ended" };
  }
  const actor = command.actor;
  if (!canEndTurn(state, actor)) {
    return { ok: false, reason: "cannot end turn now" };
  }
  if (state.turn.acted) {
    return { ok: false, reason: "endTurn is pass-only after actions auto-end" };
  }
  return {
    ok: true,
    state: advanceTurnState(
      {
        ...state,
        announcements: appendTurnAnnouncements(state.announcements, state.turn.round, actor, [
          `${getSideLabel(actor)}\u9009\u62E9\u4E86\u7A7A\u8FC7`
        ])
      },
      actor
    )
  };
}
function applyCommand(state, command) {
  if (state.winner) {
    return { ok: false, reason: "game has ended" };
  }
  let applied;
  switch (command.type) {
    case "move":
      applied = applyMove(state, command);
      break;
    case "build":
      applied = applyBuild(state, command);
      break;
    case "scout":
      applied = applyScout(state, command);
      break;
    case "attack":
      applied = applyAttack(state, command);
      break;
    case "needle":
      applied = applyNeedle(state, command);
      break;
    case "amulet":
      applied = applyAmulet(state, command);
      break;
    case "orb":
      applied = applyOrb(state, command);
      break;
    case "blink":
      applied = applyBlink(state, command);
      break;
    case "unlockSkill":
      applied = applyUnlockSkill(state, command);
      break;
    case "endTurn":
      applied = applyEndTurn(state, command);
      break;
    default:
      return { ok: false, reason: "unsupported command" };
  }
  if (!applied.ok) {
    return applied;
  }
  if (command.type === "endTurn" || command.type === "unlockSkill" || applied.state.winner) {
    return applied;
  }
  return {
    ok: true,
    state: advanceTurnState(applied.state, command.actor),
    effects: applied.effects
  };
}
function applyCommandEnvelope(state, envelope) {
  const expectedSeq = state.seq + 1;
  if (envelope.seq !== expectedSeq) {
    return {
      ok: false,
      reason: `sequence mismatch, expect ${expectedSeq}, got ${envelope.seq}`
    };
  }
  const applied = applyCommand(state, envelope.command);
  if (!applied.ok) {
    return applied;
  }
  return {
    ok: true,
    state: {
      ...applied.state,
      seq: envelope.seq
    },
    effects: applied.effects
  };
}
function isVisibleFrom(state, observerSide, coord) {
  const self = state.players[observerSide];
  if (chebyshevDistance(self.pos, coord) > getVisionRadius(state, observerSide)) {
    return false;
  }
  const observerInGrass = isGrass(self.pos);
  const targetInGrass = isGrass(coord);
  if (!observerInGrass && targetInGrass && !coordsEqual(coord, self.pos)) {
    return false;
  }
  return true;
}
function buildCell(state, observerSide, coord) {
  const key = coordToKey(coord);
  const visible = isVisibleFrom(state, observerSide, coord);
  const initialWall = INITIAL_WALL_KEYS.has(key);
  const liveWall = Boolean(state.walls[key]?.alive);
  const hasWall = visible ? liveWall : initialWall;
  const wallHp = visible && liveWall ? state.walls[key].hp : null;
  return {
    coord,
    terrain: getBaseTerrain(coord),
    visible,
    hasWall,
    wallHp
  };
}
function buildPerspective(state, side) {
  const cells = [];
  for (let y = 0; y < BOARD_HEIGHT; y += 1) {
    for (let x = 0; x < BOARD_WIDTH; x += 1) {
      cells.push(buildCell(state, side, { x, y }));
    }
  }
  const self = state.players[side];
  const enemySide = oppositeSide(side);
  const enemyPos = state.players[enemySide].pos;
  const enemyVisible = isVisibleFrom(state, side, enemyPos);
  return {
    side,
    cells,
    pieces: {
      [side]: { ...self.pos },
      ...enemyVisible ? { [enemySide]: { ...enemyPos } } : {}
    }
  };
}

// src/debug.ts
var MAX_HASH_HISTORY = 256;
function nowTimeText() {
  const date = /* @__PURE__ */ new Date();
  const hh = String(date.getHours()).padStart(2, "0");
  const mm = String(date.getMinutes()).padStart(2, "0");
  const ss = String(date.getSeconds()).padStart(2, "0");
  return `${hh}:${mm}:${ss}`;
}
function createDebugPanel(root, options) {
  const handlers = {
    onConnectAction: null,
    onStartLoopback: null,
    onSideChange: null
  };
  const localHashMap = /* @__PURE__ */ new Map();
  const remoteHashMap = /* @__PURE__ */ new Map();
  const wrapper = document.createElement("section");
  wrapper.className = "panel debug-panel";
  const title = document.createElement("h3");
  title.className = "debug-title";
  title.textContent = options.debugEnabled ? "\u8054\u673A Debug" : "\u8054\u673A";
  wrapper.appendChild(title);
  const controlRow = document.createElement("div");
  controlRow.className = "debug-controls";
  const sideSelect = document.createElement("select");
  sideSelect.className = "debug-input";
  sideSelect.innerHTML = '<option value="blue">P1 / \u84DD\u65B9</option><option value="red">P2 / \u7EA2\u65B9</option>';
  controlRow.appendChild(sideSelect);
  const modeSelect = document.createElement("select");
  modeSelect.className = "debug-input";
  modeSelect.innerHTML = '<option value="receiver">\u63A5\u6536\u6A21\u5F0F</option><option value="connector">\u8FDE\u63A5\u6A21\u5F0F</option>';
  controlRow.appendChild(modeSelect);
  const hashInput = document.createElement("input");
  hashInput.className = "debug-input";
  hashInput.placeholder = "\u8FDE\u63A5\u6A21\u5F0F\u8F93\u5165\u8FDE\u63A5\u7801";
  controlRow.appendChild(hashInput);
  const connectBtn = document.createElement("button");
  connectBtn.className = "debug-btn";
  connectBtn.textContent = "\u542F\u52A8\u8054\u673A";
  controlRow.appendChild(connectBtn);
  const loopbackBtn = document.createElement("button");
  loopbackBtn.className = "debug-btn";
  loopbackBtn.textContent = "Loopback";
  if (options.debugEnabled) {
    controlRow.appendChild(loopbackBtn);
  }
  wrapper.appendChild(controlRow);
  const inviteLine = document.createElement("div");
  inviteLine.className = "debug-line";
  inviteLine.textContent = "\u8FDE\u63A5\u7801: -";
  wrapper.appendChild(inviteLine);
  const statusLine = document.createElement("div");
  statusLine.className = "debug-line";
  statusLine.textContent = "\u72B6\u6001: idle";
  wrapper.appendChild(statusLine);
  const hashLine = document.createElement("div");
  hashLine.className = "debug-line";
  hashLine.textContent = "\u6821\u9A8C: \u7B49\u5F85\u547D\u4EE4";
  wrapper.appendChild(hashLine);
  const dualViewLineBlue = document.createElement("div");
  dualViewLineBlue.className = "debug-line";
  dualViewLineBlue.textContent = "\u84DD\u65B9\u89C6\u89D2: -";
  wrapper.appendChild(dualViewLineBlue);
  const dualViewLineRed = document.createElement("div");
  dualViewLineRed.className = "debug-line";
  dualViewLineRed.textContent = "\u7EA2\u65B9\u89C6\u89D2: -";
  wrapper.appendChild(dualViewLineRed);
  const logBox = document.createElement("pre");
  logBox.className = "debug-log";
  wrapper.appendChild(logBox);
  root.appendChild(wrapper);
  if (!options.debugEnabled) {
    hashLine.style.display = "none";
    dualViewLineBlue.style.display = "none";
    dualViewLineRed.style.display = "none";
    logBox.style.display = "none";
  }
  function appendLog(message) {
    if (!options.debugEnabled) {
      return;
    }
    const line = `[${nowTimeText()}] ${message}`;
    if (!logBox.textContent) {
      logBox.textContent = line;
      return;
    }
    const next = `${line}
${logBox.textContent}`;
    logBox.textContent = next.split("\n").slice(0, 20).join("\n");
  }
  function updateHashLine(latestSeq) {
    if (!options.debugEnabled) {
      return;
    }
    const localHash = localHashMap.get(latestSeq);
    const remoteHash = remoteHashMap.get(latestSeq);
    if (!localHash) {
      hashLine.textContent = "\u6821\u9A8C: \u672C\u5730\u8FD8\u6CA1\u6709\u53EF\u6BD4\u8F83 hash";
      return;
    }
    if (!remoteHash) {
      hashLine.textContent = `\u6821\u9A8C: seq=${latestSeq} \u672C\u5730=${localHash} | \u8FDC\u7AEF\u7B49\u5F85\u4E2D`;
      return;
    }
    const matched = localHash === remoteHash;
    hashLine.textContent = `\u6821\u9A8C: seq=${latestSeq} \u672C\u5730=${localHash} \u8FDC\u7AEF=${remoteHash} => ${matched ? "\u4E00\u81F4" : "\u4E0D\u4E00\u81F4"}`;
    if (!matched) {
      appendLog(`seq=${latestSeq} hash \u4E0D\u4E00\u81F4`);
    }
  }
  function trimHashMap(map) {
    while (map.size > MAX_HASH_HISTORY) {
      const firstKey = map.keys().next().value;
      if (typeof firstKey !== "number") {
        return;
      }
      map.delete(firstKey);
    }
  }
  function refreshModeUi() {
    const isConnector = modeSelect.value === "connector";
    hashInput.disabled = !isConnector;
    hashInput.style.opacity = isConnector ? "1" : "0.65";
    hashInput.placeholder = isConnector ? "\u8FDE\u63A5\u6A21\u5F0F\u8F93\u5165\u8FDE\u63A5\u7801" : "\u63A5\u6536\u6A21\u5F0F\u65E0\u9700\u8F93\u5165";
  }
  modeSelect.addEventListener("change", refreshModeUi);
  refreshModeUi();
  sideSelect.addEventListener("change", () => {
    const side = sideSelect.value === "red" ? "red" : "blue";
    handlers.onSideChange?.(side);
    appendLog(
      `\u672C\u673A\u8EAB\u4EFD\u5207\u6362\u4E3A ${side === "blue" ? "P1/\u84DD\u65B9" : "P2/\u7EA2\u65B9"}`
    );
  });
  connectBtn.addEventListener("click", () => {
    const mode = modeSelect.value === "connector" ? "connector" : "receiver";
    handlers.onConnectAction?.({
      mode,
      codeInput: hashInput.value.trim()
    });
  });
  loopbackBtn.addEventListener("click", () => {
    handlers.onStartLoopback?.();
  });
  return {
    onConnectAction(handler) {
      handlers.onConnectAction = handler;
    },
    onStartLoopback(handler) {
      handlers.onStartLoopback = handler;
    },
    onSideChange(handler) {
      handlers.onSideChange = handler;
    },
    getSelectedSide() {
      return sideSelect.value === "red" ? "red" : "blue";
    },
    setTransportStatus(status) {
      statusLine.textContent = `\u72B6\u6001: ${status.type} | ${status.detail}`;
      appendLog(`\u72B6\u6001\u66F4\u65B0: ${status.type} | ${status.detail}`);
    },
    setInviteHash(value) {
      inviteLine.textContent = value ? `\u8FDE\u63A5\u7801: ${value}` : "\u8FDE\u63A5\u7801: -";
    },
    log(message) {
      if (options.debugEnabled) {
        appendLog(message);
      } else {
        statusLine.textContent = `\u72B6\u6001: info | ${message}`;
      }
    },
    recordLocalHash(seq, hash) {
      localHashMap.set(seq, hash);
      trimHashMap(localHashMap);
      updateHashLine(seq);
    },
    recordRemoteHash(seq, hash) {
      remoteHashMap.set(seq, hash);
      trimHashMap(remoteHashMap);
      updateHashLine(seq);
    },
    updateDualView(state) {
      if (!options.debugEnabled) {
        return;
      }
      const blueView = buildPerspective(state, "blue");
      const redView = buildPerspective(state, "red");
      const blueVisibleCount = blueView.cells.filter((cell) => cell.visible).length;
      const redVisibleCount = redView.cells.filter((cell) => cell.visible).length;
      const blueEnemyVisible = Boolean(blueView.pieces.red);
      const redEnemyVisible = Boolean(redView.pieces.blue);
      const bluePos = coordToDisplayKey(state.players.blue.pos);
      const redPos = coordToDisplayKey(state.players.red.pos);
      dualViewLineBlue.textContent = `\u84DD\u65B9\u89C6\u89D2: \u53EF\u89C1\u683C=${blueVisibleCount} \u654C\u65B9\u53EF\u89C1=${blueEnemyVisible ? "\u662F" : "\u5426"} \u81EA\u8EAB=${bluePos}`;
      dualViewLineRed.textContent = `\u7EA2\u65B9\u89C6\u89D2: \u53EF\u89C1\u683C=${redVisibleCount} \u654C\u65B9\u53EF\u89C1=${redEnemyVisible ? "\u662F" : "\u5426"} \u81EA\u8EAB=${redPos}`;
    }
  };
}

// src/input.ts
function containsCoord2(list, target) {
  return list.some((item) => coordsEqual(item, target));
}
function canAct(ctx) {
  return ctx.connected && !ctx.game.winner && ctx.game.turn.side === ctx.localSide && !ctx.game.turn.acted;
}
function localUnit(ctx) {
  return ctx.game.players[ctx.localSide];
}
function getSpiritSpendBounds(skill, ctx) {
  if (skill !== "build" && skill !== "role1" && skill !== "role3" && skill !== "role4") {
    return { min: 0, max: 0 };
  }
  const max = Math.max(0, Math.floor(localUnit(ctx).stats.spirit));
  return { min: max > 0 ? 1 : 0, max };
}
function hasAnyBuildTarget(ctx) {
  const bounds = getSpiritSpendBounds("build", ctx);
  if (bounds.max < 1) {
    return false;
  }
  for (let spend = bounds.min; spend <= bounds.max; spend += 1) {
    if (getLegalBuildTargets(ctx.game, ctx.localSide, spend).length > 0) {
      return true;
    }
  }
  return false;
}
function hasAnyBlinkTarget(ctx) {
  const bounds = getSpiritSpendBounds("role4", ctx);
  if (bounds.max < 1) {
    return false;
  }
  for (let spend = bounds.min; spend <= bounds.max; spend += 1) {
    if (getLegalBlinkTargets(ctx.game, ctx.localSide, spend).length > 0) {
      return true;
    }
  }
  return false;
}
function isVariableSpiritSkill(skill) {
  return skill === "build" || skill === "role1" || skill === "role3" || skill === "role4";
}
function createInitialInputState() {
  return {
    activeSkill: null,
    quickCast: false,
    spiritSpend: 1
  };
}
function getSkillAvailability(ctx) {
  const self = localUnit(ctx);
  const noAction = {
    move: false,
    build: false,
    scout: false,
    attack: false,
    role1: false,
    role2: false,
    role3: false,
    role4: false
  };
  if (!canAct(ctx)) {
    return noAction;
  }
  return {
    move: getLegalMoveTargets(ctx.game, ctx.localSide).length > 0,
    build: hasAnyBuildTarget(ctx),
    scout: canUseScout(ctx.game, ctx.localSide),
    attack: getLegalAttackTargets(ctx.game, ctx.localSide).length > 0,
    role1: self.skills.role1 && self.stats.spirit >= 1,
    role2: self.skills.role2 && self.stats.spirit >= 1,
    role3: self.skills.role3 && self.stats.spirit >= 1,
    role4: self.skills.role4 && hasAnyBlinkTarget(ctx)
  };
}
function onSkillClick(state, skill, ctx) {
  const nextState = {
    ...state,
    quickCast: false
  };
  if (state.activeSkill === skill) {
    return {
      next: {
        ...nextState,
        activeSkill: null
      }
    };
  }
  const availability = getSkillAvailability(ctx);
  if (!availability[skill]) {
    return { next: { ...nextState, activeSkill: null } };
  }
  if (isRoleSkillId(skill) && !localUnit(ctx).skills[skill]) {
    return { next: { ...nextState, activeSkill: null } };
  }
  const bounds = getSpiritSpendBounds(skill, ctx);
  const clampedSpend = bounds.max > 0 ? Math.max(bounds.min, Math.min(bounds.max, nextState.spiritSpend)) : 1;
  return {
    next: {
      ...nextState,
      activeSkill: skill,
      spiritSpend: clampedSpend
    }
  };
}
function onAdjustSpiritSpend(state, delta, ctx) {
  if (!isVariableSpiritSkill(state.activeSkill)) {
    return { next: { ...state } };
  }
  const bounds = getSpiritSpendBounds(state.activeSkill, ctx);
  if (bounds.max < 1) {
    return {
      next: {
        ...state,
        spiritSpend: 1
      }
    };
  }
  const nextSpend = Math.max(bounds.min, Math.min(bounds.max, state.spiritSpend + delta));
  return {
    next: {
      ...state,
      spiritSpend: nextSpend
    }
  };
}
function onBoardClick(state, coord, ctx) {
  if (!ctx.connected) {
    return {
      next: {
        ...state,
        activeSkill: null,
        quickCast: false
      }
    };
  }
  if (state.quickCast) {
    const quick = getQuickCastTargets(ctx.game, ctx.localSide);
    const selfPos2 = localUnit(ctx).pos;
    if (coordsEqual(coord, selfPos2)) {
      return {
        next: {
          ...state,
          quickCast: false
        }
      };
    }
    if (containsCoord2(quick.moveTargets, coord)) {
      return {
        next: {
          ...state,
          activeSkill: null,
          quickCast: false
        },
        command: createMoveCommand(ctx.localSide, coord)
      };
    }
    if (containsCoord2(quick.attackTargets, coord)) {
      return {
        next: {
          ...state,
          activeSkill: null,
          quickCast: false
        },
        command: createAttackCommand(ctx.localSide, coord)
      };
    }
    return { next: { ...state } };
  }
  if (state.activeSkill === "move") {
    const legal = getLegalMoveTargets(ctx.game, ctx.localSide);
    if (!containsCoord2(legal, coord)) {
      return { next: { ...state } };
    }
    return {
      next: {
        ...state,
        activeSkill: null
      },
      command: createMoveCommand(ctx.localSide, coord)
    };
  }
  if (state.activeSkill === "build") {
    const legal = getLegalBuildTargets(ctx.game, ctx.localSide, state.spiritSpend);
    if (!containsCoord2(legal, coord)) {
      return { next: { ...state } };
    }
    return {
      next: {
        ...state,
        activeSkill: null
      },
      command: createBuildCommand(ctx.localSide, coord, state.spiritSpend)
    };
  }
  if (state.activeSkill === "attack") {
    const legal = getLegalAttackTargets(ctx.game, ctx.localSide);
    if (!containsCoord2(legal, coord)) {
      return { next: { ...state } };
    }
    return {
      next: {
        ...state,
        activeSkill: null
      },
      command: createAttackCommand(ctx.localSide, coord)
    };
  }
  if (state.activeSkill === "scout") {
    if (!canUseScout(ctx.game, ctx.localSide)) {
      return { next: { ...state, activeSkill: null } };
    }
    return {
      next: {
        ...state,
        activeSkill: null
      },
      command: createScoutCommand(ctx.localSide)
    };
  }
  if (state.activeSkill === "role1") {
    const selfPos2 = localUnit(ctx).pos;
    if (coordsEqual(selfPos2, coord)) {
      return { next: { ...state } };
    }
    return {
      next: {
        ...state,
        activeSkill: null
      },
      command: createNeedleCommand(ctx.localSide, coord, state.spiritSpend)
    };
  }
  if (state.activeSkill === "role2") {
    const selfPos2 = localUnit(ctx).pos;
    if (coordsEqual(selfPos2, coord)) {
      return { next: { ...state } };
    }
    return {
      next: {
        ...state,
        activeSkill: null
      },
      command: createAmuletCommand(ctx.localSide, coord)
    };
  }
  if (state.activeSkill === "role3") {
    return {
      next: {
        ...state,
        activeSkill: null
      },
      command: createOrbCommand(ctx.localSide, state.spiritSpend)
    };
  }
  if (state.activeSkill === "role4") {
    const legal = getLegalBlinkTargets(ctx.game, ctx.localSide, state.spiritSpend);
    if (!containsCoord2(legal, coord)) {
      return { next: { ...state } };
    }
    return {
      next: {
        ...state,
        activeSkill: null
      },
      command: createBlinkCommand(ctx.localSide, coord, state.spiritSpend)
    };
  }
  const selfPos = localUnit(ctx).pos;
  if (coordsEqual(coord, selfPos) && canAct(ctx)) {
    const quick = getQuickCastTargets(ctx.game, ctx.localSide);
    if (quick.moveTargets.length > 0 || quick.attackTargets.length > 0) {
      return {
        next: {
          ...state,
          quickCast: true,
          activeSkill: null
        }
      };
    }
  }
  return { next: { ...state } };
}
function onEndTurnClick(state, ctx) {
  if (!ctx.connected || ctx.ballisticPending || ctx.game.turn.acted || !canEndTurn(ctx.game, ctx.localSide)) {
    return { next: { ...state } };
  }
  return {
    next: {
      ...state,
      activeSkill: null,
      quickCast: false
    },
    command: createEndTurnCommand(ctx.localSide)
  };
}
function getHighlights(state, ctx) {
  if (state.quickCast) {
    const quick = getQuickCastTargets(ctx.game, ctx.localSide);
    return {
      moveHighlights: quick.moveTargets,
      attackHighlights: quick.attackTargets
    };
  }
  if (state.activeSkill === "move") {
    return {
      moveHighlights: getLegalMoveTargets(ctx.game, ctx.localSide),
      attackHighlights: []
    };
  }
  if (state.activeSkill === "build") {
    return {
      moveHighlights: getLegalBuildTargets(ctx.game, ctx.localSide, state.spiritSpend),
      attackHighlights: []
    };
  }
  if (state.activeSkill === "attack") {
    return {
      moveHighlights: [],
      attackHighlights: getLegalAttackTargets(ctx.game, ctx.localSide)
    };
  }
  if (state.activeSkill === "role4") {
    return {
      moveHighlights: getLegalBlinkTargets(ctx.game, ctx.localSide, state.spiritSpend),
      attackHighlights: []
    };
  }
  return {
    moveHighlights: [],
    attackHighlights: []
  };
}
function getSpiritSelectorView(state, ctx) {
  if (!isVariableSpiritSkill(state.activeSkill)) {
    return {
      visible: false,
      value: 0,
      min: 0,
      max: 0
    };
  }
  const bounds = getSpiritSpendBounds(state.activeSkill, ctx);
  if (bounds.max < 1) {
    return {
      visible: false,
      value: 0,
      min: 0,
      max: 0
    };
  }
  return {
    visible: true,
    value: Math.max(bounds.min, Math.min(bounds.max, state.spiritSpend)),
    min: bounds.min,
    max: bounds.max
  };
}

// node_modules/peerjs-js-binarypack/dist/binarypack.mjs
var $e8379818650e2442$export$93654d4f2d6cd524 = class {
  constructor() {
    this.encoder = new TextEncoder();
    this._pieces = [];
    this._parts = [];
  }
  append_buffer(data) {
    this.flush();
    this._parts.push(data);
  }
  append(data) {
    this._pieces.push(data);
  }
  flush() {
    if (this._pieces.length > 0) {
      const buf = new Uint8Array(this._pieces);
      this._parts.push(buf);
      this._pieces = [];
    }
  }
  toArrayBuffer() {
    const buffer = [];
    for (const part of this._parts) buffer.push(part);
    return $e8379818650e2442$var$concatArrayBuffers(buffer).buffer;
  }
};
function $e8379818650e2442$var$concatArrayBuffers(bufs) {
  let size = 0;
  for (const buf of bufs) size += buf.byteLength;
  const result = new Uint8Array(size);
  let offset = 0;
  for (const buf of bufs) {
    const view = new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
    result.set(view, offset);
    offset += buf.byteLength;
  }
  return result;
}
function $0cfd7828ad59115f$export$417857010dc9287f(data) {
  const unpacker = new $0cfd7828ad59115f$var$Unpacker(data);
  return unpacker.unpack();
}
function $0cfd7828ad59115f$export$2a703dbb0cb35339(data) {
  const packer = new $0cfd7828ad59115f$export$b9ec4b114aa40074();
  const res = packer.pack(data);
  if (res instanceof Promise) return res.then(() => packer.getBuffer());
  return packer.getBuffer();
}
var $0cfd7828ad59115f$var$Unpacker = class {
  constructor(data) {
    this.index = 0;
    this.dataBuffer = data;
    this.dataView = new Uint8Array(this.dataBuffer);
    this.length = this.dataBuffer.byteLength;
  }
  unpack() {
    const type = this.unpack_uint8();
    if (type < 128) return type;
    else if ((type ^ 224) < 32) return (type ^ 224) - 32;
    let size;
    if ((size = type ^ 160) <= 15) return this.unpack_raw(size);
    else if ((size = type ^ 176) <= 15) return this.unpack_string(size);
    else if ((size = type ^ 144) <= 15) return this.unpack_array(size);
    else if ((size = type ^ 128) <= 15) return this.unpack_map(size);
    switch (type) {
      case 192:
        return null;
      case 193:
        return void 0;
      case 194:
        return false;
      case 195:
        return true;
      case 202:
        return this.unpack_float();
      case 203:
        return this.unpack_double();
      case 204:
        return this.unpack_uint8();
      case 205:
        return this.unpack_uint16();
      case 206:
        return this.unpack_uint32();
      case 207:
        return this.unpack_uint64();
      case 208:
        return this.unpack_int8();
      case 209:
        return this.unpack_int16();
      case 210:
        return this.unpack_int32();
      case 211:
        return this.unpack_int64();
      case 212:
        return void 0;
      case 213:
        return void 0;
      case 214:
        return void 0;
      case 215:
        return void 0;
      case 216:
        size = this.unpack_uint16();
        return this.unpack_string(size);
      case 217:
        size = this.unpack_uint32();
        return this.unpack_string(size);
      case 218:
        size = this.unpack_uint16();
        return this.unpack_raw(size);
      case 219:
        size = this.unpack_uint32();
        return this.unpack_raw(size);
      case 220:
        size = this.unpack_uint16();
        return this.unpack_array(size);
      case 221:
        size = this.unpack_uint32();
        return this.unpack_array(size);
      case 222:
        size = this.unpack_uint16();
        return this.unpack_map(size);
      case 223:
        size = this.unpack_uint32();
        return this.unpack_map(size);
    }
  }
  unpack_uint8() {
    const byte = this.dataView[this.index] & 255;
    this.index++;
    return byte;
  }
  unpack_uint16() {
    const bytes = this.read(2);
    const uint16 = (bytes[0] & 255) * 256 + (bytes[1] & 255);
    this.index += 2;
    return uint16;
  }
  unpack_uint32() {
    const bytes = this.read(4);
    const uint32 = ((bytes[0] * 256 + bytes[1]) * 256 + bytes[2]) * 256 + bytes[3];
    this.index += 4;
    return uint32;
  }
  unpack_uint64() {
    const bytes = this.read(8);
    const uint64 = ((((((bytes[0] * 256 + bytes[1]) * 256 + bytes[2]) * 256 + bytes[3]) * 256 + bytes[4]) * 256 + bytes[5]) * 256 + bytes[6]) * 256 + bytes[7];
    this.index += 8;
    return uint64;
  }
  unpack_int8() {
    const uint8 = this.unpack_uint8();
    return uint8 < 128 ? uint8 : uint8 - 256;
  }
  unpack_int16() {
    const uint16 = this.unpack_uint16();
    return uint16 < 32768 ? uint16 : uint16 - 65536;
  }
  unpack_int32() {
    const uint32 = this.unpack_uint32();
    return uint32 < 2 ** 31 ? uint32 : uint32 - 2 ** 32;
  }
  unpack_int64() {
    const uint64 = this.unpack_uint64();
    return uint64 < 2 ** 63 ? uint64 : uint64 - 2 ** 64;
  }
  unpack_raw(size) {
    if (this.length < this.index + size) throw new Error(`BinaryPackFailure: index is out of range ${this.index} ${size} ${this.length}`);
    const buf = this.dataBuffer.slice(this.index, this.index + size);
    this.index += size;
    return buf;
  }
  unpack_string(size) {
    const bytes = this.read(size);
    let i = 0;
    let str = "";
    let c;
    let code;
    while (i < size) {
      c = bytes[i];
      if (c < 160) {
        code = c;
        i++;
      } else if ((c ^ 192) < 32) {
        code = (c & 31) << 6 | bytes[i + 1] & 63;
        i += 2;
      } else if ((c ^ 224) < 16) {
        code = (c & 15) << 12 | (bytes[i + 1] & 63) << 6 | bytes[i + 2] & 63;
        i += 3;
      } else {
        code = (c & 7) << 18 | (bytes[i + 1] & 63) << 12 | (bytes[i + 2] & 63) << 6 | bytes[i + 3] & 63;
        i += 4;
      }
      str += String.fromCodePoint(code);
    }
    this.index += size;
    return str;
  }
  unpack_array(size) {
    const objects = new Array(size);
    for (let i = 0; i < size; i++) objects[i] = this.unpack();
    return objects;
  }
  unpack_map(size) {
    const map = {};
    for (let i = 0; i < size; i++) {
      const key = this.unpack();
      map[key] = this.unpack();
    }
    return map;
  }
  unpack_float() {
    const uint32 = this.unpack_uint32();
    const sign = uint32 >> 31;
    const exp = (uint32 >> 23 & 255) - 127;
    const fraction = uint32 & 8388607 | 8388608;
    return (sign === 0 ? 1 : -1) * fraction * 2 ** (exp - 23);
  }
  unpack_double() {
    const h32 = this.unpack_uint32();
    const l32 = this.unpack_uint32();
    const sign = h32 >> 31;
    const exp = (h32 >> 20 & 2047) - 1023;
    const hfrac = h32 & 1048575 | 1048576;
    const frac = hfrac * 2 ** (exp - 20) + l32 * 2 ** (exp - 52);
    return (sign === 0 ? 1 : -1) * frac;
  }
  read(length) {
    const j = this.index;
    if (j + length <= this.length) return this.dataView.subarray(j, j + length);
    else throw new Error("BinaryPackFailure: read index out of range");
  }
};
var $0cfd7828ad59115f$export$b9ec4b114aa40074 = class {
  getBuffer() {
    return this._bufferBuilder.toArrayBuffer();
  }
  pack(value) {
    if (typeof value === "string") this.pack_string(value);
    else if (typeof value === "number") {
      if (Math.floor(value) === value) this.pack_integer(value);
      else this.pack_double(value);
    } else if (typeof value === "boolean") {
      if (value === true) this._bufferBuilder.append(195);
      else if (value === false) this._bufferBuilder.append(194);
    } else if (value === void 0) this._bufferBuilder.append(192);
    else if (typeof value === "object") {
      if (value === null) this._bufferBuilder.append(192);
      else {
        const constructor = value.constructor;
        if (value instanceof Array) {
          const res = this.pack_array(value);
          if (res instanceof Promise) return res.then(() => this._bufferBuilder.flush());
        } else if (value instanceof ArrayBuffer) this.pack_bin(new Uint8Array(value));
        else if ("BYTES_PER_ELEMENT" in value) {
          const v = value;
          this.pack_bin(new Uint8Array(v.buffer, v.byteOffset, v.byteLength));
        } else if (value instanceof Date) this.pack_string(value.toString());
        else if (value instanceof Blob) return value.arrayBuffer().then((buffer) => {
          this.pack_bin(new Uint8Array(buffer));
          this._bufferBuilder.flush();
        });
        else if (constructor == Object || constructor.toString().startsWith("class")) {
          const res = this.pack_object(value);
          if (res instanceof Promise) return res.then(() => this._bufferBuilder.flush());
        } else throw new Error(`Type "${constructor.toString()}" not yet supported`);
      }
    } else throw new Error(`Type "${typeof value}" not yet supported`);
    this._bufferBuilder.flush();
  }
  pack_bin(blob) {
    const length = blob.length;
    if (length <= 15) this.pack_uint8(160 + length);
    else if (length <= 65535) {
      this._bufferBuilder.append(218);
      this.pack_uint16(length);
    } else if (length <= 4294967295) {
      this._bufferBuilder.append(219);
      this.pack_uint32(length);
    } else throw new Error("Invalid length");
    this._bufferBuilder.append_buffer(blob);
  }
  pack_string(str) {
    const encoded = this._textEncoder.encode(str);
    const length = encoded.length;
    if (length <= 15) this.pack_uint8(176 + length);
    else if (length <= 65535) {
      this._bufferBuilder.append(216);
      this.pack_uint16(length);
    } else if (length <= 4294967295) {
      this._bufferBuilder.append(217);
      this.pack_uint32(length);
    } else throw new Error("Invalid length");
    this._bufferBuilder.append_buffer(encoded);
  }
  pack_array(ary) {
    const length = ary.length;
    if (length <= 15) this.pack_uint8(144 + length);
    else if (length <= 65535) {
      this._bufferBuilder.append(220);
      this.pack_uint16(length);
    } else if (length <= 4294967295) {
      this._bufferBuilder.append(221);
      this.pack_uint32(length);
    } else throw new Error("Invalid length");
    const packNext = (index) => {
      if (index < length) {
        const res = this.pack(ary[index]);
        if (res instanceof Promise) return res.then(() => packNext(index + 1));
        return packNext(index + 1);
      }
    };
    return packNext(0);
  }
  pack_integer(num) {
    if (num >= -32 && num <= 127) this._bufferBuilder.append(num & 255);
    else if (num >= 0 && num <= 255) {
      this._bufferBuilder.append(204);
      this.pack_uint8(num);
    } else if (num >= -128 && num <= 127) {
      this._bufferBuilder.append(208);
      this.pack_int8(num);
    } else if (num >= 0 && num <= 65535) {
      this._bufferBuilder.append(205);
      this.pack_uint16(num);
    } else if (num >= -32768 && num <= 32767) {
      this._bufferBuilder.append(209);
      this.pack_int16(num);
    } else if (num >= 0 && num <= 4294967295) {
      this._bufferBuilder.append(206);
      this.pack_uint32(num);
    } else if (num >= -2147483648 && num <= 2147483647) {
      this._bufferBuilder.append(210);
      this.pack_int32(num);
    } else if (num >= -9223372036854776e3 && num <= 9223372036854776e3) {
      this._bufferBuilder.append(211);
      this.pack_int64(num);
    } else if (num >= 0 && num <= 18446744073709552e3) {
      this._bufferBuilder.append(207);
      this.pack_uint64(num);
    } else throw new Error("Invalid integer");
  }
  pack_double(num) {
    let sign = 0;
    if (num < 0) {
      sign = 1;
      num = -num;
    }
    const exp = Math.floor(Math.log(num) / Math.LN2);
    const frac0 = num / 2 ** exp - 1;
    const frac1 = Math.floor(frac0 * 2 ** 52);
    const b32 = 2 ** 32;
    const h32 = sign << 31 | exp + 1023 << 20 | frac1 / b32 & 1048575;
    const l32 = frac1 % b32;
    this._bufferBuilder.append(203);
    this.pack_int32(h32);
    this.pack_int32(l32);
  }
  pack_object(obj) {
    const keys = Object.keys(obj);
    const length = keys.length;
    if (length <= 15) this.pack_uint8(128 + length);
    else if (length <= 65535) {
      this._bufferBuilder.append(222);
      this.pack_uint16(length);
    } else if (length <= 4294967295) {
      this._bufferBuilder.append(223);
      this.pack_uint32(length);
    } else throw new Error("Invalid length");
    const packNext = (index) => {
      if (index < keys.length) {
        const prop = keys[index];
        if (obj.hasOwnProperty(prop)) {
          this.pack(prop);
          const res = this.pack(obj[prop]);
          if (res instanceof Promise) return res.then(() => packNext(index + 1));
        }
        return packNext(index + 1);
      }
    };
    return packNext(0);
  }
  pack_uint8(num) {
    this._bufferBuilder.append(num);
  }
  pack_uint16(num) {
    this._bufferBuilder.append(num >> 8);
    this._bufferBuilder.append(num & 255);
  }
  pack_uint32(num) {
    const n = num & 4294967295;
    this._bufferBuilder.append((n & 4278190080) >>> 24);
    this._bufferBuilder.append((n & 16711680) >>> 16);
    this._bufferBuilder.append((n & 65280) >>> 8);
    this._bufferBuilder.append(n & 255);
  }
  pack_uint64(num) {
    const high = num / 2 ** 32;
    const low = num % 2 ** 32;
    this._bufferBuilder.append((high & 4278190080) >>> 24);
    this._bufferBuilder.append((high & 16711680) >>> 16);
    this._bufferBuilder.append((high & 65280) >>> 8);
    this._bufferBuilder.append(high & 255);
    this._bufferBuilder.append((low & 4278190080) >>> 24);
    this._bufferBuilder.append((low & 16711680) >>> 16);
    this._bufferBuilder.append((low & 65280) >>> 8);
    this._bufferBuilder.append(low & 255);
  }
  pack_int8(num) {
    this._bufferBuilder.append(num & 255);
  }
  pack_int16(num) {
    this._bufferBuilder.append((num & 65280) >> 8);
    this._bufferBuilder.append(num & 255);
  }
  pack_int32(num) {
    this._bufferBuilder.append(num >>> 24 & 255);
    this._bufferBuilder.append((num & 16711680) >>> 16);
    this._bufferBuilder.append((num & 65280) >>> 8);
    this._bufferBuilder.append(num & 255);
  }
  pack_int64(num) {
    const high = Math.floor(num / 2 ** 32);
    const low = num % 2 ** 32;
    this._bufferBuilder.append((high & 4278190080) >>> 24);
    this._bufferBuilder.append((high & 16711680) >>> 16);
    this._bufferBuilder.append((high & 65280) >>> 8);
    this._bufferBuilder.append(high & 255);
    this._bufferBuilder.append((low & 4278190080) >>> 24);
    this._bufferBuilder.append((low & 16711680) >>> 16);
    this._bufferBuilder.append((low & 65280) >>> 8);
    this._bufferBuilder.append(low & 255);
  }
  constructor() {
    this._bufferBuilder = new (0, $e8379818650e2442$export$93654d4f2d6cd524)();
    this._textEncoder = new TextEncoder();
  }
};

// node_modules/webrtc-adapter/src/js/utils.js
var logDisabled_ = true;
var deprecationWarnings_ = true;
function extractVersion(uastring, expr, pos) {
  const match = uastring.match(expr);
  return match && match.length >= pos && parseFloat(match[pos], 10);
}
function wrapPeerConnectionEvent(window2, eventNameToWrap, wrapper) {
  if (!window2.RTCPeerConnection) {
    return;
  }
  const proto = window2.RTCPeerConnection.prototype;
  const nativeAddEventListener = proto.addEventListener;
  proto.addEventListener = function(nativeEventName, cb) {
    if (nativeEventName !== eventNameToWrap) {
      return nativeAddEventListener.apply(this, arguments);
    }
    const wrappedCallback = (e) => {
      const modifiedEvent = wrapper(e);
      if (modifiedEvent) {
        if (cb.handleEvent) {
          cb.handleEvent(modifiedEvent);
        } else {
          cb(modifiedEvent);
        }
      }
    };
    this._eventMap = this._eventMap || {};
    if (!this._eventMap[eventNameToWrap]) {
      this._eventMap[eventNameToWrap] = /* @__PURE__ */ new Map();
    }
    this._eventMap[eventNameToWrap].set(cb, wrappedCallback);
    return nativeAddEventListener.apply(this, [
      nativeEventName,
      wrappedCallback
    ]);
  };
  const nativeRemoveEventListener = proto.removeEventListener;
  proto.removeEventListener = function(nativeEventName, cb) {
    if (nativeEventName !== eventNameToWrap || !this._eventMap || !this._eventMap[eventNameToWrap]) {
      return nativeRemoveEventListener.apply(this, arguments);
    }
    if (!this._eventMap[eventNameToWrap].has(cb)) {
      return nativeRemoveEventListener.apply(this, arguments);
    }
    const unwrappedCb = this._eventMap[eventNameToWrap].get(cb);
    this._eventMap[eventNameToWrap].delete(cb);
    if (this._eventMap[eventNameToWrap].size === 0) {
      delete this._eventMap[eventNameToWrap];
    }
    if (Object.keys(this._eventMap).length === 0) {
      delete this._eventMap;
    }
    return nativeRemoveEventListener.apply(this, [
      nativeEventName,
      unwrappedCb
    ]);
  };
  Object.defineProperty(proto, "on" + eventNameToWrap, {
    get() {
      return this["_on" + eventNameToWrap];
    },
    set(cb) {
      if (this["_on" + eventNameToWrap]) {
        this.removeEventListener(
          eventNameToWrap,
          this["_on" + eventNameToWrap]
        );
        delete this["_on" + eventNameToWrap];
      }
      if (cb) {
        this.addEventListener(
          eventNameToWrap,
          this["_on" + eventNameToWrap] = cb
        );
      }
    },
    enumerable: true,
    configurable: true
  });
}
function disableLog(bool) {
  if (typeof bool !== "boolean") {
    return new Error("Argument type: " + typeof bool + ". Please use a boolean.");
  }
  logDisabled_ = bool;
  return bool ? "adapter.js logging disabled" : "adapter.js logging enabled";
}
function disableWarnings(bool) {
  if (typeof bool !== "boolean") {
    return new Error("Argument type: " + typeof bool + ". Please use a boolean.");
  }
  deprecationWarnings_ = !bool;
  return "adapter.js deprecation warnings " + (bool ? "disabled" : "enabled");
}
function log() {
  if (typeof window === "object") {
    if (logDisabled_) {
      return;
    }
    if (typeof console !== "undefined" && typeof console.log === "function") {
      console.log.apply(console, arguments);
    }
  }
}
function deprecated(oldMethod, newMethod) {
  if (!deprecationWarnings_) {
    return;
  }
  console.warn(oldMethod + " is deprecated, please use " + newMethod + " instead.");
}
function detectBrowser(window2) {
  const result = { browser: null, version: null };
  if (typeof window2 === "undefined" || !window2.navigator || !window2.navigator.userAgent) {
    result.browser = "Not a browser.";
    return result;
  }
  const { navigator: navigator2 } = window2;
  if (navigator2.userAgentData && navigator2.userAgentData.brands) {
    const chromium = navigator2.userAgentData.brands.find((brand) => {
      return brand.brand === "Chromium";
    });
    if (chromium) {
      return { browser: "chrome", version: parseInt(chromium.version, 10) };
    }
  }
  if (navigator2.mozGetUserMedia) {
    result.browser = "firefox";
    result.version = parseInt(extractVersion(
      navigator2.userAgent,
      /Firefox\/(\d+)\./,
      1
    ));
  } else if (navigator2.webkitGetUserMedia || window2.isSecureContext === false && window2.webkitRTCPeerConnection) {
    result.browser = "chrome";
    result.version = parseInt(extractVersion(
      navigator2.userAgent,
      /Chrom(e|ium)\/(\d+)\./,
      2
    ));
  } else if (window2.RTCPeerConnection && navigator2.userAgent.match(/AppleWebKit\/(\d+)\./)) {
    result.browser = "safari";
    result.version = parseInt(extractVersion(
      navigator2.userAgent,
      /AppleWebKit\/(\d+)\./,
      1
    ));
    result.supportsUnifiedPlan = window2.RTCRtpTransceiver && "currentDirection" in window2.RTCRtpTransceiver.prototype;
    result._safariVersion = extractVersion(
      navigator2.userAgent,
      /Version\/(\d+(\.?\d+))/,
      1
    );
  } else {
    result.browser = "Not a supported browser.";
    return result;
  }
  return result;
}
function isObject(val) {
  return Object.prototype.toString.call(val) === "[object Object]";
}
function compactObject(data) {
  if (!isObject(data)) {
    return data;
  }
  return Object.keys(data).reduce(function(accumulator, key) {
    const isObj = isObject(data[key]);
    const value = isObj ? compactObject(data[key]) : data[key];
    const isEmptyObject = isObj && !Object.keys(value).length;
    if (value === void 0 || isEmptyObject) {
      return accumulator;
    }
    return Object.assign(accumulator, { [key]: value });
  }, {});
}
function walkStats(stats, base, resultSet) {
  if (!base || resultSet.has(base.id)) {
    return;
  }
  resultSet.set(base.id, base);
  Object.keys(base).forEach((name) => {
    if (name.endsWith("Id")) {
      walkStats(stats, stats.get(base[name]), resultSet);
    } else if (name.endsWith("Ids")) {
      base[name].forEach((id) => {
        walkStats(stats, stats.get(id), resultSet);
      });
    }
  });
}
function filterStats(result, track, outbound) {
  const streamStatsType = outbound ? "outbound-rtp" : "inbound-rtp";
  const filteredResult = /* @__PURE__ */ new Map();
  if (track === null) {
    return filteredResult;
  }
  const trackStats = [];
  result.forEach((value) => {
    if (value.type === "track" && value.trackIdentifier === track.id) {
      trackStats.push(value);
    }
  });
  trackStats.forEach((trackStat) => {
    result.forEach((stats) => {
      if (stats.type === streamStatsType && stats.trackId === trackStat.id) {
        walkStats(result, stats, filteredResult);
      }
    });
  });
  return filteredResult;
}

// node_modules/webrtc-adapter/src/js/chrome/chrome_shim.js
var chrome_shim_exports = {};
__export(chrome_shim_exports, {
  fixNegotiationNeeded: () => fixNegotiationNeeded,
  shimAddTrackRemoveTrack: () => shimAddTrackRemoveTrack,
  shimAddTrackRemoveTrackWithNative: () => shimAddTrackRemoveTrackWithNative,
  shimGetSendersWithDtmf: () => shimGetSendersWithDtmf,
  shimGetUserMedia: () => shimGetUserMedia,
  shimMediaStream: () => shimMediaStream,
  shimOnTrack: () => shimOnTrack,
  shimPeerConnection: () => shimPeerConnection,
  shimSenderReceiverGetStats: () => shimSenderReceiverGetStats
});

// node_modules/webrtc-adapter/src/js/chrome/getusermedia.js
var logging = log;
function shimGetUserMedia(window2, browserDetails) {
  const navigator2 = window2 && window2.navigator;
  if (!navigator2.mediaDevices) {
    return;
  }
  const constraintsToChrome_ = function(c) {
    if (typeof c !== "object" || c.mandatory || c.optional) {
      return c;
    }
    const cc = {};
    Object.keys(c).forEach((key) => {
      if (key === "require" || key === "advanced" || key === "mediaSource") {
        return;
      }
      const r = typeof c[key] === "object" ? c[key] : { ideal: c[key] };
      if (r.exact !== void 0 && typeof r.exact === "number") {
        r.min = r.max = r.exact;
      }
      const oldname_ = function(prefix, name) {
        if (prefix) {
          return prefix + name.charAt(0).toUpperCase() + name.slice(1);
        }
        return name === "deviceId" ? "sourceId" : name;
      };
      if (r.ideal !== void 0) {
        cc.optional = cc.optional || [];
        let oc = {};
        if (typeof r.ideal === "number") {
          oc[oldname_("min", key)] = r.ideal;
          cc.optional.push(oc);
          oc = {};
          oc[oldname_("max", key)] = r.ideal;
          cc.optional.push(oc);
        } else {
          oc[oldname_("", key)] = r.ideal;
          cc.optional.push(oc);
        }
      }
      if (r.exact !== void 0 && typeof r.exact !== "number") {
        cc.mandatory = cc.mandatory || {};
        cc.mandatory[oldname_("", key)] = r.exact;
      } else {
        ["min", "max"].forEach((mix) => {
          if (r[mix] !== void 0) {
            cc.mandatory = cc.mandatory || {};
            cc.mandatory[oldname_(mix, key)] = r[mix];
          }
        });
      }
    });
    if (c.advanced) {
      cc.optional = (cc.optional || []).concat(c.advanced);
    }
    return cc;
  };
  const shimConstraints_ = function(constraints, func) {
    if (browserDetails.version >= 61) {
      return func(constraints);
    }
    constraints = JSON.parse(JSON.stringify(constraints));
    if (constraints && typeof constraints.audio === "object") {
      const remap = function(obj, a, b) {
        if (a in obj && !(b in obj)) {
          obj[b] = obj[a];
          delete obj[a];
        }
      };
      constraints = JSON.parse(JSON.stringify(constraints));
      remap(constraints.audio, "autoGainControl", "googAutoGainControl");
      remap(constraints.audio, "noiseSuppression", "googNoiseSuppression");
      constraints.audio = constraintsToChrome_(constraints.audio);
    }
    if (constraints && typeof constraints.video === "object") {
      let face = constraints.video.facingMode;
      face = face && (typeof face === "object" ? face : { ideal: face });
      const getSupportedFacingModeLies = browserDetails.version < 66;
      if (face && (face.exact === "user" || face.exact === "environment" || face.ideal === "user" || face.ideal === "environment") && !(navigator2.mediaDevices.getSupportedConstraints && navigator2.mediaDevices.getSupportedConstraints().facingMode && !getSupportedFacingModeLies)) {
        delete constraints.video.facingMode;
        let matches;
        if (face.exact === "environment" || face.ideal === "environment") {
          matches = ["back", "rear"];
        } else if (face.exact === "user" || face.ideal === "user") {
          matches = ["front"];
        }
        if (matches) {
          return navigator2.mediaDevices.enumerateDevices().then((devices) => {
            devices = devices.filter((d) => d.kind === "videoinput");
            let dev = devices.find((d) => matches.some((match) => d.label.toLowerCase().includes(match)));
            if (!dev && devices.length && matches.includes("back")) {
              dev = devices[devices.length - 1];
            }
            if (dev) {
              constraints.video.deviceId = face.exact ? { exact: dev.deviceId } : { ideal: dev.deviceId };
            }
            constraints.video = constraintsToChrome_(constraints.video);
            logging("chrome: " + JSON.stringify(constraints));
            return func(constraints);
          });
        }
      }
      constraints.video = constraintsToChrome_(constraints.video);
    }
    logging("chrome: " + JSON.stringify(constraints));
    return func(constraints);
  };
  const shimError_ = function(e) {
    if (browserDetails.version >= 64) {
      return e;
    }
    return {
      name: {
        PermissionDeniedError: "NotAllowedError",
        PermissionDismissedError: "NotAllowedError",
        InvalidStateError: "NotAllowedError",
        DevicesNotFoundError: "NotFoundError",
        ConstraintNotSatisfiedError: "OverconstrainedError",
        TrackStartError: "NotReadableError",
        MediaDeviceFailedDueToShutdown: "NotAllowedError",
        MediaDeviceKillSwitchOn: "NotAllowedError",
        TabCaptureError: "AbortError",
        ScreenCaptureError: "AbortError",
        DeviceCaptureError: "AbortError"
      }[e.name] || e.name,
      message: e.message,
      constraint: e.constraint || e.constraintName,
      toString() {
        return this.name + (this.message && ": ") + this.message;
      }
    };
  };
  const getUserMedia_ = function(constraints, onSuccess, onError) {
    shimConstraints_(constraints, (c) => {
      navigator2.webkitGetUserMedia(c, onSuccess, (e) => {
        if (onError) {
          onError(shimError_(e));
        }
      });
    });
  };
  navigator2.getUserMedia = getUserMedia_.bind(navigator2);
  if (navigator2.mediaDevices.getUserMedia) {
    const origGetUserMedia = navigator2.mediaDevices.getUserMedia.bind(navigator2.mediaDevices);
    navigator2.mediaDevices.getUserMedia = function(cs) {
      return shimConstraints_(cs, (c) => origGetUserMedia(c).then((stream) => {
        if (c.audio && !stream.getAudioTracks().length || c.video && !stream.getVideoTracks().length) {
          stream.getTracks().forEach((track) => {
            track.stop();
          });
          throw new DOMException("", "NotFoundError");
        }
        return stream;
      }, (e) => Promise.reject(shimError_(e))));
    };
  }
}

// node_modules/webrtc-adapter/src/js/chrome/chrome_shim.js
function shimMediaStream(window2) {
  window2.MediaStream = window2.MediaStream || window2.webkitMediaStream;
}
function shimOnTrack(window2) {
  if (typeof window2 === "object" && window2.RTCPeerConnection && !("ontrack" in window2.RTCPeerConnection.prototype)) {
    Object.defineProperty(window2.RTCPeerConnection.prototype, "ontrack", {
      get() {
        return this._ontrack;
      },
      set(f) {
        if (this._ontrack) {
          this.removeEventListener("track", this._ontrack);
        }
        this.addEventListener("track", this._ontrack = f);
      },
      enumerable: true,
      configurable: true
    });
    const origSetRemoteDescription = window2.RTCPeerConnection.prototype.setRemoteDescription;
    window2.RTCPeerConnection.prototype.setRemoteDescription = function setRemoteDescription() {
      if (!this._ontrackpoly) {
        this._ontrackpoly = (e) => {
          e.stream.addEventListener("addtrack", (te) => {
            let receiver;
            if (window2.RTCPeerConnection.prototype.getReceivers) {
              receiver = this.getReceivers().find((r) => r.track && r.track.id === te.track.id);
            } else {
              receiver = { track: te.track };
            }
            const event = new Event("track");
            event.track = te.track;
            event.receiver = receiver;
            event.transceiver = { receiver };
            event.streams = [e.stream];
            this.dispatchEvent(event);
          });
          e.stream.getTracks().forEach((track) => {
            let receiver;
            if (window2.RTCPeerConnection.prototype.getReceivers) {
              receiver = this.getReceivers().find((r) => r.track && r.track.id === track.id);
            } else {
              receiver = { track };
            }
            const event = new Event("track");
            event.track = track;
            event.receiver = receiver;
            event.transceiver = { receiver };
            event.streams = [e.stream];
            this.dispatchEvent(event);
          });
        };
        this.addEventListener("addstream", this._ontrackpoly);
      }
      return origSetRemoteDescription.apply(this, arguments);
    };
  } else {
    wrapPeerConnectionEvent(window2, "track", (e) => {
      if (!e.transceiver) {
        Object.defineProperty(
          e,
          "transceiver",
          { value: { receiver: e.receiver } }
        );
      }
      return e;
    });
  }
}
function shimGetSendersWithDtmf(window2) {
  if (typeof window2 === "object" && window2.RTCPeerConnection && !("getSenders" in window2.RTCPeerConnection.prototype) && "createDTMFSender" in window2.RTCPeerConnection.prototype) {
    const shimSenderWithDtmf = function(pc, track) {
      return {
        track,
        get dtmf() {
          if (this._dtmf === void 0) {
            if (track.kind === "audio") {
              this._dtmf = pc.createDTMFSender(track);
            } else {
              this._dtmf = null;
            }
          }
          return this._dtmf;
        },
        _pc: pc
      };
    };
    if (!window2.RTCPeerConnection.prototype.getSenders) {
      window2.RTCPeerConnection.prototype.getSenders = function getSenders() {
        this._senders = this._senders || [];
        return this._senders.slice();
      };
      const origAddTrack = window2.RTCPeerConnection.prototype.addTrack;
      window2.RTCPeerConnection.prototype.addTrack = function addTrack(track, stream) {
        let sender = origAddTrack.apply(this, arguments);
        if (!sender) {
          sender = shimSenderWithDtmf(this, track);
          this._senders.push(sender);
        }
        return sender;
      };
      const origRemoveTrack = window2.RTCPeerConnection.prototype.removeTrack;
      window2.RTCPeerConnection.prototype.removeTrack = function removeTrack(sender) {
        origRemoveTrack.apply(this, arguments);
        const idx = this._senders.indexOf(sender);
        if (idx !== -1) {
          this._senders.splice(idx, 1);
        }
      };
    }
    const origAddStream = window2.RTCPeerConnection.prototype.addStream;
    window2.RTCPeerConnection.prototype.addStream = function addStream(stream) {
      this._senders = this._senders || [];
      origAddStream.apply(this, [stream]);
      stream.getTracks().forEach((track) => {
        this._senders.push(shimSenderWithDtmf(this, track));
      });
    };
    const origRemoveStream = window2.RTCPeerConnection.prototype.removeStream;
    window2.RTCPeerConnection.prototype.removeStream = function removeStream(stream) {
      this._senders = this._senders || [];
      origRemoveStream.apply(this, [stream]);
      stream.getTracks().forEach((track) => {
        const sender = this._senders.find((s) => s.track === track);
        if (sender) {
          this._senders.splice(this._senders.indexOf(sender), 1);
        }
      });
    };
  } else if (typeof window2 === "object" && window2.RTCPeerConnection && "getSenders" in window2.RTCPeerConnection.prototype && "createDTMFSender" in window2.RTCPeerConnection.prototype && window2.RTCRtpSender && !("dtmf" in window2.RTCRtpSender.prototype)) {
    const origGetSenders = window2.RTCPeerConnection.prototype.getSenders;
    window2.RTCPeerConnection.prototype.getSenders = function getSenders() {
      const senders = origGetSenders.apply(this, []);
      senders.forEach((sender) => sender._pc = this);
      return senders;
    };
    Object.defineProperty(window2.RTCRtpSender.prototype, "dtmf", {
      get() {
        if (this._dtmf === void 0) {
          if (this.track.kind === "audio") {
            this._dtmf = this._pc.createDTMFSender(this.track);
          } else {
            this._dtmf = null;
          }
        }
        return this._dtmf;
      }
    });
  }
}
function shimSenderReceiverGetStats(window2) {
  if (!(typeof window2 === "object" && window2.RTCPeerConnection && window2.RTCRtpSender && window2.RTCRtpReceiver)) {
    return;
  }
  if (!("getStats" in window2.RTCRtpSender.prototype)) {
    const origGetSenders = window2.RTCPeerConnection.prototype.getSenders;
    if (origGetSenders) {
      window2.RTCPeerConnection.prototype.getSenders = function getSenders() {
        const senders = origGetSenders.apply(this, []);
        senders.forEach((sender) => sender._pc = this);
        return senders;
      };
    }
    const origAddTrack = window2.RTCPeerConnection.prototype.addTrack;
    if (origAddTrack) {
      window2.RTCPeerConnection.prototype.addTrack = function addTrack() {
        const sender = origAddTrack.apply(this, arguments);
        sender._pc = this;
        return sender;
      };
    }
    window2.RTCRtpSender.prototype.getStats = function getStats() {
      const sender = this;
      return this._pc.getStats().then((result) => (
        /* Note: this will include stats of all senders that
         *   send a track with the same id as sender.track as
         *   it is not possible to identify the RTCRtpSender.
         */
        filterStats(result, sender.track, true)
      ));
    };
  }
  if (!("getStats" in window2.RTCRtpReceiver.prototype)) {
    const origGetReceivers = window2.RTCPeerConnection.prototype.getReceivers;
    if (origGetReceivers) {
      window2.RTCPeerConnection.prototype.getReceivers = function getReceivers() {
        const receivers = origGetReceivers.apply(this, []);
        receivers.forEach((receiver) => receiver._pc = this);
        return receivers;
      };
    }
    wrapPeerConnectionEvent(window2, "track", (e) => {
      e.receiver._pc = e.srcElement;
      return e;
    });
    window2.RTCRtpReceiver.prototype.getStats = function getStats() {
      const receiver = this;
      return this._pc.getStats().then((result) => filterStats(result, receiver.track, false));
    };
  }
  if (!("getStats" in window2.RTCRtpSender.prototype && "getStats" in window2.RTCRtpReceiver.prototype)) {
    return;
  }
  const origGetStats = window2.RTCPeerConnection.prototype.getStats;
  window2.RTCPeerConnection.prototype.getStats = function getStats() {
    if (arguments.length > 0 && arguments[0] instanceof window2.MediaStreamTrack) {
      const track = arguments[0];
      let sender;
      let receiver;
      let err;
      this.getSenders().forEach((s) => {
        if (s.track === track) {
          if (sender) {
            err = true;
          } else {
            sender = s;
          }
        }
      });
      this.getReceivers().forEach((r) => {
        if (r.track === track) {
          if (receiver) {
            err = true;
          } else {
            receiver = r;
          }
        }
        return r.track === track;
      });
      if (err || sender && receiver) {
        return Promise.reject(new DOMException(
          "There are more than one sender or receiver for the track.",
          "InvalidAccessError"
        ));
      } else if (sender) {
        return sender.getStats();
      } else if (receiver) {
        return receiver.getStats();
      }
      return Promise.reject(new DOMException(
        "There is no sender or receiver for the track.",
        "InvalidAccessError"
      ));
    }
    return origGetStats.apply(this, arguments);
  };
}
function shimAddTrackRemoveTrackWithNative(window2) {
  window2.RTCPeerConnection.prototype.getLocalStreams = function getLocalStreams() {
    this._shimmedLocalStreams = this._shimmedLocalStreams || {};
    return Object.keys(this._shimmedLocalStreams).map((streamId) => this._shimmedLocalStreams[streamId][0]);
  };
  const origAddTrack = window2.RTCPeerConnection.prototype.addTrack;
  window2.RTCPeerConnection.prototype.addTrack = function addTrack(track, stream) {
    if (!stream) {
      return origAddTrack.apply(this, arguments);
    }
    this._shimmedLocalStreams = this._shimmedLocalStreams || {};
    const sender = origAddTrack.apply(this, arguments);
    if (!this._shimmedLocalStreams[stream.id]) {
      this._shimmedLocalStreams[stream.id] = [stream, sender];
    } else if (this._shimmedLocalStreams[stream.id].indexOf(sender) === -1) {
      this._shimmedLocalStreams[stream.id].push(sender);
    }
    return sender;
  };
  const origAddStream = window2.RTCPeerConnection.prototype.addStream;
  window2.RTCPeerConnection.prototype.addStream = function addStream(stream) {
    this._shimmedLocalStreams = this._shimmedLocalStreams || {};
    stream.getTracks().forEach((track) => {
      const alreadyExists = this.getSenders().find((s) => s.track === track);
      if (alreadyExists) {
        throw new DOMException(
          "Track already exists.",
          "InvalidAccessError"
        );
      }
    });
    const existingSenders = this.getSenders();
    origAddStream.apply(this, arguments);
    const newSenders = this.getSenders().filter((newSender) => existingSenders.indexOf(newSender) === -1);
    this._shimmedLocalStreams[stream.id] = [stream].concat(newSenders);
  };
  const origRemoveStream = window2.RTCPeerConnection.prototype.removeStream;
  window2.RTCPeerConnection.prototype.removeStream = function removeStream(stream) {
    this._shimmedLocalStreams = this._shimmedLocalStreams || {};
    delete this._shimmedLocalStreams[stream.id];
    return origRemoveStream.apply(this, arguments);
  };
  const origRemoveTrack = window2.RTCPeerConnection.prototype.removeTrack;
  window2.RTCPeerConnection.prototype.removeTrack = function removeTrack(sender) {
    this._shimmedLocalStreams = this._shimmedLocalStreams || {};
    if (sender) {
      Object.keys(this._shimmedLocalStreams).forEach((streamId) => {
        const idx = this._shimmedLocalStreams[streamId].indexOf(sender);
        if (idx !== -1) {
          this._shimmedLocalStreams[streamId].splice(idx, 1);
        }
        if (this._shimmedLocalStreams[streamId].length === 1) {
          delete this._shimmedLocalStreams[streamId];
        }
      });
    }
    return origRemoveTrack.apply(this, arguments);
  };
}
function shimAddTrackRemoveTrack(window2, browserDetails) {
  if (!window2.RTCPeerConnection) {
    return;
  }
  if (window2.RTCPeerConnection.prototype.addTrack && browserDetails.version >= 65) {
    return shimAddTrackRemoveTrackWithNative(window2);
  }
  const origGetLocalStreams = window2.RTCPeerConnection.prototype.getLocalStreams;
  window2.RTCPeerConnection.prototype.getLocalStreams = function getLocalStreams() {
    const nativeStreams = origGetLocalStreams.apply(this);
    this._reverseStreams = this._reverseStreams || {};
    return nativeStreams.map((stream) => this._reverseStreams[stream.id]);
  };
  const origAddStream = window2.RTCPeerConnection.prototype.addStream;
  window2.RTCPeerConnection.prototype.addStream = function addStream(stream) {
    this._streams = this._streams || {};
    this._reverseStreams = this._reverseStreams || {};
    stream.getTracks().forEach((track) => {
      const alreadyExists = this.getSenders().find((s) => s.track === track);
      if (alreadyExists) {
        throw new DOMException(
          "Track already exists.",
          "InvalidAccessError"
        );
      }
    });
    if (!this._reverseStreams[stream.id]) {
      const newStream = new window2.MediaStream(stream.getTracks());
      this._streams[stream.id] = newStream;
      this._reverseStreams[newStream.id] = stream;
      stream = newStream;
    }
    origAddStream.apply(this, [stream]);
  };
  const origRemoveStream = window2.RTCPeerConnection.prototype.removeStream;
  window2.RTCPeerConnection.prototype.removeStream = function removeStream(stream) {
    this._streams = this._streams || {};
    this._reverseStreams = this._reverseStreams || {};
    origRemoveStream.apply(this, [this._streams[stream.id] || stream]);
    delete this._reverseStreams[this._streams[stream.id] ? this._streams[stream.id].id : stream.id];
    delete this._streams[stream.id];
  };
  window2.RTCPeerConnection.prototype.addTrack = function addTrack(track, stream) {
    if (this.signalingState === "closed") {
      throw new DOMException(
        "The RTCPeerConnection's signalingState is 'closed'.",
        "InvalidStateError"
      );
    }
    const streams = [].slice.call(arguments, 1);
    if (streams.length !== 1 || !streams[0].getTracks().find((t) => t === track)) {
      throw new DOMException(
        "The adapter.js addTrack polyfill only supports a single  stream which is associated with the specified track.",
        "NotSupportedError"
      );
    }
    const alreadyExists = this.getSenders().find((s) => s.track === track);
    if (alreadyExists) {
      throw new DOMException(
        "Track already exists.",
        "InvalidAccessError"
      );
    }
    this._streams = this._streams || {};
    this._reverseStreams = this._reverseStreams || {};
    const oldStream = this._streams[stream.id];
    if (oldStream) {
      oldStream.addTrack(track);
      Promise.resolve().then(() => {
        this.dispatchEvent(new Event("negotiationneeded"));
      });
    } else {
      const newStream = new window2.MediaStream([track]);
      this._streams[stream.id] = newStream;
      this._reverseStreams[newStream.id] = stream;
      this.addStream(newStream);
    }
    return this.getSenders().find((s) => s.track === track);
  };
  function replaceInternalStreamId(pc, description) {
    let sdp2 = description.sdp;
    Object.keys(pc._reverseStreams || []).forEach((internalId) => {
      const externalStream = pc._reverseStreams[internalId];
      const internalStream = pc._streams[externalStream.id];
      sdp2 = sdp2.replace(
        new RegExp(internalStream.id, "g"),
        externalStream.id
      );
    });
    return new RTCSessionDescription({
      type: description.type,
      sdp: sdp2
    });
  }
  function replaceExternalStreamId(pc, description) {
    let sdp2 = description.sdp;
    Object.keys(pc._reverseStreams || []).forEach((internalId) => {
      const externalStream = pc._reverseStreams[internalId];
      const internalStream = pc._streams[externalStream.id];
      sdp2 = sdp2.replace(
        new RegExp(externalStream.id, "g"),
        internalStream.id
      );
    });
    return new RTCSessionDescription({
      type: description.type,
      sdp: sdp2
    });
  }
  ["createOffer", "createAnswer"].forEach(function(method) {
    const nativeMethod = window2.RTCPeerConnection.prototype[method];
    const methodObj = { [method]() {
      const args = arguments;
      const isLegacyCall = arguments.length && typeof arguments[0] === "function";
      if (isLegacyCall) {
        return nativeMethod.apply(this, [
          (description) => {
            const desc = replaceInternalStreamId(this, description);
            args[0].apply(null, [desc]);
          },
          (err) => {
            if (args[1]) {
              args[1].apply(null, err);
            }
          },
          arguments[2]
        ]);
      }
      return nativeMethod.apply(this, arguments).then((description) => replaceInternalStreamId(this, description));
    } };
    window2.RTCPeerConnection.prototype[method] = methodObj[method];
  });
  const origSetLocalDescription = window2.RTCPeerConnection.prototype.setLocalDescription;
  window2.RTCPeerConnection.prototype.setLocalDescription = function setLocalDescription() {
    if (!arguments.length || !arguments[0].type) {
      return origSetLocalDescription.apply(this, arguments);
    }
    arguments[0] = replaceExternalStreamId(this, arguments[0]);
    return origSetLocalDescription.apply(this, arguments);
  };
  const origLocalDescription = Object.getOwnPropertyDescriptor(
    window2.RTCPeerConnection.prototype,
    "localDescription"
  );
  Object.defineProperty(
    window2.RTCPeerConnection.prototype,
    "localDescription",
    {
      get() {
        const description = origLocalDescription.get.apply(this);
        if (description.type === "") {
          return description;
        }
        return replaceInternalStreamId(this, description);
      }
    }
  );
  window2.RTCPeerConnection.prototype.removeTrack = function removeTrack(sender) {
    if (this.signalingState === "closed") {
      throw new DOMException(
        "The RTCPeerConnection's signalingState is 'closed'.",
        "InvalidStateError"
      );
    }
    if (!sender._pc) {
      throw new DOMException("Argument 1 of RTCPeerConnection.removeTrack does not implement interface RTCRtpSender.", "TypeError");
    }
    const isLocal = sender._pc === this;
    if (!isLocal) {
      throw new DOMException(
        "Sender was not created by this connection.",
        "InvalidAccessError"
      );
    }
    this._streams = this._streams || {};
    let stream;
    Object.keys(this._streams).forEach((streamid) => {
      const hasTrack = this._streams[streamid].getTracks().find((track) => sender.track === track);
      if (hasTrack) {
        stream = this._streams[streamid];
      }
    });
    if (stream) {
      if (stream.getTracks().length === 1) {
        this.removeStream(this._reverseStreams[stream.id]);
      } else {
        stream.removeTrack(sender.track);
      }
      this.dispatchEvent(new Event("negotiationneeded"));
    }
  };
}
function shimPeerConnection(window2, browserDetails) {
  if (!window2.RTCPeerConnection && window2.webkitRTCPeerConnection) {
    window2.RTCPeerConnection = window2.webkitRTCPeerConnection;
  }
  if (!window2.RTCPeerConnection) {
    return;
  }
  if (browserDetails.version < 53) {
    ["setLocalDescription", "setRemoteDescription", "addIceCandidate"].forEach(function(method) {
      const nativeMethod = window2.RTCPeerConnection.prototype[method];
      const methodObj = { [method]() {
        arguments[0] = new (method === "addIceCandidate" ? window2.RTCIceCandidate : window2.RTCSessionDescription)(arguments[0]);
        return nativeMethod.apply(this, arguments);
      } };
      window2.RTCPeerConnection.prototype[method] = methodObj[method];
    });
  }
}
function fixNegotiationNeeded(window2, browserDetails) {
  wrapPeerConnectionEvent(window2, "negotiationneeded", (e) => {
    const pc = e.target;
    if (browserDetails.version < 72 || pc.getConfiguration && pc.getConfiguration().sdpSemantics === "plan-b") {
      if (pc.signalingState !== "stable") {
        return;
      }
    }
    return e;
  });
}

// node_modules/webrtc-adapter/src/js/firefox/firefox_shim.js
var firefox_shim_exports = {};
__export(firefox_shim_exports, {
  shimAddTransceiver: () => shimAddTransceiver,
  shimCreateAnswer: () => shimCreateAnswer,
  shimCreateOffer: () => shimCreateOffer,
  shimGetDisplayMedia: () => shimGetDisplayMedia,
  shimGetParameters: () => shimGetParameters,
  shimGetUserMedia: () => shimGetUserMedia2,
  shimOnTrack: () => shimOnTrack2,
  shimPeerConnection: () => shimPeerConnection2,
  shimRTCDataChannel: () => shimRTCDataChannel,
  shimReceiverGetStats: () => shimReceiverGetStats,
  shimRemoveStream: () => shimRemoveStream,
  shimSenderGetStats: () => shimSenderGetStats
});

// node_modules/webrtc-adapter/src/js/firefox/getusermedia.js
function shimGetUserMedia2(window2, browserDetails) {
  const navigator2 = window2 && window2.navigator;
  const MediaStreamTrack = window2 && window2.MediaStreamTrack;
  navigator2.getUserMedia = function(constraints, onSuccess, onError) {
    deprecated(
      "navigator.getUserMedia",
      "navigator.mediaDevices.getUserMedia"
    );
    navigator2.mediaDevices.getUserMedia(constraints).then(onSuccess, onError);
  };
  if (!(browserDetails.version > 55 && "autoGainControl" in navigator2.mediaDevices.getSupportedConstraints())) {
    const remap = function(obj, a, b) {
      if (a in obj && !(b in obj)) {
        obj[b] = obj[a];
        delete obj[a];
      }
    };
    const nativeGetUserMedia = navigator2.mediaDevices.getUserMedia.bind(navigator2.mediaDevices);
    navigator2.mediaDevices.getUserMedia = function(c) {
      if (typeof c === "object" && typeof c.audio === "object") {
        c = JSON.parse(JSON.stringify(c));
        remap(c.audio, "autoGainControl", "mozAutoGainControl");
        remap(c.audio, "noiseSuppression", "mozNoiseSuppression");
      }
      return nativeGetUserMedia(c);
    };
    if (MediaStreamTrack && MediaStreamTrack.prototype.getSettings) {
      const nativeGetSettings = MediaStreamTrack.prototype.getSettings;
      MediaStreamTrack.prototype.getSettings = function() {
        const obj = nativeGetSettings.apply(this, arguments);
        remap(obj, "mozAutoGainControl", "autoGainControl");
        remap(obj, "mozNoiseSuppression", "noiseSuppression");
        return obj;
      };
    }
    if (MediaStreamTrack && MediaStreamTrack.prototype.applyConstraints) {
      const nativeApplyConstraints = MediaStreamTrack.prototype.applyConstraints;
      MediaStreamTrack.prototype.applyConstraints = function(c) {
        if (this.kind === "audio" && typeof c === "object") {
          c = JSON.parse(JSON.stringify(c));
          remap(c, "autoGainControl", "mozAutoGainControl");
          remap(c, "noiseSuppression", "mozNoiseSuppression");
        }
        return nativeApplyConstraints.apply(this, [c]);
      };
    }
  }
}

// node_modules/webrtc-adapter/src/js/firefox/getdisplaymedia.js
function shimGetDisplayMedia(window2, preferredMediaSource) {
  if (window2.navigator.mediaDevices && "getDisplayMedia" in window2.navigator.mediaDevices) {
    return;
  }
  if (!window2.navigator.mediaDevices) {
    return;
  }
  window2.navigator.mediaDevices.getDisplayMedia = function getDisplayMedia(constraints) {
    if (!(constraints && constraints.video)) {
      const err = new DOMException("getDisplayMedia without video constraints is undefined");
      err.name = "NotFoundError";
      err.code = 8;
      return Promise.reject(err);
    }
    if (constraints.video === true) {
      constraints.video = { mediaSource: preferredMediaSource };
    } else {
      constraints.video.mediaSource = preferredMediaSource;
    }
    return window2.navigator.mediaDevices.getUserMedia(constraints);
  };
}

// node_modules/webrtc-adapter/src/js/firefox/firefox_shim.js
function shimOnTrack2(window2) {
  if (typeof window2 === "object" && window2.RTCTrackEvent && "receiver" in window2.RTCTrackEvent.prototype && !("transceiver" in window2.RTCTrackEvent.prototype)) {
    Object.defineProperty(window2.RTCTrackEvent.prototype, "transceiver", {
      get() {
        return { receiver: this.receiver };
      }
    });
  }
}
function shimPeerConnection2(window2, browserDetails) {
  if (typeof window2 !== "object" || !(window2.RTCPeerConnection || window2.mozRTCPeerConnection)) {
    return;
  }
  if (!window2.RTCPeerConnection && window2.mozRTCPeerConnection) {
    window2.RTCPeerConnection = window2.mozRTCPeerConnection;
  }
  if (browserDetails.version < 53) {
    ["setLocalDescription", "setRemoteDescription", "addIceCandidate"].forEach(function(method) {
      const nativeMethod = window2.RTCPeerConnection.prototype[method];
      const methodObj = { [method]() {
        arguments[0] = new (method === "addIceCandidate" ? window2.RTCIceCandidate : window2.RTCSessionDescription)(arguments[0]);
        return nativeMethod.apply(this, arguments);
      } };
      window2.RTCPeerConnection.prototype[method] = methodObj[method];
    });
  }
  const modernStatsTypes = {
    inboundrtp: "inbound-rtp",
    outboundrtp: "outbound-rtp",
    candidatepair: "candidate-pair",
    localcandidate: "local-candidate",
    remotecandidate: "remote-candidate"
  };
  const nativeGetStats = window2.RTCPeerConnection.prototype.getStats;
  window2.RTCPeerConnection.prototype.getStats = function getStats() {
    const [selector, onSucc, onErr] = arguments;
    return nativeGetStats.apply(this, [selector || null]).then((stats) => {
      if (browserDetails.version < 53 && !onSucc) {
        try {
          stats.forEach((stat) => {
            stat.type = modernStatsTypes[stat.type] || stat.type;
          });
        } catch (e) {
          if (e.name !== "TypeError") {
            throw e;
          }
          stats.forEach((stat, i) => {
            stats.set(i, Object.assign({}, stat, {
              type: modernStatsTypes[stat.type] || stat.type
            }));
          });
        }
      }
      return stats;
    }).then(onSucc, onErr);
  };
}
function shimSenderGetStats(window2) {
  if (!(typeof window2 === "object" && window2.RTCPeerConnection && window2.RTCRtpSender)) {
    return;
  }
  if (window2.RTCRtpSender && "getStats" in window2.RTCRtpSender.prototype) {
    return;
  }
  const origGetSenders = window2.RTCPeerConnection.prototype.getSenders;
  if (origGetSenders) {
    window2.RTCPeerConnection.prototype.getSenders = function getSenders() {
      const senders = origGetSenders.apply(this, []);
      senders.forEach((sender) => sender._pc = this);
      return senders;
    };
  }
  const origAddTrack = window2.RTCPeerConnection.prototype.addTrack;
  if (origAddTrack) {
    window2.RTCPeerConnection.prototype.addTrack = function addTrack() {
      const sender = origAddTrack.apply(this, arguments);
      sender._pc = this;
      return sender;
    };
  }
  window2.RTCRtpSender.prototype.getStats = function getStats() {
    return this.track ? this._pc.getStats(this.track) : Promise.resolve(/* @__PURE__ */ new Map());
  };
}
function shimReceiverGetStats(window2) {
  if (!(typeof window2 === "object" && window2.RTCPeerConnection && window2.RTCRtpSender)) {
    return;
  }
  if (window2.RTCRtpSender && "getStats" in window2.RTCRtpReceiver.prototype) {
    return;
  }
  const origGetReceivers = window2.RTCPeerConnection.prototype.getReceivers;
  if (origGetReceivers) {
    window2.RTCPeerConnection.prototype.getReceivers = function getReceivers() {
      const receivers = origGetReceivers.apply(this, []);
      receivers.forEach((receiver) => receiver._pc = this);
      return receivers;
    };
  }
  wrapPeerConnectionEvent(window2, "track", (e) => {
    e.receiver._pc = e.srcElement;
    return e;
  });
  window2.RTCRtpReceiver.prototype.getStats = function getStats() {
    return this._pc.getStats(this.track);
  };
}
function shimRemoveStream(window2) {
  if (!window2.RTCPeerConnection || "removeStream" in window2.RTCPeerConnection.prototype) {
    return;
  }
  window2.RTCPeerConnection.prototype.removeStream = function removeStream(stream) {
    deprecated("removeStream", "removeTrack");
    this.getSenders().forEach((sender) => {
      if (sender.track && stream.getTracks().includes(sender.track)) {
        this.removeTrack(sender);
      }
    });
  };
}
function shimRTCDataChannel(window2) {
  if (window2.DataChannel && !window2.RTCDataChannel) {
    window2.RTCDataChannel = window2.DataChannel;
  }
}
function shimAddTransceiver(window2) {
  if (!(typeof window2 === "object" && window2.RTCPeerConnection)) {
    return;
  }
  const origAddTransceiver = window2.RTCPeerConnection.prototype.addTransceiver;
  if (origAddTransceiver) {
    window2.RTCPeerConnection.prototype.addTransceiver = function addTransceiver() {
      this.setParametersPromises = [];
      let sendEncodings = arguments[1] && arguments[1].sendEncodings;
      if (sendEncodings === void 0) {
        sendEncodings = [];
      }
      sendEncodings = [...sendEncodings];
      const shouldPerformCheck = sendEncodings.length > 0;
      if (shouldPerformCheck) {
        sendEncodings.forEach((encodingParam) => {
          if ("rid" in encodingParam) {
            const ridRegex = /^[a-z0-9]{0,16}$/i;
            if (!ridRegex.test(encodingParam.rid)) {
              throw new TypeError("Invalid RID value provided.");
            }
          }
          if ("scaleResolutionDownBy" in encodingParam) {
            if (!(parseFloat(encodingParam.scaleResolutionDownBy) >= 1)) {
              throw new RangeError("scale_resolution_down_by must be >= 1.0");
            }
          }
          if ("maxFramerate" in encodingParam) {
            if (!(parseFloat(encodingParam.maxFramerate) >= 0)) {
              throw new RangeError("max_framerate must be >= 0.0");
            }
          }
        });
      }
      const transceiver = origAddTransceiver.apply(this, arguments);
      if (shouldPerformCheck) {
        const { sender } = transceiver;
        const params = sender.getParameters();
        if (!("encodings" in params) || // Avoid being fooled by patched getParameters() below.
        params.encodings.length === 1 && Object.keys(params.encodings[0]).length === 0) {
          params.encodings = sendEncodings;
          sender.sendEncodings = sendEncodings;
          this.setParametersPromises.push(
            sender.setParameters(params).then(() => {
              delete sender.sendEncodings;
            }).catch(() => {
              delete sender.sendEncodings;
            })
          );
        }
      }
      return transceiver;
    };
  }
}
function shimGetParameters(window2) {
  if (!(typeof window2 === "object" && window2.RTCRtpSender)) {
    return;
  }
  const origGetParameters = window2.RTCRtpSender.prototype.getParameters;
  if (origGetParameters) {
    window2.RTCRtpSender.prototype.getParameters = function getParameters() {
      const params = origGetParameters.apply(this, arguments);
      if (!("encodings" in params)) {
        params.encodings = [].concat(this.sendEncodings || [{}]);
      }
      return params;
    };
  }
}
function shimCreateOffer(window2) {
  if (!(typeof window2 === "object" && window2.RTCPeerConnection)) {
    return;
  }
  const origCreateOffer = window2.RTCPeerConnection.prototype.createOffer;
  window2.RTCPeerConnection.prototype.createOffer = function createOffer() {
    if (this.setParametersPromises && this.setParametersPromises.length) {
      return Promise.all(this.setParametersPromises).then(() => {
        return origCreateOffer.apply(this, arguments);
      }).finally(() => {
        this.setParametersPromises = [];
      });
    }
    return origCreateOffer.apply(this, arguments);
  };
}
function shimCreateAnswer(window2) {
  if (!(typeof window2 === "object" && window2.RTCPeerConnection)) {
    return;
  }
  const origCreateAnswer = window2.RTCPeerConnection.prototype.createAnswer;
  window2.RTCPeerConnection.prototype.createAnswer = function createAnswer() {
    if (this.setParametersPromises && this.setParametersPromises.length) {
      return Promise.all(this.setParametersPromises).then(() => {
        return origCreateAnswer.apply(this, arguments);
      }).finally(() => {
        this.setParametersPromises = [];
      });
    }
    return origCreateAnswer.apply(this, arguments);
  };
}

// node_modules/webrtc-adapter/src/js/safari/safari_shim.js
var safari_shim_exports = {};
__export(safari_shim_exports, {
  shimAudioContext: () => shimAudioContext,
  shimCallbacksAPI: () => shimCallbacksAPI,
  shimConstraints: () => shimConstraints,
  shimCreateOfferLegacy: () => shimCreateOfferLegacy,
  shimGetUserMedia: () => shimGetUserMedia3,
  shimLocalStreamsAPI: () => shimLocalStreamsAPI,
  shimRTCIceServerUrls: () => shimRTCIceServerUrls,
  shimRemoteStreamsAPI: () => shimRemoteStreamsAPI,
  shimTrackEventTransceiver: () => shimTrackEventTransceiver
});
function shimLocalStreamsAPI(window2) {
  if (typeof window2 !== "object" || !window2.RTCPeerConnection) {
    return;
  }
  if (!("getLocalStreams" in window2.RTCPeerConnection.prototype)) {
    window2.RTCPeerConnection.prototype.getLocalStreams = function getLocalStreams() {
      if (!this._localStreams) {
        this._localStreams = [];
      }
      return this._localStreams;
    };
  }
  if (!("addStream" in window2.RTCPeerConnection.prototype)) {
    const _addTrack = window2.RTCPeerConnection.prototype.addTrack;
    window2.RTCPeerConnection.prototype.addStream = function addStream(stream) {
      if (!this._localStreams) {
        this._localStreams = [];
      }
      if (!this._localStreams.includes(stream)) {
        this._localStreams.push(stream);
      }
      stream.getAudioTracks().forEach((track) => _addTrack.call(
        this,
        track,
        stream
      ));
      stream.getVideoTracks().forEach((track) => _addTrack.call(
        this,
        track,
        stream
      ));
    };
    window2.RTCPeerConnection.prototype.addTrack = function addTrack(track, ...streams) {
      if (streams) {
        streams.forEach((stream) => {
          if (!this._localStreams) {
            this._localStreams = [stream];
          } else if (!this._localStreams.includes(stream)) {
            this._localStreams.push(stream);
          }
        });
      }
      return _addTrack.apply(this, arguments);
    };
  }
  if (!("removeStream" in window2.RTCPeerConnection.prototype)) {
    window2.RTCPeerConnection.prototype.removeStream = function removeStream(stream) {
      if (!this._localStreams) {
        this._localStreams = [];
      }
      const index = this._localStreams.indexOf(stream);
      if (index === -1) {
        return;
      }
      this._localStreams.splice(index, 1);
      const tracks = stream.getTracks();
      this.getSenders().forEach((sender) => {
        if (tracks.includes(sender.track)) {
          this.removeTrack(sender);
        }
      });
    };
  }
}
function shimRemoteStreamsAPI(window2) {
  if (typeof window2 !== "object" || !window2.RTCPeerConnection) {
    return;
  }
  if (!("getRemoteStreams" in window2.RTCPeerConnection.prototype)) {
    window2.RTCPeerConnection.prototype.getRemoteStreams = function getRemoteStreams() {
      return this._remoteStreams ? this._remoteStreams : [];
    };
  }
  if (!("onaddstream" in window2.RTCPeerConnection.prototype)) {
    Object.defineProperty(window2.RTCPeerConnection.prototype, "onaddstream", {
      get() {
        return this._onaddstream;
      },
      set(f) {
        if (this._onaddstream) {
          this.removeEventListener("addstream", this._onaddstream);
          this.removeEventListener("track", this._onaddstreampoly);
        }
        this.addEventListener("addstream", this._onaddstream = f);
        this.addEventListener("track", this._onaddstreampoly = (e) => {
          e.streams.forEach((stream) => {
            if (!this._remoteStreams) {
              this._remoteStreams = [];
            }
            if (this._remoteStreams.includes(stream)) {
              return;
            }
            this._remoteStreams.push(stream);
            const event = new Event("addstream");
            event.stream = stream;
            this.dispatchEvent(event);
          });
        });
      }
    });
    const origSetRemoteDescription = window2.RTCPeerConnection.prototype.setRemoteDescription;
    window2.RTCPeerConnection.prototype.setRemoteDescription = function setRemoteDescription() {
      const pc = this;
      if (!this._onaddstreampoly) {
        this.addEventListener("track", this._onaddstreampoly = function(e) {
          e.streams.forEach((stream) => {
            if (!pc._remoteStreams) {
              pc._remoteStreams = [];
            }
            if (pc._remoteStreams.indexOf(stream) >= 0) {
              return;
            }
            pc._remoteStreams.push(stream);
            const event = new Event("addstream");
            event.stream = stream;
            pc.dispatchEvent(event);
          });
        });
      }
      return origSetRemoteDescription.apply(pc, arguments);
    };
  }
}
function shimCallbacksAPI(window2) {
  if (typeof window2 !== "object" || !window2.RTCPeerConnection) {
    return;
  }
  const prototype = window2.RTCPeerConnection.prototype;
  const origCreateOffer = prototype.createOffer;
  const origCreateAnswer = prototype.createAnswer;
  const setLocalDescription = prototype.setLocalDescription;
  const setRemoteDescription = prototype.setRemoteDescription;
  const addIceCandidate = prototype.addIceCandidate;
  prototype.createOffer = function createOffer(successCallback, failureCallback) {
    const options = arguments.length >= 2 ? arguments[2] : arguments[0];
    const promise = origCreateOffer.apply(this, [options]);
    if (!failureCallback) {
      return promise;
    }
    promise.then(successCallback, failureCallback);
    return Promise.resolve();
  };
  prototype.createAnswer = function createAnswer(successCallback, failureCallback) {
    const options = arguments.length >= 2 ? arguments[2] : arguments[0];
    const promise = origCreateAnswer.apply(this, [options]);
    if (!failureCallback) {
      return promise;
    }
    promise.then(successCallback, failureCallback);
    return Promise.resolve();
  };
  let withCallback = function(description, successCallback, failureCallback) {
    const promise = setLocalDescription.apply(this, [description]);
    if (!failureCallback) {
      return promise;
    }
    promise.then(successCallback, failureCallback);
    return Promise.resolve();
  };
  prototype.setLocalDescription = withCallback;
  withCallback = function(description, successCallback, failureCallback) {
    const promise = setRemoteDescription.apply(this, [description]);
    if (!failureCallback) {
      return promise;
    }
    promise.then(successCallback, failureCallback);
    return Promise.resolve();
  };
  prototype.setRemoteDescription = withCallback;
  withCallback = function(candidate, successCallback, failureCallback) {
    const promise = addIceCandidate.apply(this, [candidate]);
    if (!failureCallback) {
      return promise;
    }
    promise.then(successCallback, failureCallback);
    return Promise.resolve();
  };
  prototype.addIceCandidate = withCallback;
}
function shimGetUserMedia3(window2) {
  const navigator2 = window2 && window2.navigator;
  if (navigator2.mediaDevices && navigator2.mediaDevices.getUserMedia) {
    const mediaDevices = navigator2.mediaDevices;
    const _getUserMedia = mediaDevices.getUserMedia.bind(mediaDevices);
    navigator2.mediaDevices.getUserMedia = (constraints) => {
      return _getUserMedia(shimConstraints(constraints));
    };
  }
  if (!navigator2.getUserMedia && navigator2.mediaDevices && navigator2.mediaDevices.getUserMedia) {
    navigator2.getUserMedia = function getUserMedia(constraints, cb, errcb) {
      navigator2.mediaDevices.getUserMedia(constraints).then(cb, errcb);
    }.bind(navigator2);
  }
}
function shimConstraints(constraints) {
  if (constraints && constraints.video !== void 0) {
    return Object.assign(
      {},
      constraints,
      { video: compactObject(constraints.video) }
    );
  }
  return constraints;
}
function shimRTCIceServerUrls(window2) {
  if (!window2.RTCPeerConnection) {
    return;
  }
  const OrigPeerConnection = window2.RTCPeerConnection;
  window2.RTCPeerConnection = function RTCPeerConnection2(pcConfig, pcConstraints) {
    if (pcConfig && pcConfig.iceServers) {
      const newIceServers = [];
      for (let i = 0; i < pcConfig.iceServers.length; i++) {
        let server = pcConfig.iceServers[i];
        if (server.urls === void 0 && server.url) {
          deprecated("RTCIceServer.url", "RTCIceServer.urls");
          server = JSON.parse(JSON.stringify(server));
          server.urls = server.url;
          delete server.url;
          newIceServers.push(server);
        } else {
          newIceServers.push(pcConfig.iceServers[i]);
        }
      }
      pcConfig.iceServers = newIceServers;
    }
    return new OrigPeerConnection(pcConfig, pcConstraints);
  };
  window2.RTCPeerConnection.prototype = OrigPeerConnection.prototype;
  if ("generateCertificate" in OrigPeerConnection) {
    Object.defineProperty(window2.RTCPeerConnection, "generateCertificate", {
      get() {
        return OrigPeerConnection.generateCertificate;
      }
    });
  }
}
function shimTrackEventTransceiver(window2) {
  if (typeof window2 === "object" && window2.RTCTrackEvent && "receiver" in window2.RTCTrackEvent.prototype && !("transceiver" in window2.RTCTrackEvent.prototype)) {
    Object.defineProperty(window2.RTCTrackEvent.prototype, "transceiver", {
      get() {
        return { receiver: this.receiver };
      }
    });
  }
}
function shimCreateOfferLegacy(window2) {
  const origCreateOffer = window2.RTCPeerConnection.prototype.createOffer;
  window2.RTCPeerConnection.prototype.createOffer = function createOffer(offerOptions) {
    if (offerOptions) {
      if (typeof offerOptions.offerToReceiveAudio !== "undefined") {
        offerOptions.offerToReceiveAudio = !!offerOptions.offerToReceiveAudio;
      }
      const audioTransceiver = this.getTransceivers().find((transceiver) => transceiver.receiver.track.kind === "audio");
      if (offerOptions.offerToReceiveAudio === false && audioTransceiver) {
        if (audioTransceiver.direction === "sendrecv") {
          if (audioTransceiver.setDirection) {
            audioTransceiver.setDirection("sendonly");
          } else {
            audioTransceiver.direction = "sendonly";
          }
        } else if (audioTransceiver.direction === "recvonly") {
          if (audioTransceiver.setDirection) {
            audioTransceiver.setDirection("inactive");
          } else {
            audioTransceiver.direction = "inactive";
          }
        }
      } else if (offerOptions.offerToReceiveAudio === true && !audioTransceiver) {
        this.addTransceiver("audio", { direction: "recvonly" });
      }
      if (typeof offerOptions.offerToReceiveVideo !== "undefined") {
        offerOptions.offerToReceiveVideo = !!offerOptions.offerToReceiveVideo;
      }
      const videoTransceiver = this.getTransceivers().find((transceiver) => transceiver.receiver.track.kind === "video");
      if (offerOptions.offerToReceiveVideo === false && videoTransceiver) {
        if (videoTransceiver.direction === "sendrecv") {
          if (videoTransceiver.setDirection) {
            videoTransceiver.setDirection("sendonly");
          } else {
            videoTransceiver.direction = "sendonly";
          }
        } else if (videoTransceiver.direction === "recvonly") {
          if (videoTransceiver.setDirection) {
            videoTransceiver.setDirection("inactive");
          } else {
            videoTransceiver.direction = "inactive";
          }
        }
      } else if (offerOptions.offerToReceiveVideo === true && !videoTransceiver) {
        this.addTransceiver("video", { direction: "recvonly" });
      }
    }
    return origCreateOffer.apply(this, arguments);
  };
}
function shimAudioContext(window2) {
  if (typeof window2 !== "object" || window2.AudioContext) {
    return;
  }
  window2.AudioContext = window2.webkitAudioContext;
}

// node_modules/webrtc-adapter/src/js/common_shim.js
var common_shim_exports = {};
__export(common_shim_exports, {
  removeExtmapAllowMixed: () => removeExtmapAllowMixed,
  shimAddIceCandidateNullOrEmpty: () => shimAddIceCandidateNullOrEmpty,
  shimConnectionState: () => shimConnectionState,
  shimMaxMessageSize: () => shimMaxMessageSize,
  shimParameterlessSetLocalDescription: () => shimParameterlessSetLocalDescription,
  shimRTCIceCandidate: () => shimRTCIceCandidate,
  shimRTCIceCandidateRelayProtocol: () => shimRTCIceCandidateRelayProtocol,
  shimSendThrowTypeError: () => shimSendThrowTypeError
});
var import_sdp = __toESM(require_sdp());
function shimRTCIceCandidate(window2) {
  if (!window2.RTCIceCandidate || window2.RTCIceCandidate && "foundation" in window2.RTCIceCandidate.prototype) {
    return;
  }
  const NativeRTCIceCandidate = window2.RTCIceCandidate;
  window2.RTCIceCandidate = function RTCIceCandidate(args) {
    if (typeof args === "object" && args.candidate && args.candidate.indexOf("a=") === 0) {
      args = JSON.parse(JSON.stringify(args));
      args.candidate = args.candidate.substring(2);
    }
    if (args.candidate && args.candidate.length) {
      const nativeCandidate = new NativeRTCIceCandidate(args);
      const parsedCandidate = import_sdp.default.parseCandidate(args.candidate);
      for (const key in parsedCandidate) {
        if (!(key in nativeCandidate)) {
          Object.defineProperty(
            nativeCandidate,
            key,
            { value: parsedCandidate[key] }
          );
        }
      }
      nativeCandidate.toJSON = function toJSON() {
        return {
          candidate: nativeCandidate.candidate,
          sdpMid: nativeCandidate.sdpMid,
          sdpMLineIndex: nativeCandidate.sdpMLineIndex,
          usernameFragment: nativeCandidate.usernameFragment
        };
      };
      return nativeCandidate;
    }
    return new NativeRTCIceCandidate(args);
  };
  window2.RTCIceCandidate.prototype = NativeRTCIceCandidate.prototype;
  wrapPeerConnectionEvent(window2, "icecandidate", (e) => {
    if (e.candidate) {
      Object.defineProperty(e, "candidate", {
        value: new window2.RTCIceCandidate(e.candidate),
        writable: "false"
      });
    }
    return e;
  });
}
function shimRTCIceCandidateRelayProtocol(window2) {
  if (!window2.RTCIceCandidate || window2.RTCIceCandidate && "relayProtocol" in window2.RTCIceCandidate.prototype) {
    return;
  }
  wrapPeerConnectionEvent(window2, "icecandidate", (e) => {
    if (e.candidate) {
      const parsedCandidate = import_sdp.default.parseCandidate(e.candidate.candidate);
      if (parsedCandidate.type === "relay") {
        e.candidate.relayProtocol = {
          0: "tls",
          1: "tcp",
          2: "udp"
        }[parsedCandidate.priority >> 24];
      }
    }
    return e;
  });
}
function shimMaxMessageSize(window2, browserDetails) {
  if (!window2.RTCPeerConnection) {
    return;
  }
  if (!("sctp" in window2.RTCPeerConnection.prototype)) {
    Object.defineProperty(window2.RTCPeerConnection.prototype, "sctp", {
      get() {
        return typeof this._sctp === "undefined" ? null : this._sctp;
      }
    });
  }
  const sctpInDescription = function(description) {
    if (!description || !description.sdp) {
      return false;
    }
    const sections = import_sdp.default.splitSections(description.sdp);
    sections.shift();
    return sections.some((mediaSection) => {
      const mLine = import_sdp.default.parseMLine(mediaSection);
      return mLine && mLine.kind === "application" && mLine.protocol.indexOf("SCTP") !== -1;
    });
  };
  const getRemoteFirefoxVersion = function(description) {
    const match = description.sdp.match(/mozilla...THIS_IS_SDPARTA-(\d+)/);
    if (match === null || match.length < 2) {
      return -1;
    }
    const version = parseInt(match[1], 10);
    return version !== version ? -1 : version;
  };
  const getCanSendMaxMessageSize = function(remoteIsFirefox) {
    let canSendMaxMessageSize = 65536;
    if (browserDetails.browser === "firefox") {
      if (browserDetails.version < 57) {
        if (remoteIsFirefox === -1) {
          canSendMaxMessageSize = 16384;
        } else {
          canSendMaxMessageSize = 2147483637;
        }
      } else if (browserDetails.version < 60) {
        canSendMaxMessageSize = browserDetails.version === 57 ? 65535 : 65536;
      } else {
        canSendMaxMessageSize = 2147483637;
      }
    }
    return canSendMaxMessageSize;
  };
  const getMaxMessageSize = function(description, remoteIsFirefox) {
    let maxMessageSize = 65536;
    if (browserDetails.browser === "firefox" && browserDetails.version === 57) {
      maxMessageSize = 65535;
    }
    const match = import_sdp.default.matchPrefix(
      description.sdp,
      "a=max-message-size:"
    );
    if (match.length > 0) {
      maxMessageSize = parseInt(match[0].substring(19), 10);
    } else if (browserDetails.browser === "firefox" && remoteIsFirefox !== -1) {
      maxMessageSize = 2147483637;
    }
    return maxMessageSize;
  };
  const origSetRemoteDescription = window2.RTCPeerConnection.prototype.setRemoteDescription;
  window2.RTCPeerConnection.prototype.setRemoteDescription = function setRemoteDescription() {
    this._sctp = null;
    if (browserDetails.browser === "chrome" && browserDetails.version >= 76) {
      const { sdpSemantics } = this.getConfiguration();
      if (sdpSemantics === "plan-b") {
        Object.defineProperty(this, "sctp", {
          get() {
            return typeof this._sctp === "undefined" ? null : this._sctp;
          },
          enumerable: true,
          configurable: true
        });
      }
    }
    if (sctpInDescription(arguments[0])) {
      const isFirefox = getRemoteFirefoxVersion(arguments[0]);
      const canSendMMS = getCanSendMaxMessageSize(isFirefox);
      const remoteMMS = getMaxMessageSize(arguments[0], isFirefox);
      let maxMessageSize;
      if (canSendMMS === 0 && remoteMMS === 0) {
        maxMessageSize = Number.POSITIVE_INFINITY;
      } else if (canSendMMS === 0 || remoteMMS === 0) {
        maxMessageSize = Math.max(canSendMMS, remoteMMS);
      } else {
        maxMessageSize = Math.min(canSendMMS, remoteMMS);
      }
      const sctp = {};
      Object.defineProperty(sctp, "maxMessageSize", {
        get() {
          return maxMessageSize;
        }
      });
      this._sctp = sctp;
    }
    return origSetRemoteDescription.apply(this, arguments);
  };
}
function shimSendThrowTypeError(window2) {
  if (!(window2.RTCPeerConnection && "createDataChannel" in window2.RTCPeerConnection.prototype)) {
    return;
  }
  function wrapDcSend(dc, pc) {
    const origDataChannelSend = dc.send;
    dc.send = function send() {
      const data = arguments[0];
      const length = data.length || data.size || data.byteLength;
      if (dc.readyState === "open" && pc.sctp && length > pc.sctp.maxMessageSize) {
        throw new TypeError("Message too large (can send a maximum of " + pc.sctp.maxMessageSize + " bytes)");
      }
      return origDataChannelSend.apply(dc, arguments);
    };
  }
  const origCreateDataChannel = window2.RTCPeerConnection.prototype.createDataChannel;
  window2.RTCPeerConnection.prototype.createDataChannel = function createDataChannel() {
    const dataChannel = origCreateDataChannel.apply(this, arguments);
    wrapDcSend(dataChannel, this);
    return dataChannel;
  };
  wrapPeerConnectionEvent(window2, "datachannel", (e) => {
    wrapDcSend(e.channel, e.target);
    return e;
  });
}
function shimConnectionState(window2) {
  if (!window2.RTCPeerConnection || "connectionState" in window2.RTCPeerConnection.prototype) {
    return;
  }
  const proto = window2.RTCPeerConnection.prototype;
  Object.defineProperty(proto, "connectionState", {
    get() {
      return {
        completed: "connected",
        checking: "connecting"
      }[this.iceConnectionState] || this.iceConnectionState;
    },
    enumerable: true,
    configurable: true
  });
  Object.defineProperty(proto, "onconnectionstatechange", {
    get() {
      return this._onconnectionstatechange || null;
    },
    set(cb) {
      if (this._onconnectionstatechange) {
        this.removeEventListener(
          "connectionstatechange",
          this._onconnectionstatechange
        );
        delete this._onconnectionstatechange;
      }
      if (cb) {
        this.addEventListener(
          "connectionstatechange",
          this._onconnectionstatechange = cb
        );
      }
    },
    enumerable: true,
    configurable: true
  });
  ["setLocalDescription", "setRemoteDescription"].forEach((method) => {
    const origMethod = proto[method];
    proto[method] = function() {
      if (!this._connectionstatechangepoly) {
        this._connectionstatechangepoly = (e) => {
          const pc = e.target;
          if (pc._lastConnectionState !== pc.connectionState) {
            pc._lastConnectionState = pc.connectionState;
            const newEvent = new Event("connectionstatechange", e);
            pc.dispatchEvent(newEvent);
          }
          return e;
        };
        this.addEventListener(
          "iceconnectionstatechange",
          this._connectionstatechangepoly
        );
      }
      return origMethod.apply(this, arguments);
    };
  });
}
function removeExtmapAllowMixed(window2, browserDetails) {
  if (!window2.RTCPeerConnection) {
    return;
  }
  if (browserDetails.browser === "chrome" && browserDetails.version >= 71) {
    return;
  }
  if (browserDetails.browser === "safari" && browserDetails._safariVersion >= 13.1) {
    return;
  }
  const nativeSRD = window2.RTCPeerConnection.prototype.setRemoteDescription;
  window2.RTCPeerConnection.prototype.setRemoteDescription = function setRemoteDescription(desc) {
    if (desc && desc.sdp && desc.sdp.indexOf("\na=extmap-allow-mixed") !== -1) {
      const sdp2 = desc.sdp.split("\n").filter((line) => {
        return line.trim() !== "a=extmap-allow-mixed";
      }).join("\n");
      if (window2.RTCSessionDescription && desc instanceof window2.RTCSessionDescription) {
        arguments[0] = new window2.RTCSessionDescription({
          type: desc.type,
          sdp: sdp2
        });
      } else {
        desc.sdp = sdp2;
      }
    }
    return nativeSRD.apply(this, arguments);
  };
}
function shimAddIceCandidateNullOrEmpty(window2, browserDetails) {
  if (!(window2.RTCPeerConnection && window2.RTCPeerConnection.prototype)) {
    return;
  }
  const nativeAddIceCandidate = window2.RTCPeerConnection.prototype.addIceCandidate;
  if (!nativeAddIceCandidate || nativeAddIceCandidate.length === 0) {
    return;
  }
  window2.RTCPeerConnection.prototype.addIceCandidate = function addIceCandidate() {
    if (!arguments[0]) {
      if (arguments[1]) {
        arguments[1].apply(null);
      }
      return Promise.resolve();
    }
    if ((browserDetails.browser === "chrome" && browserDetails.version < 78 || browserDetails.browser === "firefox" && browserDetails.version < 68 || browserDetails.browser === "safari") && arguments[0] && arguments[0].candidate === "") {
      return Promise.resolve();
    }
    return nativeAddIceCandidate.apply(this, arguments);
  };
}
function shimParameterlessSetLocalDescription(window2, browserDetails) {
  if (!(window2.RTCPeerConnection && window2.RTCPeerConnection.prototype)) {
    return;
  }
  const nativeSetLocalDescription = window2.RTCPeerConnection.prototype.setLocalDescription;
  if (!nativeSetLocalDescription || nativeSetLocalDescription.length === 0) {
    return;
  }
  window2.RTCPeerConnection.prototype.setLocalDescription = function setLocalDescription() {
    let desc = arguments[0] || {};
    if (typeof desc !== "object" || desc.type && desc.sdp) {
      return nativeSetLocalDescription.apply(this, arguments);
    }
    desc = { type: desc.type, sdp: desc.sdp };
    if (!desc.type) {
      switch (this.signalingState) {
        case "stable":
        case "have-local-offer":
        case "have-remote-pranswer":
          desc.type = "offer";
          break;
        default:
          desc.type = "answer";
          break;
      }
    }
    if (desc.sdp || desc.type !== "offer" && desc.type !== "answer") {
      return nativeSetLocalDescription.apply(this, [desc]);
    }
    const func = desc.type === "offer" ? this.createOffer : this.createAnswer;
    return func.apply(this).then((d) => nativeSetLocalDescription.apply(this, [d]));
  };
}

// node_modules/webrtc-adapter/src/js/adapter_factory.js
var sdp = __toESM(require_sdp());
function adapterFactory({ window: window2 } = {}, options = {
  shimChrome: true,
  shimFirefox: true,
  shimSafari: true
}) {
  const logging2 = log;
  const browserDetails = detectBrowser(window2);
  const adapter2 = {
    browserDetails,
    commonShim: common_shim_exports,
    extractVersion,
    disableLog,
    disableWarnings,
    // Expose sdp as a convenience. For production apps include directly.
    sdp
  };
  switch (browserDetails.browser) {
    case "chrome":
      if (!chrome_shim_exports || !shimPeerConnection || !options.shimChrome) {
        logging2("Chrome shim is not included in this adapter release.");
        return adapter2;
      }
      if (browserDetails.version === null) {
        logging2("Chrome shim can not determine version, not shimming.");
        return adapter2;
      }
      logging2("adapter.js shimming chrome.");
      adapter2.browserShim = chrome_shim_exports;
      shimAddIceCandidateNullOrEmpty(window2, browserDetails);
      shimParameterlessSetLocalDescription(window2, browserDetails);
      shimGetUserMedia(window2, browserDetails);
      shimMediaStream(window2, browserDetails);
      shimPeerConnection(window2, browserDetails);
      shimOnTrack(window2, browserDetails);
      shimAddTrackRemoveTrack(window2, browserDetails);
      shimGetSendersWithDtmf(window2, browserDetails);
      shimSenderReceiverGetStats(window2, browserDetails);
      fixNegotiationNeeded(window2, browserDetails);
      shimRTCIceCandidate(window2, browserDetails);
      shimRTCIceCandidateRelayProtocol(window2, browserDetails);
      shimConnectionState(window2, browserDetails);
      shimMaxMessageSize(window2, browserDetails);
      shimSendThrowTypeError(window2, browserDetails);
      removeExtmapAllowMixed(window2, browserDetails);
      break;
    case "firefox":
      if (!firefox_shim_exports || !shimPeerConnection2 || !options.shimFirefox) {
        logging2("Firefox shim is not included in this adapter release.");
        return adapter2;
      }
      logging2("adapter.js shimming firefox.");
      adapter2.browserShim = firefox_shim_exports;
      shimAddIceCandidateNullOrEmpty(window2, browserDetails);
      shimParameterlessSetLocalDescription(window2, browserDetails);
      shimGetUserMedia2(window2, browserDetails);
      shimPeerConnection2(window2, browserDetails);
      shimOnTrack2(window2, browserDetails);
      shimRemoveStream(window2, browserDetails);
      shimSenderGetStats(window2, browserDetails);
      shimReceiverGetStats(window2, browserDetails);
      shimRTCDataChannel(window2, browserDetails);
      shimAddTransceiver(window2, browserDetails);
      shimGetParameters(window2, browserDetails);
      shimCreateOffer(window2, browserDetails);
      shimCreateAnswer(window2, browserDetails);
      shimRTCIceCandidate(window2, browserDetails);
      shimConnectionState(window2, browserDetails);
      shimMaxMessageSize(window2, browserDetails);
      shimSendThrowTypeError(window2, browserDetails);
      break;
    case "safari":
      if (!safari_shim_exports || !options.shimSafari) {
        logging2("Safari shim is not included in this adapter release.");
        return adapter2;
      }
      logging2("adapter.js shimming safari.");
      adapter2.browserShim = safari_shim_exports;
      shimAddIceCandidateNullOrEmpty(window2, browserDetails);
      shimParameterlessSetLocalDescription(window2, browserDetails);
      shimRTCIceServerUrls(window2, browserDetails);
      shimCreateOfferLegacy(window2, browserDetails);
      shimCallbacksAPI(window2, browserDetails);
      shimLocalStreamsAPI(window2, browserDetails);
      shimRemoteStreamsAPI(window2, browserDetails);
      shimTrackEventTransceiver(window2, browserDetails);
      shimGetUserMedia3(window2, browserDetails);
      shimAudioContext(window2, browserDetails);
      shimRTCIceCandidate(window2, browserDetails);
      shimRTCIceCandidateRelayProtocol(window2, browserDetails);
      shimMaxMessageSize(window2, browserDetails);
      shimSendThrowTypeError(window2, browserDetails);
      removeExtmapAllowMixed(window2, browserDetails);
      break;
    default:
      logging2("Unsupported browser!");
      break;
  }
  return adapter2;
}

// node_modules/webrtc-adapter/src/js/adapter_core.js
var adapter = adapterFactory({ window: typeof window === "undefined" ? void 0 : window });
var adapter_core_default = adapter;

// node_modules/peerjs/dist/bundler.mjs
function $parcel$export(e, n, v, s) {
  Object.defineProperty(e, n, { get: v, set: s, enumerable: true, configurable: true });
}
var $fcbcc7538a6776d5$export$f1c5f4c9cb95390b = class {
  constructor() {
    this.chunkedMTU = 16300;
    this._dataCount = 1;
    this.chunk = (blob) => {
      const chunks = [];
      const size = blob.byteLength;
      const total = Math.ceil(size / this.chunkedMTU);
      let index = 0;
      let start = 0;
      while (start < size) {
        const end = Math.min(size, start + this.chunkedMTU);
        const b = blob.slice(start, end);
        const chunk = {
          __peerData: this._dataCount,
          n: index,
          data: b,
          total
        };
        chunks.push(chunk);
        start = end;
        index++;
      }
      this._dataCount++;
      return chunks;
    };
  }
};
function $fcbcc7538a6776d5$export$52c89ebcdc4f53f2(bufs) {
  let size = 0;
  for (const buf of bufs) size += buf.byteLength;
  const result = new Uint8Array(size);
  let offset = 0;
  for (const buf of bufs) {
    result.set(buf, offset);
    offset += buf.byteLength;
  }
  return result;
}
var $fb63e766cfafaab9$var$webRTCAdapter = (
  //@ts-ignore
  (0, adapter_core_default).default || (0, adapter_core_default)
);
var $fb63e766cfafaab9$export$25be9502477c137d = new class {
  isWebRTCSupported() {
    return typeof RTCPeerConnection !== "undefined";
  }
  isBrowserSupported() {
    const browser = this.getBrowser();
    const version = this.getVersion();
    const validBrowser = this.supportedBrowsers.includes(browser);
    if (!validBrowser) return false;
    if (browser === "chrome") return version >= this.minChromeVersion;
    if (browser === "firefox") return version >= this.minFirefoxVersion;
    if (browser === "safari") return !this.isIOS && version >= this.minSafariVersion;
    return false;
  }
  getBrowser() {
    return $fb63e766cfafaab9$var$webRTCAdapter.browserDetails.browser;
  }
  getVersion() {
    return $fb63e766cfafaab9$var$webRTCAdapter.browserDetails.version || 0;
  }
  isUnifiedPlanSupported() {
    const browser = this.getBrowser();
    const version = $fb63e766cfafaab9$var$webRTCAdapter.browserDetails.version || 0;
    if (browser === "chrome" && version < this.minChromeVersion) return false;
    if (browser === "firefox" && version >= this.minFirefoxVersion) return true;
    if (!window.RTCRtpTransceiver || !("currentDirection" in RTCRtpTransceiver.prototype)) return false;
    let tempPc;
    let supported = false;
    try {
      tempPc = new RTCPeerConnection();
      tempPc.addTransceiver("audio");
      supported = true;
    } catch (e) {
    } finally {
      if (tempPc) tempPc.close();
    }
    return supported;
  }
  toString() {
    return `Supports:
    browser:${this.getBrowser()}
    version:${this.getVersion()}
    isIOS:${this.isIOS}
    isWebRTCSupported:${this.isWebRTCSupported()}
    isBrowserSupported:${this.isBrowserSupported()}
    isUnifiedPlanSupported:${this.isUnifiedPlanSupported()}`;
  }
  constructor() {
    this.isIOS = typeof navigator !== "undefined" ? [
      "iPad",
      "iPhone",
      "iPod"
    ].includes(navigator.platform) : false;
    this.supportedBrowsers = [
      "firefox",
      "chrome",
      "safari"
    ];
    this.minFirefoxVersion = 59;
    this.minChromeVersion = 72;
    this.minSafariVersion = 605;
  }
}();
var $9a84a32bf0bf36bb$export$f35f128fd59ea256 = (id) => {
  return !id || /^[A-Za-z0-9]+(?:[ _-][A-Za-z0-9]+)*$/.test(id);
};
var $0e5fd1585784c252$export$4e61f672936bec77 = () => Math.random().toString(36).slice(2);
var $4f4134156c446392$var$DEFAULT_CONFIG = {
  iceServers: [
    {
      urls: "stun:stun.l.google.com:19302"
    },
    {
      urls: [
        "turn:eu-0.turn.peerjs.com:3478",
        "turn:us-0.turn.peerjs.com:3478"
      ],
      username: "peerjs",
      credential: "peerjsp"
    }
  ],
  sdpSemantics: "unified-plan"
};
var $4f4134156c446392$export$f8f26dd395d7e1bd = class extends (0, $fcbcc7538a6776d5$export$f1c5f4c9cb95390b) {
  noop() {
  }
  blobToArrayBuffer(blob, cb) {
    const fr = new FileReader();
    fr.onload = function(evt) {
      if (evt.target) cb(evt.target.result);
    };
    fr.readAsArrayBuffer(blob);
    return fr;
  }
  binaryStringToArrayBuffer(binary) {
    const byteArray = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) byteArray[i] = binary.charCodeAt(i) & 255;
    return byteArray.buffer;
  }
  isSecure() {
    return location.protocol === "https:";
  }
  constructor(...args) {
    super(...args), this.CLOUD_HOST = "0.peerjs.com", this.CLOUD_PORT = 443, // Browsers that need chunking:
    this.chunkedBrowsers = {
      Chrome: 1,
      chrome: 1
    }, // Returns browser-agnostic default config
    this.defaultConfig = $4f4134156c446392$var$DEFAULT_CONFIG, this.browser = (0, $fb63e766cfafaab9$export$25be9502477c137d).getBrowser(), this.browserVersion = (0, $fb63e766cfafaab9$export$25be9502477c137d).getVersion(), this.pack = $0cfd7828ad59115f$export$2a703dbb0cb35339, this.unpack = $0cfd7828ad59115f$export$417857010dc9287f, /**
    * A hash of WebRTC features mapped to booleans that correspond to whether the feature is supported by the current browser.
    *
    * :::caution
    * Only the properties documented here are guaranteed to be present on `util.supports`
    * :::
    */
    this.supports = (function() {
      const supported = {
        browser: (0, $fb63e766cfafaab9$export$25be9502477c137d).isBrowserSupported(),
        webRTC: (0, $fb63e766cfafaab9$export$25be9502477c137d).isWebRTCSupported(),
        audioVideo: false,
        data: false,
        binaryBlob: false,
        reliable: false
      };
      if (!supported.webRTC) return supported;
      let pc;
      try {
        pc = new RTCPeerConnection($4f4134156c446392$var$DEFAULT_CONFIG);
        supported.audioVideo = true;
        let dc;
        try {
          dc = pc.createDataChannel("_PEERJSTEST", {
            ordered: true
          });
          supported.data = true;
          supported.reliable = !!dc.ordered;
          try {
            dc.binaryType = "blob";
            supported.binaryBlob = !(0, $fb63e766cfafaab9$export$25be9502477c137d).isIOS;
          } catch (e) {
          }
        } catch (e) {
        } finally {
          if (dc) dc.close();
        }
      } catch (e) {
      } finally {
        if (pc) pc.close();
      }
      return supported;
    })(), // Ensure alphanumeric ids
    this.validateId = (0, $9a84a32bf0bf36bb$export$f35f128fd59ea256), this.randomToken = (0, $0e5fd1585784c252$export$4e61f672936bec77);
  }
};
var $4f4134156c446392$export$7debb50ef11d5e0b = new $4f4134156c446392$export$f8f26dd395d7e1bd();
var $257947e92926277a$var$LOG_PREFIX = "PeerJS: ";
var $257947e92926277a$var$Logger = class {
  get logLevel() {
    return this._logLevel;
  }
  set logLevel(logLevel) {
    this._logLevel = logLevel;
  }
  log(...args) {
    if (this._logLevel >= 3) this._print(3, ...args);
  }
  warn(...args) {
    if (this._logLevel >= 2) this._print(2, ...args);
  }
  error(...args) {
    if (this._logLevel >= 1) this._print(1, ...args);
  }
  setLogFunction(fn) {
    this._print = fn;
  }
  _print(logLevel, ...rest) {
    const copy = [
      $257947e92926277a$var$LOG_PREFIX,
      ...rest
    ];
    for (const i in copy) if (copy[i] instanceof Error) copy[i] = "(" + copy[i].name + ") " + copy[i].message;
    if (logLevel >= 3) console.log(...copy);
    else if (logLevel >= 2) console.warn("WARNING", ...copy);
    else if (logLevel >= 1) console.error("ERROR", ...copy);
  }
  constructor() {
    this._logLevel = 0;
  }
};
var $257947e92926277a$export$2e2bcd8739ae039 = new $257947e92926277a$var$Logger();
var $c4dcfd1d1ea86647$exports = {};
var $c4dcfd1d1ea86647$var$has = Object.prototype.hasOwnProperty;
var $c4dcfd1d1ea86647$var$prefix = "~";
function $c4dcfd1d1ea86647$var$Events() {
}
if (Object.create) {
  $c4dcfd1d1ea86647$var$Events.prototype = /* @__PURE__ */ Object.create(null);
  if (!new $c4dcfd1d1ea86647$var$Events().__proto__) $c4dcfd1d1ea86647$var$prefix = false;
}
function $c4dcfd1d1ea86647$var$EE(fn, context, once2) {
  this.fn = fn;
  this.context = context;
  this.once = once2 || false;
}
function $c4dcfd1d1ea86647$var$addListener(emitter, event, fn, context, once2) {
  if (typeof fn !== "function") throw new TypeError("The listener must be a function");
  var listener = new $c4dcfd1d1ea86647$var$EE(fn, context || emitter, once2), evt = $c4dcfd1d1ea86647$var$prefix ? $c4dcfd1d1ea86647$var$prefix + event : event;
  if (!emitter._events[evt]) emitter._events[evt] = listener, emitter._eventsCount++;
  else if (!emitter._events[evt].fn) emitter._events[evt].push(listener);
  else emitter._events[evt] = [
    emitter._events[evt],
    listener
  ];
  return emitter;
}
function $c4dcfd1d1ea86647$var$clearEvent(emitter, evt) {
  if (--emitter._eventsCount === 0) emitter._events = new $c4dcfd1d1ea86647$var$Events();
  else delete emitter._events[evt];
}
function $c4dcfd1d1ea86647$var$EventEmitter() {
  this._events = new $c4dcfd1d1ea86647$var$Events();
  this._eventsCount = 0;
}
$c4dcfd1d1ea86647$var$EventEmitter.prototype.eventNames = function eventNames() {
  var names = [], events, name;
  if (this._eventsCount === 0) return names;
  for (name in events = this._events) if ($c4dcfd1d1ea86647$var$has.call(events, name)) names.push($c4dcfd1d1ea86647$var$prefix ? name.slice(1) : name);
  if (Object.getOwnPropertySymbols) return names.concat(Object.getOwnPropertySymbols(events));
  return names;
};
$c4dcfd1d1ea86647$var$EventEmitter.prototype.listeners = function listeners(event) {
  var evt = $c4dcfd1d1ea86647$var$prefix ? $c4dcfd1d1ea86647$var$prefix + event : event, handlers = this._events[evt];
  if (!handlers) return [];
  if (handlers.fn) return [
    handlers.fn
  ];
  for (var i = 0, l = handlers.length, ee = new Array(l); i < l; i++) ee[i] = handlers[i].fn;
  return ee;
};
$c4dcfd1d1ea86647$var$EventEmitter.prototype.listenerCount = function listenerCount(event) {
  var evt = $c4dcfd1d1ea86647$var$prefix ? $c4dcfd1d1ea86647$var$prefix + event : event, listeners2 = this._events[evt];
  if (!listeners2) return 0;
  if (listeners2.fn) return 1;
  return listeners2.length;
};
$c4dcfd1d1ea86647$var$EventEmitter.prototype.emit = function emit(event, a1, a2, a3, a4, a5) {
  var evt = $c4dcfd1d1ea86647$var$prefix ? $c4dcfd1d1ea86647$var$prefix + event : event;
  if (!this._events[evt]) return false;
  var listeners2 = this._events[evt], len = arguments.length, args, i;
  if (listeners2.fn) {
    if (listeners2.once) this.removeListener(event, listeners2.fn, void 0, true);
    switch (len) {
      case 1:
        return listeners2.fn.call(listeners2.context), true;
      case 2:
        return listeners2.fn.call(listeners2.context, a1), true;
      case 3:
        return listeners2.fn.call(listeners2.context, a1, a2), true;
      case 4:
        return listeners2.fn.call(listeners2.context, a1, a2, a3), true;
      case 5:
        return listeners2.fn.call(listeners2.context, a1, a2, a3, a4), true;
      case 6:
        return listeners2.fn.call(listeners2.context, a1, a2, a3, a4, a5), true;
    }
    for (i = 1, args = new Array(len - 1); i < len; i++) args[i - 1] = arguments[i];
    listeners2.fn.apply(listeners2.context, args);
  } else {
    var length = listeners2.length, j;
    for (i = 0; i < length; i++) {
      if (listeners2[i].once) this.removeListener(event, listeners2[i].fn, void 0, true);
      switch (len) {
        case 1:
          listeners2[i].fn.call(listeners2[i].context);
          break;
        case 2:
          listeners2[i].fn.call(listeners2[i].context, a1);
          break;
        case 3:
          listeners2[i].fn.call(listeners2[i].context, a1, a2);
          break;
        case 4:
          listeners2[i].fn.call(listeners2[i].context, a1, a2, a3);
          break;
        default:
          if (!args) for (j = 1, args = new Array(len - 1); j < len; j++) args[j - 1] = arguments[j];
          listeners2[i].fn.apply(listeners2[i].context, args);
      }
    }
  }
  return true;
};
$c4dcfd1d1ea86647$var$EventEmitter.prototype.on = function on(event, fn, context) {
  return $c4dcfd1d1ea86647$var$addListener(this, event, fn, context, false);
};
$c4dcfd1d1ea86647$var$EventEmitter.prototype.once = function once(event, fn, context) {
  return $c4dcfd1d1ea86647$var$addListener(this, event, fn, context, true);
};
$c4dcfd1d1ea86647$var$EventEmitter.prototype.removeListener = function removeListener(event, fn, context, once2) {
  var evt = $c4dcfd1d1ea86647$var$prefix ? $c4dcfd1d1ea86647$var$prefix + event : event;
  if (!this._events[evt]) return this;
  if (!fn) {
    $c4dcfd1d1ea86647$var$clearEvent(this, evt);
    return this;
  }
  var listeners2 = this._events[evt];
  if (listeners2.fn) {
    if (listeners2.fn === fn && (!once2 || listeners2.once) && (!context || listeners2.context === context)) $c4dcfd1d1ea86647$var$clearEvent(this, evt);
  } else {
    for (var i = 0, events = [], length = listeners2.length; i < length; i++) if (listeners2[i].fn !== fn || once2 && !listeners2[i].once || context && listeners2[i].context !== context) events.push(listeners2[i]);
    if (events.length) this._events[evt] = events.length === 1 ? events[0] : events;
    else $c4dcfd1d1ea86647$var$clearEvent(this, evt);
  }
  return this;
};
$c4dcfd1d1ea86647$var$EventEmitter.prototype.removeAllListeners = function removeAllListeners(event) {
  var evt;
  if (event) {
    evt = $c4dcfd1d1ea86647$var$prefix ? $c4dcfd1d1ea86647$var$prefix + event : event;
    if (this._events[evt]) $c4dcfd1d1ea86647$var$clearEvent(this, evt);
  } else {
    this._events = new $c4dcfd1d1ea86647$var$Events();
    this._eventsCount = 0;
  }
  return this;
};
$c4dcfd1d1ea86647$var$EventEmitter.prototype.off = $c4dcfd1d1ea86647$var$EventEmitter.prototype.removeListener;
$c4dcfd1d1ea86647$var$EventEmitter.prototype.addListener = $c4dcfd1d1ea86647$var$EventEmitter.prototype.on;
$c4dcfd1d1ea86647$var$EventEmitter.prefixed = $c4dcfd1d1ea86647$var$prefix;
$c4dcfd1d1ea86647$var$EventEmitter.EventEmitter = $c4dcfd1d1ea86647$var$EventEmitter;
$c4dcfd1d1ea86647$exports = $c4dcfd1d1ea86647$var$EventEmitter;
var $78455e22dea96b8c$exports = {};
$parcel$export($78455e22dea96b8c$exports, "ConnectionType", () => $78455e22dea96b8c$export$3157d57b4135e3bc);
$parcel$export($78455e22dea96b8c$exports, "PeerErrorType", () => $78455e22dea96b8c$export$9547aaa2e39030ff);
$parcel$export($78455e22dea96b8c$exports, "BaseConnectionErrorType", () => $78455e22dea96b8c$export$7974935686149686);
$parcel$export($78455e22dea96b8c$exports, "DataConnectionErrorType", () => $78455e22dea96b8c$export$49ae800c114df41d);
$parcel$export($78455e22dea96b8c$exports, "SerializationType", () => $78455e22dea96b8c$export$89f507cf986a947);
$parcel$export($78455e22dea96b8c$exports, "SocketEventType", () => $78455e22dea96b8c$export$3b5c4a4b6354f023);
$parcel$export($78455e22dea96b8c$exports, "ServerMessageType", () => $78455e22dea96b8c$export$adb4a1754da6f10d);
var $78455e22dea96b8c$export$3157d57b4135e3bc = /* @__PURE__ */ (function(ConnectionType) {
  ConnectionType["Data"] = "data";
  ConnectionType["Media"] = "media";
  return ConnectionType;
})({});
var $78455e22dea96b8c$export$9547aaa2e39030ff = /* @__PURE__ */ (function(PeerErrorType) {
  PeerErrorType["BrowserIncompatible"] = "browser-incompatible";
  PeerErrorType["Disconnected"] = "disconnected";
  PeerErrorType["InvalidID"] = "invalid-id";
  PeerErrorType["InvalidKey"] = "invalid-key";
  PeerErrorType["Network"] = "network";
  PeerErrorType["PeerUnavailable"] = "peer-unavailable";
  PeerErrorType["SslUnavailable"] = "ssl-unavailable";
  PeerErrorType["ServerError"] = "server-error";
  PeerErrorType["SocketError"] = "socket-error";
  PeerErrorType["SocketClosed"] = "socket-closed";
  PeerErrorType["UnavailableID"] = "unavailable-id";
  PeerErrorType["WebRTC"] = "webrtc";
  return PeerErrorType;
})({});
var $78455e22dea96b8c$export$7974935686149686 = /* @__PURE__ */ (function(BaseConnectionErrorType) {
  BaseConnectionErrorType["NegotiationFailed"] = "negotiation-failed";
  BaseConnectionErrorType["ConnectionClosed"] = "connection-closed";
  return BaseConnectionErrorType;
})({});
var $78455e22dea96b8c$export$49ae800c114df41d = /* @__PURE__ */ (function(DataConnectionErrorType) {
  DataConnectionErrorType["NotOpenYet"] = "not-open-yet";
  DataConnectionErrorType["MessageToBig"] = "message-too-big";
  return DataConnectionErrorType;
})({});
var $78455e22dea96b8c$export$89f507cf986a947 = /* @__PURE__ */ (function(SerializationType) {
  SerializationType["Binary"] = "binary";
  SerializationType["BinaryUTF8"] = "binary-utf8";
  SerializationType["JSON"] = "json";
  SerializationType["None"] = "raw";
  return SerializationType;
})({});
var $78455e22dea96b8c$export$3b5c4a4b6354f023 = /* @__PURE__ */ (function(SocketEventType) {
  SocketEventType["Message"] = "message";
  SocketEventType["Disconnected"] = "disconnected";
  SocketEventType["Error"] = "error";
  SocketEventType["Close"] = "close";
  return SocketEventType;
})({});
var $78455e22dea96b8c$export$adb4a1754da6f10d = /* @__PURE__ */ (function(ServerMessageType) {
  ServerMessageType["Heartbeat"] = "HEARTBEAT";
  ServerMessageType["Candidate"] = "CANDIDATE";
  ServerMessageType["Offer"] = "OFFER";
  ServerMessageType["Answer"] = "ANSWER";
  ServerMessageType["Open"] = "OPEN";
  ServerMessageType["Error"] = "ERROR";
  ServerMessageType["IdTaken"] = "ID-TAKEN";
  ServerMessageType["InvalidKey"] = "INVALID-KEY";
  ServerMessageType["Leave"] = "LEAVE";
  ServerMessageType["Expire"] = "EXPIRE";
  return ServerMessageType;
})({});
var $520832d44ba058c8$export$83d89fbfd8236492 = "1.5.5";
var $8f5bfa60836d261d$export$4798917dbf149b79 = class extends (0, $c4dcfd1d1ea86647$exports.EventEmitter) {
  constructor(secure, host, port, path, key, pingInterval = 5e3) {
    super(), this.pingInterval = pingInterval, this._disconnected = true, this._messagesQueue = [];
    const wsProtocol = secure ? "wss://" : "ws://";
    this._baseUrl = wsProtocol + host + ":" + port + path + "peerjs?key=" + key;
  }
  start(id, token) {
    this._id = id;
    const wsUrl = `${this._baseUrl}&id=${id}&token=${token}`;
    if (!!this._socket || !this._disconnected) return;
    this._socket = new WebSocket(wsUrl + "&version=" + (0, $520832d44ba058c8$export$83d89fbfd8236492));
    this._disconnected = false;
    this._socket.onmessage = (event) => {
      let data;
      try {
        data = JSON.parse(event.data);
        (0, $257947e92926277a$export$2e2bcd8739ae039).log("Server message received:", data);
      } catch (e) {
        (0, $257947e92926277a$export$2e2bcd8739ae039).log("Invalid server message", event.data);
        return;
      }
      this.emit((0, $78455e22dea96b8c$export$3b5c4a4b6354f023).Message, data);
    };
    this._socket.onclose = (event) => {
      if (this._disconnected) return;
      (0, $257947e92926277a$export$2e2bcd8739ae039).log("Socket closed.", event);
      this._cleanup();
      this._disconnected = true;
      this.emit((0, $78455e22dea96b8c$export$3b5c4a4b6354f023).Disconnected);
    };
    this._socket.onopen = () => {
      if (this._disconnected) return;
      this._sendQueuedMessages();
      (0, $257947e92926277a$export$2e2bcd8739ae039).log("Socket open");
      this._scheduleHeartbeat();
    };
  }
  _scheduleHeartbeat() {
    this._wsPingTimer = setTimeout(() => {
      this._sendHeartbeat();
    }, this.pingInterval);
  }
  _sendHeartbeat() {
    if (!this._wsOpen()) {
      (0, $257947e92926277a$export$2e2bcd8739ae039).log(`Cannot send heartbeat, because socket closed`);
      return;
    }
    const message = JSON.stringify({
      type: (0, $78455e22dea96b8c$export$adb4a1754da6f10d).Heartbeat
    });
    this._socket.send(message);
    this._scheduleHeartbeat();
  }
  /** Is the websocket currently open? */
  _wsOpen() {
    return !!this._socket && this._socket.readyState === 1;
  }
  /** Send queued messages. */
  _sendQueuedMessages() {
    const copiedQueue = [
      ...this._messagesQueue
    ];
    this._messagesQueue = [];
    for (const message of copiedQueue) this.send(message);
  }
  /** Exposed send for DC & Peer. */
  send(data) {
    if (this._disconnected) return;
    if (!this._id) {
      this._messagesQueue.push(data);
      return;
    }
    if (!data.type) {
      this.emit((0, $78455e22dea96b8c$export$3b5c4a4b6354f023).Error, "Invalid message");
      return;
    }
    if (!this._wsOpen()) return;
    const message = JSON.stringify(data);
    this._socket.send(message);
  }
  close() {
    if (this._disconnected) return;
    this._cleanup();
    this._disconnected = true;
  }
  _cleanup() {
    if (this._socket) {
      this._socket.onopen = this._socket.onmessage = this._socket.onclose = null;
      this._socket.close();
      this._socket = void 0;
    }
    clearTimeout(this._wsPingTimer);
  }
};
var $b82fb8fc0514bfc1$export$89e6bb5ad64bf4a = class {
  constructor(connection) {
    this.connection = connection;
  }
  /** Returns a PeerConnection object set up correctly (for data, media). */
  startConnection(options) {
    const peerConnection = this._startPeerConnection();
    this.connection.peerConnection = peerConnection;
    if (this.connection.type === (0, $78455e22dea96b8c$export$3157d57b4135e3bc).Media && options._stream) this._addTracksToConnection(options._stream, peerConnection);
    if (options.originator) {
      const dataConnection = this.connection;
      const config = {
        ordered: !!options.reliable
      };
      const dataChannel = peerConnection.createDataChannel(dataConnection.label, config);
      dataConnection._initializeDataChannel(dataChannel);
      this._makeOffer();
    } else this.handleSDP("OFFER", options.sdp);
  }
  /** Start a PC. */
  _startPeerConnection() {
    (0, $257947e92926277a$export$2e2bcd8739ae039).log("Creating RTCPeerConnection.");
    const peerConnection = new RTCPeerConnection(this.connection.provider.options.config);
    this._setupListeners(peerConnection);
    return peerConnection;
  }
  /** Set up various WebRTC listeners. */
  _setupListeners(peerConnection) {
    const peerId = this.connection.peer;
    const connectionId = this.connection.connectionId;
    const connectionType = this.connection.type;
    const provider = this.connection.provider;
    (0, $257947e92926277a$export$2e2bcd8739ae039).log("Listening for ICE candidates.");
    peerConnection.onicecandidate = (evt) => {
      if (!evt.candidate || !evt.candidate.candidate) return;
      (0, $257947e92926277a$export$2e2bcd8739ae039).log(`Received ICE candidates for ${peerId}:`, evt.candidate);
      provider.socket.send({
        type: (0, $78455e22dea96b8c$export$adb4a1754da6f10d).Candidate,
        payload: {
          candidate: evt.candidate,
          type: connectionType,
          connectionId
        },
        dst: peerId
      });
    };
    peerConnection.oniceconnectionstatechange = () => {
      switch (peerConnection.iceConnectionState) {
        case "failed":
          (0, $257947e92926277a$export$2e2bcd8739ae039).log("iceConnectionState is failed, closing connections to " + peerId);
          this.connection.emitError((0, $78455e22dea96b8c$export$7974935686149686).NegotiationFailed, "Negotiation of connection to " + peerId + " failed.");
          this.connection.close();
          break;
        case "closed":
          (0, $257947e92926277a$export$2e2bcd8739ae039).log("iceConnectionState is closed, closing connections to " + peerId);
          this.connection.emitError((0, $78455e22dea96b8c$export$7974935686149686).ConnectionClosed, "Connection to " + peerId + " closed.");
          this.connection.close();
          break;
        case "disconnected":
          (0, $257947e92926277a$export$2e2bcd8739ae039).log("iceConnectionState changed to disconnected on the connection with " + peerId);
          break;
        case "completed":
          peerConnection.onicecandidate = () => {
          };
          break;
      }
      this.connection.emit("iceStateChanged", peerConnection.iceConnectionState);
    };
    (0, $257947e92926277a$export$2e2bcd8739ae039).log("Listening for data channel");
    peerConnection.ondatachannel = (evt) => {
      (0, $257947e92926277a$export$2e2bcd8739ae039).log("Received data channel");
      const dataChannel = evt.channel;
      const connection = provider.getConnection(peerId, connectionId);
      connection._initializeDataChannel(dataChannel);
    };
    (0, $257947e92926277a$export$2e2bcd8739ae039).log("Listening for remote stream");
    peerConnection.ontrack = (evt) => {
      (0, $257947e92926277a$export$2e2bcd8739ae039).log("Received remote stream");
      const stream = evt.streams[0];
      const connection = provider.getConnection(peerId, connectionId);
      if (connection.type === (0, $78455e22dea96b8c$export$3157d57b4135e3bc).Media) {
        const mediaConnection = connection;
        this._addStreamToMediaConnection(stream, mediaConnection);
      }
    };
  }
  cleanup() {
    (0, $257947e92926277a$export$2e2bcd8739ae039).log("Cleaning up PeerConnection to " + this.connection.peer);
    const peerConnection = this.connection.peerConnection;
    if (!peerConnection) return;
    this.connection.peerConnection = null;
    peerConnection.onicecandidate = peerConnection.oniceconnectionstatechange = peerConnection.ondatachannel = peerConnection.ontrack = () => {
    };
    const peerConnectionNotClosed = peerConnection.signalingState !== "closed";
    let dataChannelNotClosed = false;
    const dataChannel = this.connection.dataChannel;
    if (dataChannel) dataChannelNotClosed = !!dataChannel.readyState && dataChannel.readyState !== "closed";
    if (peerConnectionNotClosed || dataChannelNotClosed) peerConnection.close();
  }
  async _makeOffer() {
    const peerConnection = this.connection.peerConnection;
    const provider = this.connection.provider;
    try {
      const offer = await peerConnection.createOffer(this.connection.options.constraints);
      (0, $257947e92926277a$export$2e2bcd8739ae039).log("Created offer.");
      if (this.connection.options.sdpTransform && typeof this.connection.options.sdpTransform === "function") offer.sdp = this.connection.options.sdpTransform(offer.sdp) || offer.sdp;
      try {
        await peerConnection.setLocalDescription(offer);
        (0, $257947e92926277a$export$2e2bcd8739ae039).log("Set localDescription:", offer, `for:${this.connection.peer}`);
        let payload = {
          sdp: offer,
          type: this.connection.type,
          connectionId: this.connection.connectionId,
          metadata: this.connection.metadata
        };
        if (this.connection.type === (0, $78455e22dea96b8c$export$3157d57b4135e3bc).Data) {
          const dataConnection = this.connection;
          payload = {
            ...payload,
            label: dataConnection.label,
            reliable: dataConnection.reliable,
            serialization: dataConnection.serialization
          };
        }
        provider.socket.send({
          type: (0, $78455e22dea96b8c$export$adb4a1754da6f10d).Offer,
          payload,
          dst: this.connection.peer
        });
      } catch (err) {
        if (err != "OperationError: Failed to set local offer sdp: Called in wrong state: kHaveRemoteOffer") {
          provider.emitError((0, $78455e22dea96b8c$export$9547aaa2e39030ff).WebRTC, err);
          (0, $257947e92926277a$export$2e2bcd8739ae039).log("Failed to setLocalDescription, ", err);
        }
      }
    } catch (err_1) {
      provider.emitError((0, $78455e22dea96b8c$export$9547aaa2e39030ff).WebRTC, err_1);
      (0, $257947e92926277a$export$2e2bcd8739ae039).log("Failed to createOffer, ", err_1);
    }
  }
  async _makeAnswer() {
    const peerConnection = this.connection.peerConnection;
    const provider = this.connection.provider;
    try {
      const answer = await peerConnection.createAnswer();
      (0, $257947e92926277a$export$2e2bcd8739ae039).log("Created answer.");
      if (this.connection.options.sdpTransform && typeof this.connection.options.sdpTransform === "function") answer.sdp = this.connection.options.sdpTransform(answer.sdp) || answer.sdp;
      try {
        await peerConnection.setLocalDescription(answer);
        (0, $257947e92926277a$export$2e2bcd8739ae039).log(`Set localDescription:`, answer, `for:${this.connection.peer}`);
        provider.socket.send({
          type: (0, $78455e22dea96b8c$export$adb4a1754da6f10d).Answer,
          payload: {
            sdp: answer,
            type: this.connection.type,
            connectionId: this.connection.connectionId
          },
          dst: this.connection.peer
        });
      } catch (err) {
        provider.emitError((0, $78455e22dea96b8c$export$9547aaa2e39030ff).WebRTC, err);
        (0, $257947e92926277a$export$2e2bcd8739ae039).log("Failed to setLocalDescription, ", err);
      }
    } catch (err_1) {
      provider.emitError((0, $78455e22dea96b8c$export$9547aaa2e39030ff).WebRTC, err_1);
      (0, $257947e92926277a$export$2e2bcd8739ae039).log("Failed to create answer, ", err_1);
    }
  }
  /** Handle an SDP. */
  async handleSDP(type, sdp2) {
    sdp2 = new RTCSessionDescription(sdp2);
    const peerConnection = this.connection.peerConnection;
    const provider = this.connection.provider;
    (0, $257947e92926277a$export$2e2bcd8739ae039).log("Setting remote description", sdp2);
    const self = this;
    try {
      await peerConnection.setRemoteDescription(sdp2);
      (0, $257947e92926277a$export$2e2bcd8739ae039).log(`Set remoteDescription:${type} for:${this.connection.peer}`);
      if (type === "OFFER") await self._makeAnswer();
    } catch (err) {
      provider.emitError((0, $78455e22dea96b8c$export$9547aaa2e39030ff).WebRTC, err);
      (0, $257947e92926277a$export$2e2bcd8739ae039).log("Failed to setRemoteDescription, ", err);
    }
  }
  /** Handle a candidate. */
  async handleCandidate(ice) {
    (0, $257947e92926277a$export$2e2bcd8739ae039).log(`handleCandidate:`, ice);
    try {
      await this.connection.peerConnection.addIceCandidate(ice);
      (0, $257947e92926277a$export$2e2bcd8739ae039).log(`Added ICE candidate for:${this.connection.peer}`);
    } catch (err) {
      this.connection.provider.emitError((0, $78455e22dea96b8c$export$9547aaa2e39030ff).WebRTC, err);
      (0, $257947e92926277a$export$2e2bcd8739ae039).log("Failed to handleCandidate, ", err);
    }
  }
  _addTracksToConnection(stream, peerConnection) {
    (0, $257947e92926277a$export$2e2bcd8739ae039).log(`add tracks from stream ${stream.id} to peer connection`);
    if (!peerConnection.addTrack) return (0, $257947e92926277a$export$2e2bcd8739ae039).error(`Your browser does't support RTCPeerConnection#addTrack. Ignored.`);
    stream.getTracks().forEach((track) => {
      peerConnection.addTrack(track, stream);
    });
  }
  _addStreamToMediaConnection(stream, mediaConnection) {
    (0, $257947e92926277a$export$2e2bcd8739ae039).log(`add stream ${stream.id} to media connection ${mediaConnection.connectionId}`);
    mediaConnection.addStream(stream);
  }
};
var $23779d1881157a18$export$6a678e589c8a4542 = class extends (0, $c4dcfd1d1ea86647$exports.EventEmitter) {
  /**
  * Emits a typed error message.
  *
  * @internal
  */
  emitError(type, err) {
    (0, $257947e92926277a$export$2e2bcd8739ae039).error("Error:", err);
    this.emit("error", new $23779d1881157a18$export$98871882f492de82(`${type}`, err));
  }
};
var $23779d1881157a18$export$98871882f492de82 = class extends Error {
  /**
  * @internal
  */
  constructor(type, err) {
    if (typeof err === "string") super(err);
    else {
      super();
      Object.assign(this, err);
    }
    this.type = type;
  }
};
var $5045192fc6d387ba$export$23a2a68283c24d80 = class extends (0, $23779d1881157a18$export$6a678e589c8a4542) {
  /**
  * Whether the media connection is active (e.g. your call has been answered).
  * You can check this if you want to set a maximum wait time for a one-sided call.
  */
  get open() {
    return this._open;
  }
  constructor(peer, provider, options) {
    super(), this.peer = peer, this.provider = provider, this.options = options, this._open = false;
    this.metadata = options.metadata;
  }
};
var $5c1d08c7c57da9a3$export$4a84e95a2324ac29 = class _$5c1d08c7c57da9a3$export$4a84e95a2324ac29 extends (0, $5045192fc6d387ba$export$23a2a68283c24d80) {
  static #_ = this.ID_PREFIX = "mc_";
  /**
  * For media connections, this is always 'media'.
  */
  get type() {
    return (0, $78455e22dea96b8c$export$3157d57b4135e3bc).Media;
  }
  get localStream() {
    return this._localStream;
  }
  get remoteStream() {
    return this._remoteStream;
  }
  constructor(peerId, provider, options) {
    super(peerId, provider, options);
    this._localStream = this.options._stream;
    this.connectionId = this.options.connectionId || _$5c1d08c7c57da9a3$export$4a84e95a2324ac29.ID_PREFIX + (0, $4f4134156c446392$export$7debb50ef11d5e0b).randomToken();
    this._negotiator = new (0, $b82fb8fc0514bfc1$export$89e6bb5ad64bf4a)(this);
    if (this._localStream) this._negotiator.startConnection({
      _stream: this._localStream,
      originator: true
    });
  }
  /** Called by the Negotiator when the DataChannel is ready. */
  _initializeDataChannel(dc) {
    this.dataChannel = dc;
    this.dataChannel.onopen = () => {
      (0, $257947e92926277a$export$2e2bcd8739ae039).log(`DC#${this.connectionId} dc connection success`);
      this.emit("willCloseOnRemote");
    };
    this.dataChannel.onclose = () => {
      (0, $257947e92926277a$export$2e2bcd8739ae039).log(`DC#${this.connectionId} dc closed for:`, this.peer);
      this.close();
    };
  }
  addStream(remoteStream) {
    (0, $257947e92926277a$export$2e2bcd8739ae039).log("Receiving stream", remoteStream);
    this._remoteStream = remoteStream;
    super.emit("stream", remoteStream);
  }
  /**
  * @internal
  */
  handleMessage(message) {
    const type = message.type;
    const payload = message.payload;
    switch (message.type) {
      case (0, $78455e22dea96b8c$export$adb4a1754da6f10d).Answer:
        this._negotiator.handleSDP(type, payload.sdp);
        this._open = true;
        break;
      case (0, $78455e22dea96b8c$export$adb4a1754da6f10d).Candidate:
        this._negotiator.handleCandidate(payload.candidate);
        break;
      default:
        (0, $257947e92926277a$export$2e2bcd8739ae039).warn(`Unrecognized message type:${type} from peer:${this.peer}`);
        break;
    }
  }
  /**
       * When receiving a {@apilink PeerEvents | `call`} event on a peer, you can call
       * `answer` on the media connection provided by the callback to accept the call
       * and optionally send your own media stream.
  
       *
       * @param stream A WebRTC media stream.
       * @param options
       * @returns
       */
  answer(stream, options = {}) {
    if (this._localStream) {
      (0, $257947e92926277a$export$2e2bcd8739ae039).warn("Local stream already exists on this MediaConnection. Are you answering a call twice?");
      return;
    }
    this._localStream = stream;
    if (options && options.sdpTransform) this.options.sdpTransform = options.sdpTransform;
    this._negotiator.startConnection({
      ...this.options._payload,
      _stream: stream
    });
    const messages = this.provider._getMessages(this.connectionId);
    for (const message of messages) this.handleMessage(message);
    this._open = true;
  }
  /**
  * Exposed functionality for users.
  */
  /**
  * Closes the media connection.
  */
  close() {
    if (this._negotiator) {
      this._negotiator.cleanup();
      this._negotiator = null;
    }
    this._localStream = null;
    this._remoteStream = null;
    if (this.provider) {
      this.provider._removeConnection(this);
      this.provider = null;
    }
    if (this.options && this.options._stream) this.options._stream = null;
    if (!this.open) return;
    this._open = false;
    super.emit("close");
  }
};
var $abf266641927cd89$export$2c4e825dc9120f87 = class {
  constructor(_options) {
    this._options = _options;
  }
  _buildRequest(method) {
    const protocol = this._options.secure ? "https" : "http";
    const { host, port, path, key } = this._options;
    const url = new URL(`${protocol}://${host}:${port}${path}${key}/${method}`);
    url.searchParams.set("ts", `${Date.now()}${Math.random()}`);
    url.searchParams.set("version", (0, $520832d44ba058c8$export$83d89fbfd8236492));
    return fetch(url.href, {
      referrerPolicy: this._options.referrerPolicy
    });
  }
  /** Get a unique ID from the server via XHR and initialize with it. */
  async retrieveId() {
    try {
      const response = await this._buildRequest("id");
      if (response.status !== 200) throw new Error(`Error. Status:${response.status}`);
      return response.text();
    } catch (error) {
      (0, $257947e92926277a$export$2e2bcd8739ae039).error("Error retrieving ID", error);
      let pathError = "";
      if (this._options.path === "/" && this._options.host !== (0, $4f4134156c446392$export$7debb50ef11d5e0b).CLOUD_HOST) pathError = " If you passed in a `path` to your self-hosted PeerServer, you'll also need to pass in that same path when creating a new Peer.";
      throw new Error("Could not get an ID from the server." + pathError);
    }
  }
  /** @deprecated */
  async listAllPeers() {
    try {
      const response = await this._buildRequest("peers");
      if (response.status !== 200) {
        if (response.status === 401) {
          let helpfulError = "";
          if (this._options.host === (0, $4f4134156c446392$export$7debb50ef11d5e0b).CLOUD_HOST) helpfulError = "It looks like you're using the cloud server. You can email team@peerjs.com to enable peer listing for your API key.";
          else helpfulError = "You need to enable `allow_discovery` on your self-hosted PeerServer to use this feature.";
          throw new Error("It doesn't look like you have permission to list peers IDs. " + helpfulError);
        }
        throw new Error(`Error. Status:${response.status}`);
      }
      return response.json();
    } catch (error) {
      (0, $257947e92926277a$export$2e2bcd8739ae039).error("Error retrieving list peers", error);
      throw new Error("Could not get list peers from the server." + error);
    }
  }
};
var $6366c4ca161bc297$export$d365f7ad9d7df9c9 = class _$6366c4ca161bc297$export$d365f7ad9d7df9c9 extends (0, $5045192fc6d387ba$export$23a2a68283c24d80) {
  static #_ = this.ID_PREFIX = "dc_";
  static #_2 = this.MAX_BUFFERED_AMOUNT = 8388608;
  get type() {
    return (0, $78455e22dea96b8c$export$3157d57b4135e3bc).Data;
  }
  constructor(peerId, provider, options) {
    super(peerId, provider, options);
    this.connectionId = this.options.connectionId || _$6366c4ca161bc297$export$d365f7ad9d7df9c9.ID_PREFIX + (0, $0e5fd1585784c252$export$4e61f672936bec77)();
    this.label = this.options.label || this.connectionId;
    this.reliable = !!this.options.reliable;
    this._negotiator = new (0, $b82fb8fc0514bfc1$export$89e6bb5ad64bf4a)(this);
    this._negotiator.startConnection(this.options._payload || {
      originator: true,
      reliable: this.reliable
    });
  }
  /** Called by the Negotiator when the DataChannel is ready. */
  _initializeDataChannel(dc) {
    this.dataChannel = dc;
    this.dataChannel.onopen = () => {
      (0, $257947e92926277a$export$2e2bcd8739ae039).log(`DC#${this.connectionId} dc connection success`);
      this._open = true;
      this.emit("open");
    };
    this.dataChannel.onmessage = (e) => {
      (0, $257947e92926277a$export$2e2bcd8739ae039).log(`DC#${this.connectionId} dc onmessage:`, e.data);
    };
    this.dataChannel.onclose = () => {
      (0, $257947e92926277a$export$2e2bcd8739ae039).log(`DC#${this.connectionId} dc closed for:`, this.peer);
      this.close();
    };
  }
  /**
  * Exposed functionality for users.
  */
  /** Allows user to close connection. */
  close(options) {
    if (options?.flush) {
      this.send({
        __peerData: {
          type: "close"
        }
      });
      return;
    }
    if (this._negotiator) {
      this._negotiator.cleanup();
      this._negotiator = null;
    }
    if (this.provider) {
      this.provider._removeConnection(this);
      this.provider = null;
    }
    if (this.dataChannel) {
      this.dataChannel.onopen = null;
      this.dataChannel.onmessage = null;
      this.dataChannel.onclose = null;
      this.dataChannel = null;
    }
    if (!this.open) return;
    this._open = false;
    super.emit("close");
  }
  /** Allows user to send data. */
  send(data, chunked = false) {
    if (!this.open) {
      this.emitError((0, $78455e22dea96b8c$export$49ae800c114df41d).NotOpenYet, "Connection is not open. You should listen for the `open` event before sending messages.");
      return;
    }
    return this._send(data, chunked);
  }
  async handleMessage(message) {
    const payload = message.payload;
    switch (message.type) {
      case (0, $78455e22dea96b8c$export$adb4a1754da6f10d).Answer:
        await this._negotiator.handleSDP(message.type, payload.sdp);
        break;
      case (0, $78455e22dea96b8c$export$adb4a1754da6f10d).Candidate:
        await this._negotiator.handleCandidate(payload.candidate);
        break;
      default:
        (0, $257947e92926277a$export$2e2bcd8739ae039).warn("Unrecognized message type:", message.type, "from peer:", this.peer);
        break;
    }
  }
};
var $a229bedbcaa6ca23$export$ff7c9d4c11d94e8b = class extends (0, $6366c4ca161bc297$export$d365f7ad9d7df9c9) {
  get bufferSize() {
    return this._bufferSize;
  }
  _initializeDataChannel(dc) {
    super._initializeDataChannel(dc);
    this.dataChannel.binaryType = "arraybuffer";
    this.dataChannel.addEventListener("message", (e) => this._handleDataMessage(e));
  }
  _bufferedSend(msg) {
    if (this._buffering || !this._trySend(msg)) {
      this._buffer.push(msg);
      this._bufferSize = this._buffer.length;
    }
  }
  // Returns true if the send succeeds.
  _trySend(msg) {
    if (!this.open) return false;
    if (this.dataChannel.bufferedAmount > (0, $6366c4ca161bc297$export$d365f7ad9d7df9c9).MAX_BUFFERED_AMOUNT) {
      this._buffering = true;
      setTimeout(() => {
        this._buffering = false;
        this._tryBuffer();
      }, 50);
      return false;
    }
    try {
      this.dataChannel.send(msg);
    } catch (e) {
      (0, $257947e92926277a$export$2e2bcd8739ae039).error(`DC#:${this.connectionId} Error when sending:`, e);
      this._buffering = true;
      this.close();
      return false;
    }
    return true;
  }
  // Try to send the first message in the buffer.
  _tryBuffer() {
    if (!this.open) return;
    if (this._buffer.length === 0) return;
    const msg = this._buffer[0];
    if (this._trySend(msg)) {
      this._buffer.shift();
      this._bufferSize = this._buffer.length;
      this._tryBuffer();
    }
  }
  close(options) {
    if (options?.flush) {
      this.send({
        __peerData: {
          type: "close"
        }
      });
      return;
    }
    this._buffer = [];
    this._bufferSize = 0;
    super.close();
  }
  constructor(...args) {
    super(...args), this._buffer = [], this._bufferSize = 0, this._buffering = false;
  }
};
var $9fcfddb3ae148f88$export$f0a5a64d5bb37108 = class extends (0, $a229bedbcaa6ca23$export$ff7c9d4c11d94e8b) {
  close(options) {
    super.close(options);
    this._chunkedData = {};
  }
  constructor(peerId, provider, options) {
    super(peerId, provider, options), this.chunker = new (0, $fcbcc7538a6776d5$export$f1c5f4c9cb95390b)(), this.serialization = (0, $78455e22dea96b8c$export$89f507cf986a947).Binary, this._chunkedData = {};
  }
  // Handles a DataChannel message.
  _handleDataMessage({ data }) {
    const deserializedData = (0, $0cfd7828ad59115f$export$417857010dc9287f)(data);
    const peerData = deserializedData["__peerData"];
    if (peerData) {
      if (peerData.type === "close") {
        this.close();
        return;
      }
      this._handleChunk(deserializedData);
      return;
    }
    this.emit("data", deserializedData);
  }
  _handleChunk(data) {
    const id = data.__peerData;
    const chunkInfo = this._chunkedData[id] || {
      data: [],
      count: 0,
      total: data.total
    };
    chunkInfo.data[data.n] = new Uint8Array(data.data);
    chunkInfo.count++;
    this._chunkedData[id] = chunkInfo;
    if (chunkInfo.total === chunkInfo.count) {
      delete this._chunkedData[id];
      const data2 = (0, $fcbcc7538a6776d5$export$52c89ebcdc4f53f2)(chunkInfo.data);
      this._handleDataMessage({
        data: data2
      });
    }
  }
  _send(data, chunked) {
    const blob = (0, $0cfd7828ad59115f$export$2a703dbb0cb35339)(data);
    if (blob instanceof Promise) return this._send_blob(blob);
    if (!chunked && blob.byteLength > this.chunker.chunkedMTU) {
      this._sendChunks(blob);
      return;
    }
    this._bufferedSend(blob);
  }
  async _send_blob(blobPromise) {
    const blob = await blobPromise;
    if (blob.byteLength > this.chunker.chunkedMTU) {
      this._sendChunks(blob);
      return;
    }
    this._bufferedSend(blob);
  }
  _sendChunks(blob) {
    const blobs = this.chunker.chunk(blob);
    (0, $257947e92926277a$export$2e2bcd8739ae039).log(`DC#${this.connectionId} Try to send ${blobs.length} chunks...`);
    for (const blob2 of blobs) this.send(blob2, true);
  }
};
var $bbaee3f15f714663$export$6f88fe47d32c9c94 = class extends (0, $a229bedbcaa6ca23$export$ff7c9d4c11d94e8b) {
  _handleDataMessage({ data }) {
    super.emit("data", data);
  }
  _send(data, _chunked) {
    this._bufferedSend(data);
  }
  constructor(...args) {
    super(...args), this.serialization = (0, $78455e22dea96b8c$export$89f507cf986a947).None;
  }
};
var $817f931e3f9096cf$export$48880ac635f47186 = class extends (0, $a229bedbcaa6ca23$export$ff7c9d4c11d94e8b) {
  // Handles a DataChannel message.
  _handleDataMessage({ data }) {
    const deserializedData = this.parse(this.decoder.decode(data));
    const peerData = deserializedData["__peerData"];
    if (peerData && peerData.type === "close") {
      this.close();
      return;
    }
    this.emit("data", deserializedData);
  }
  _send(data, _chunked) {
    const encodedData = this.encoder.encode(this.stringify(data));
    if (encodedData.byteLength >= (0, $4f4134156c446392$export$7debb50ef11d5e0b).chunkedMTU) {
      this.emitError((0, $78455e22dea96b8c$export$49ae800c114df41d).MessageToBig, "Message too big for JSON channel");
      return;
    }
    this._bufferedSend(encodedData);
  }
  constructor(...args) {
    super(...args), this.serialization = (0, $78455e22dea96b8c$export$89f507cf986a947).JSON, this.encoder = new TextEncoder(), this.decoder = new TextDecoder(), this.stringify = JSON.stringify, this.parse = JSON.parse;
  }
};
var $416260bce337df90$export$ecd1fc136c422448 = class _$416260bce337df90$export$ecd1fc136c422448 extends (0, $23779d1881157a18$export$6a678e589c8a4542) {
  static #_ = this.DEFAULT_KEY = "peerjs";
  /**
  * The brokering ID of this peer
  *
  * If no ID was specified in {@apilink Peer | the constructor},
  * this will be `undefined` until the {@apilink PeerEvents | `open`} event is emitted.
  */
  get id() {
    return this._id;
  }
  get options() {
    return this._options;
  }
  get open() {
    return this._open;
  }
  /**
  * @internal
  */
  get socket() {
    return this._socket;
  }
  /**
  * A hash of all connections associated with this peer, keyed by the remote peer's ID.
  * @deprecated
  * Return type will change from Object to Map<string,[]>
  */
  get connections() {
    const plainConnections = /* @__PURE__ */ Object.create(null);
    for (const [k, v] of this._connections) plainConnections[k] = v;
    return plainConnections;
  }
  /**
  * true if this peer and all of its connections can no longer be used.
  */
  get destroyed() {
    return this._destroyed;
  }
  /**
  * false if there is an active connection to the PeerServer.
  */
  get disconnected() {
    return this._disconnected;
  }
  constructor(id, options) {
    super(), this._serializers = {
      raw: (0, $bbaee3f15f714663$export$6f88fe47d32c9c94),
      json: (0, $817f931e3f9096cf$export$48880ac635f47186),
      binary: (0, $9fcfddb3ae148f88$export$f0a5a64d5bb37108),
      "binary-utf8": (0, $9fcfddb3ae148f88$export$f0a5a64d5bb37108),
      default: (0, $9fcfddb3ae148f88$export$f0a5a64d5bb37108)
    }, this._id = null, this._lastServerId = null, // States.
    this._destroyed = false, this._disconnected = false, this._open = false, this._connections = /* @__PURE__ */ new Map(), this._lostMessages = /* @__PURE__ */ new Map();
    let userId;
    if (id && id.constructor == Object) options = id;
    else if (id) userId = id.toString();
    options = {
      debug: 0,
      host: (0, $4f4134156c446392$export$7debb50ef11d5e0b).CLOUD_HOST,
      port: (0, $4f4134156c446392$export$7debb50ef11d5e0b).CLOUD_PORT,
      path: "/",
      key: _$416260bce337df90$export$ecd1fc136c422448.DEFAULT_KEY,
      token: (0, $4f4134156c446392$export$7debb50ef11d5e0b).randomToken(),
      config: (0, $4f4134156c446392$export$7debb50ef11d5e0b).defaultConfig,
      referrerPolicy: "strict-origin-when-cross-origin",
      serializers: {},
      ...options
    };
    this._options = options;
    this._serializers = {
      ...this._serializers,
      ...this.options.serializers
    };
    if (this._options.host === "/") this._options.host = window.location.hostname;
    if (this._options.path) {
      if (this._options.path[0] !== "/") this._options.path = "/" + this._options.path;
      if (this._options.path[this._options.path.length - 1] !== "/") this._options.path += "/";
    }
    if (this._options.secure === void 0 && this._options.host !== (0, $4f4134156c446392$export$7debb50ef11d5e0b).CLOUD_HOST) this._options.secure = (0, $4f4134156c446392$export$7debb50ef11d5e0b).isSecure();
    else if (this._options.host == (0, $4f4134156c446392$export$7debb50ef11d5e0b).CLOUD_HOST) this._options.secure = true;
    if (this._options.logFunction) (0, $257947e92926277a$export$2e2bcd8739ae039).setLogFunction(this._options.logFunction);
    (0, $257947e92926277a$export$2e2bcd8739ae039).logLevel = this._options.debug || 0;
    this._api = new (0, $abf266641927cd89$export$2c4e825dc9120f87)(options);
    this._socket = this._createServerConnection();
    if (!(0, $4f4134156c446392$export$7debb50ef11d5e0b).supports.audioVideo && !(0, $4f4134156c446392$export$7debb50ef11d5e0b).supports.data) {
      this._delayedAbort((0, $78455e22dea96b8c$export$9547aaa2e39030ff).BrowserIncompatible, "The current browser does not support WebRTC");
      return;
    }
    if (!!userId && !(0, $4f4134156c446392$export$7debb50ef11d5e0b).validateId(userId)) {
      this._delayedAbort((0, $78455e22dea96b8c$export$9547aaa2e39030ff).InvalidID, `ID "${userId}" is invalid`);
      return;
    }
    if (userId) this._initialize(userId);
    else this._api.retrieveId().then((id2) => this._initialize(id2)).catch((error) => this._abort((0, $78455e22dea96b8c$export$9547aaa2e39030ff).ServerError, error));
  }
  _createServerConnection() {
    const socket = new (0, $8f5bfa60836d261d$export$4798917dbf149b79)(this._options.secure, this._options.host, this._options.port, this._options.path, this._options.key, this._options.pingInterval);
    socket.on((0, $78455e22dea96b8c$export$3b5c4a4b6354f023).Message, (data) => {
      this._handleMessage(data);
    });
    socket.on((0, $78455e22dea96b8c$export$3b5c4a4b6354f023).Error, (error) => {
      this._abort((0, $78455e22dea96b8c$export$9547aaa2e39030ff).SocketError, error);
    });
    socket.on((0, $78455e22dea96b8c$export$3b5c4a4b6354f023).Disconnected, () => {
      if (this.disconnected) return;
      this.emitError((0, $78455e22dea96b8c$export$9547aaa2e39030ff).Network, "Lost connection to server.");
      this.disconnect();
    });
    socket.on((0, $78455e22dea96b8c$export$3b5c4a4b6354f023).Close, () => {
      if (this.disconnected) return;
      this._abort((0, $78455e22dea96b8c$export$9547aaa2e39030ff).SocketClosed, "Underlying socket is already closed.");
    });
    return socket;
  }
  /** Initialize a connection with the server. */
  _initialize(id) {
    this._id = id;
    this.socket.start(id, this._options.token);
  }
  /** Handles messages from the server. */
  _handleMessage(message) {
    const type = message.type;
    const payload = message.payload;
    const peerId = message.src;
    switch (type) {
      case (0, $78455e22dea96b8c$export$adb4a1754da6f10d).Open:
        this._lastServerId = this.id;
        this._open = true;
        this.emit("open", this.id);
        break;
      case (0, $78455e22dea96b8c$export$adb4a1754da6f10d).Error:
        this._abort((0, $78455e22dea96b8c$export$9547aaa2e39030ff).ServerError, payload.msg);
        break;
      case (0, $78455e22dea96b8c$export$adb4a1754da6f10d).IdTaken:
        this._abort((0, $78455e22dea96b8c$export$9547aaa2e39030ff).UnavailableID, `ID "${this.id}" is taken`);
        break;
      case (0, $78455e22dea96b8c$export$adb4a1754da6f10d).InvalidKey:
        this._abort((0, $78455e22dea96b8c$export$9547aaa2e39030ff).InvalidKey, `API KEY "${this._options.key}" is invalid`);
        break;
      case (0, $78455e22dea96b8c$export$adb4a1754da6f10d).Leave:
        (0, $257947e92926277a$export$2e2bcd8739ae039).log(`Received leave message from ${peerId}`);
        this._cleanupPeer(peerId);
        this._connections.delete(peerId);
        break;
      case (0, $78455e22dea96b8c$export$adb4a1754da6f10d).Expire:
        this.emitError((0, $78455e22dea96b8c$export$9547aaa2e39030ff).PeerUnavailable, `Could not connect to peer ${peerId}`);
        break;
      case (0, $78455e22dea96b8c$export$adb4a1754da6f10d).Offer: {
        const connectionId = payload.connectionId;
        let connection = this.getConnection(peerId, connectionId);
        if (connection) {
          connection.close();
          (0, $257947e92926277a$export$2e2bcd8739ae039).warn(`Offer received for existing Connection ID:${connectionId}`);
        }
        if (payload.type === (0, $78455e22dea96b8c$export$3157d57b4135e3bc).Media) {
          const mediaConnection = new (0, $5c1d08c7c57da9a3$export$4a84e95a2324ac29)(peerId, this, {
            connectionId,
            _payload: payload,
            metadata: payload.metadata
          });
          connection = mediaConnection;
          this._addConnection(peerId, connection);
          this.emit("call", mediaConnection);
        } else if (payload.type === (0, $78455e22dea96b8c$export$3157d57b4135e3bc).Data) {
          const dataConnection = new this._serializers[payload.serialization](peerId, this, {
            connectionId,
            _payload: payload,
            metadata: payload.metadata,
            label: payload.label,
            serialization: payload.serialization,
            reliable: payload.reliable
          });
          connection = dataConnection;
          this._addConnection(peerId, connection);
          this.emit("connection", dataConnection);
        } else {
          (0, $257947e92926277a$export$2e2bcd8739ae039).warn(`Received malformed connection type:${payload.type}`);
          return;
        }
        const messages = this._getMessages(connectionId);
        for (const message2 of messages) connection.handleMessage(message2);
        break;
      }
      default: {
        if (!payload) {
          (0, $257947e92926277a$export$2e2bcd8739ae039).warn(`You received a malformed message from ${peerId} of type ${type}`);
          return;
        }
        const connectionId = payload.connectionId;
        const connection = this.getConnection(peerId, connectionId);
        if (connection && connection.peerConnection)
          connection.handleMessage(message);
        else if (connectionId)
          this._storeMessage(connectionId, message);
        else (0, $257947e92926277a$export$2e2bcd8739ae039).warn("You received an unrecognized message:", message);
        break;
      }
    }
  }
  /** Stores messages without a set up connection, to be claimed later. */
  _storeMessage(connectionId, message) {
    if (!this._lostMessages.has(connectionId)) this._lostMessages.set(connectionId, []);
    this._lostMessages.get(connectionId).push(message);
  }
  /**
  * Retrieve messages from lost message store
  * @internal
  */
  //TODO Change it to private
  _getMessages(connectionId) {
    const messages = this._lostMessages.get(connectionId);
    if (messages) {
      this._lostMessages.delete(connectionId);
      return messages;
    }
    return [];
  }
  /**
  * Connects to the remote peer specified by id and returns a data connection.
  * @param peer The brokering ID of the remote peer (their {@apilink Peer.id}).
  * @param options for specifying details about Peer Connection
  */
  connect(peer, options = {}) {
    options = {
      serialization: "default",
      ...options
    };
    if (this.disconnected) {
      (0, $257947e92926277a$export$2e2bcd8739ae039).warn("You cannot connect to a new Peer because you called .disconnect() on this Peer and ended your connection with the server. You can create a new Peer to reconnect, or call reconnect on this peer if you believe its ID to still be available.");
      this.emitError((0, $78455e22dea96b8c$export$9547aaa2e39030ff).Disconnected, "Cannot connect to new Peer after disconnecting from server.");
      return;
    }
    const dataConnection = new this._serializers[options.serialization](peer, this, options);
    this._addConnection(peer, dataConnection);
    return dataConnection;
  }
  /**
  * Calls the remote peer specified by id and returns a media connection.
  * @param peer The brokering ID of the remote peer (their peer.id).
  * @param stream The caller's media stream
  * @param options Metadata associated with the connection, passed in by whoever initiated the connection.
  */
  call(peer, stream, options = {}) {
    if (this.disconnected) {
      (0, $257947e92926277a$export$2e2bcd8739ae039).warn("You cannot connect to a new Peer because you called .disconnect() on this Peer and ended your connection with the server. You can create a new Peer to reconnect.");
      this.emitError((0, $78455e22dea96b8c$export$9547aaa2e39030ff).Disconnected, "Cannot connect to new Peer after disconnecting from server.");
      return;
    }
    if (!stream) {
      (0, $257947e92926277a$export$2e2bcd8739ae039).error("To call a peer, you must provide a stream from your browser's `getUserMedia`.");
      return;
    }
    const mediaConnection = new (0, $5c1d08c7c57da9a3$export$4a84e95a2324ac29)(peer, this, {
      ...options,
      _stream: stream
    });
    this._addConnection(peer, mediaConnection);
    return mediaConnection;
  }
  /** Add a data/media connection to this peer. */
  _addConnection(peerId, connection) {
    (0, $257947e92926277a$export$2e2bcd8739ae039).log(`add connection ${connection.type}:${connection.connectionId} to peerId:${peerId}`);
    if (!this._connections.has(peerId)) this._connections.set(peerId, []);
    this._connections.get(peerId).push(connection);
  }
  //TODO should be private
  _removeConnection(connection) {
    const connections = this._connections.get(connection.peer);
    if (connections) {
      const index = connections.indexOf(connection);
      if (index !== -1) connections.splice(index, 1);
    }
    this._lostMessages.delete(connection.connectionId);
  }
  /** Retrieve a data/media connection for this peer. */
  getConnection(peerId, connectionId) {
    const connections = this._connections.get(peerId);
    if (!connections) return null;
    for (const connection of connections) {
      if (connection.connectionId === connectionId) return connection;
    }
    return null;
  }
  _delayedAbort(type, message) {
    setTimeout(() => {
      this._abort(type, message);
    }, 0);
  }
  /**
  * Emits an error message and destroys the Peer.
  * The Peer is not destroyed if it's in a disconnected state, in which case
  * it retains its disconnected state and its existing connections.
  */
  _abort(type, message) {
    (0, $257947e92926277a$export$2e2bcd8739ae039).error("Aborting!");
    this.emitError(type, message);
    if (!this._lastServerId) this.destroy();
    else this.disconnect();
  }
  /**
  * Destroys the Peer: closes all active connections as well as the connection
  * to the server.
  *
  * :::caution
  * This cannot be undone; the respective peer object will no longer be able
  * to create or receive any connections, its ID will be forfeited on the server,
  * and all of its data and media connections will be closed.
  * :::
  */
  destroy() {
    if (this.destroyed) return;
    (0, $257947e92926277a$export$2e2bcd8739ae039).log(`Destroy peer with ID:${this.id}`);
    this.disconnect();
    this._cleanup();
    this._destroyed = true;
    this.emit("close");
  }
  /** Disconnects every connection on this peer. */
  _cleanup() {
    for (const peerId of this._connections.keys()) {
      this._cleanupPeer(peerId);
      this._connections.delete(peerId);
    }
    this.socket.removeAllListeners();
  }
  /** Closes all connections to this peer. */
  _cleanupPeer(peerId) {
    const connections = this._connections.get(peerId);
    if (!connections) return;
    for (const connection of connections) connection.close();
  }
  /**
  * Disconnects the Peer's connection to the PeerServer. Does not close any
  *  active connections.
  * Warning: The peer can no longer create or accept connections after being
  *  disconnected. It also cannot reconnect to the server.
  */
  disconnect() {
    if (this.disconnected) return;
    const currentId = this.id;
    (0, $257947e92926277a$export$2e2bcd8739ae039).log(`Disconnect peer with ID:${currentId}`);
    this._disconnected = true;
    this._open = false;
    this.socket.close();
    this._lastServerId = currentId;
    this._id = null;
    this.emit("disconnected", currentId);
  }
  /** Attempts to reconnect with the same ID.
  *
  * Only {@apilink Peer.disconnect | disconnected peers} can be reconnected.
  * Destroyed peers cannot be reconnected.
  * If the connection fails (as an example, if the peer's old ID is now taken),
  * the peer's existing connections will not close, but any associated errors events will fire.
  */
  reconnect() {
    if (this.disconnected && !this.destroyed) {
      (0, $257947e92926277a$export$2e2bcd8739ae039).log(`Attempting reconnection to server with ID ${this._lastServerId}`);
      this._disconnected = false;
      this._initialize(this._lastServerId);
    } else if (this.destroyed) throw new Error("This peer cannot reconnect to the server. It has already been destroyed.");
    else if (!this.disconnected && !this.open)
      (0, $257947e92926277a$export$2e2bcd8739ae039).error("In a hurry? We're still trying to make the initial connection!");
    else throw new Error(`Peer ${this.id} cannot reconnect because it is not disconnected from the server!`);
  }
  /**
  * Get a list of available peer IDs. If you're running your own server, you'll
  * want to set allow_discovery: true in the PeerServer options. If you're using
  * the cloud server, email team@peerjs.com to get the functionality enabled for
  * your key.
  */
  listAllPeers(cb = (_) => {
  }) {
    this._api.listAllPeers().then((peers) => cb(peers)).catch((error) => this._abort((0, $78455e22dea96b8c$export$9547aaa2e39030ff).ServerError, error));
  }
};
var $dd0187d7f28e386f$export$2e2bcd8739ae039 = (0, $416260bce337df90$export$ecd1fc136c422448);

// src/transport.ts
var TransportBase = class {
  messageHandler = null;
  statusHandler = null;
  onMessage(handler) {
    this.messageHandler = handler;
  }
  onStatus(handler) {
    this.statusHandler = handler;
  }
  emitStatus(type, detail) {
    this.statusHandler?.({ type, detail });
  }
  emitMessage(message) {
    this.messageHandler?.(message);
  }
};
var LoopbackTransport = class extends TransportBase {
  name = "loopback";
  localId = "loopback-local";
  start() {
    this.emitStatus("ready", "loopback ready");
  }
  connect(remoteId) {
    this.emitStatus("connected", `loopback connected: ${remoteId || "self"}`);
  }
  send(message) {
    window.setTimeout(() => {
      this.emitMessage(message);
    }, 0);
  }
  getLocalId() {
    return this.localId;
  }
  dispose() {
    this.emitStatus("closed", "loopback closed");
  }
};
var PeerJsTransport = class extends TransportBase {
  name = "peerjs";
  preferredId;
  runtimeConfig;
  peer = null;
  connection = null;
  localId = "";
  constructor(localPeerId, runtimeConfig) {
    super();
    this.preferredId = localPeerId.trim();
    this.runtimeConfig = runtimeConfig;
  }
  start() {
    this.emitStatus("connecting", "creating peer");
    if (this.runtimeConfig && Array.isArray(this.runtimeConfig.iceServers)) {
      const options = {
        config: {
          iceServers: this.runtimeConfig.iceServers
        }
      };
      this.peer = this.preferredId ? new $dd0187d7f28e386f$export$2e2bcd8739ae039(this.preferredId, options) : new $dd0187d7f28e386f$export$2e2bcd8739ae039(options);
    } else {
      this.peer = this.preferredId ? new $dd0187d7f28e386f$export$2e2bcd8739ae039(this.preferredId) : new $dd0187d7f28e386f$export$2e2bcd8739ae039();
    }
    this.peer.on("open", (id) => {
      this.localId = id;
      this.emitStatus("ready", `peer ready: ${id}`);
    });
    this.peer.on("connection", (incomingConn) => {
      this.attachConnection(incomingConn, true);
    });
    this.peer.on("error", (error) => {
      this.emitStatus("error", `peer error: ${String(error)}`);
    });
    this.peer.on("disconnected", () => {
      this.emitStatus("error", "peer disconnected");
    });
    this.peer.on("close", () => {
      this.emitStatus("closed", "peer closed");
    });
  }
  connect(remoteId) {
    if (!this.peer) {
      this.emitStatus("error", "start peer first");
      return;
    }
    const target = remoteId.trim();
    if (!target) {
      this.emitStatus("error", "remote id is empty");
      return;
    }
    const conn = this.peer.connect(target, { reliable: true });
    this.attachConnection(conn, false);
  }
  send(message) {
    if (!this.connection || !this.connection.open) {
      this.emitStatus("error", "connection not open");
      return;
    }
    this.connection.send(message);
  }
  getLocalId() {
    return this.localId || this.preferredId;
  }
  dispose() {
    if (this.connection) {
      this.connection.close();
      this.connection = null;
    }
    if (this.peer) {
      this.peer.destroy();
      this.peer = null;
    }
    this.emitStatus("closed", "transport disposed");
  }
  attachConnection(conn, incoming) {
    if (this.connection && this.connection.open) {
      conn.close();
      this.emitStatus("error", "only one data connection is allowed");
      return;
    }
    this.connection = conn;
    this.emitStatus("connecting", incoming ? "incoming connection" : "connecting to remote");
    conn.on("open", () => {
      this.emitStatus("connected", `connected: ${conn.peer}`);
    });
    conn.on("data", (payload) => {
      if (!payload || typeof payload !== "object") {
        this.emitStatus("error", "invalid message payload");
        return;
      }
      this.emitMessage(payload);
    });
    conn.on("close", () => {
      this.emitStatus("ready", "data channel closed");
      this.connection = null;
    });
    conn.on("error", (error) => {
      this.emitStatus("error", `connection error: ${String(error)}`);
    });
  }
};
function createLoopbackTransport() {
  return new LoopbackTransport();
}
function createPeerJsTransport(localPeerId, runtimeConfig) {
  return new PeerJsTransport(localPeerId, runtimeConfig);
}

// src/replay.ts
var REPLAY_MAGIC = "RPY1";
var TYPE_TO_CODE = {
  move: "m",
  build: "b",
  scout: "s",
  attack: "a",
  endTurn: "e",
  unlockSkill: "u",
  needle: "n",
  amulet: "h",
  orb: "o",
  blink: "l"
};
var CODE_TO_TYPE = {
  m: "move",
  b: "build",
  s: "scout",
  a: "attack",
  e: "endTurn",
  u: "unlockSkill",
  n: "needle",
  h: "amulet",
  o: "orb",
  l: "blink"
};
function sideToCode(side) {
  return side === "blue" ? "b" : "r";
}
function codeToSide(code) {
  if (code === "b") {
    return "blue";
  }
  if (code === "r") {
    return "red";
  }
  throw new Error(`invalid side code: ${code}`);
}
function skillToCode(skill) {
  switch (skill) {
    case "role1":
      return "1";
    case "role2":
      return "2";
    case "role3":
      return "3";
    case "role4":
      return "4";
    default:
      return "0";
  }
}
function codeToSkill(code) {
  switch (code) {
    case "1":
      return "role1";
    case "2":
      return "role2";
    case "3":
      return "role3";
    case "4":
      return "role4";
    default:
      throw new Error(`invalid skill code: ${code}`);
  }
}
function parseIntStrict(value, fieldName) {
  if (!/^-?\d+$/.test(value)) {
    throw new Error(`invalid ${fieldName}: ${value}`);
  }
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed)) {
    throw new Error(`invalid ${fieldName}: ${value}`);
  }
  return parsed;
}
function encodeCommand(envelope) {
  const seq = String(envelope.seq);
  const code = TYPE_TO_CODE[envelope.command.type];
  const actor = sideToCode(envelope.command.actor);
  switch (envelope.command.type) {
    case "move":
    case "attack":
    case "amulet":
      return [seq, code, actor, envelope.command.to].join(",");
    case "build":
    case "needle":
    case "blink":
      return [seq, code, actor, envelope.command.to, String(envelope.command.spirit)].join(",");
    case "scout":
    case "endTurn":
      return [seq, code, actor].join(",");
    case "orb":
      return [seq, code, actor, String(envelope.command.spirit)].join(",");
    case "unlockSkill":
      return [seq, code, actor, skillToCode(envelope.command.skill)].join(",");
    default:
      throw new Error("unsupported command");
  }
}
function decodeCommand(line) {
  const parts = line.split(",");
  if (parts.length < 3) {
    throw new Error(`invalid replay line: ${line}`);
  }
  const seq = parseIntStrict(parts[0], "seq");
  const type = CODE_TO_TYPE[parts[1]];
  if (!type) {
    throw new Error(`invalid command type code: ${parts[1]}`);
  }
  const actor = codeToSide(parts[2]);
  let command;
  switch (type) {
    case "move":
    case "attack":
    case "amulet": {
      const to = parts[3];
      if (!to || !keyToCoord(to)) {
        throw new Error(`invalid target coordinate: ${to ?? ""}`);
      }
      if (type === "move") {
        command = { type, actor, to };
      } else if (type === "attack") {
        command = { type, actor, to };
      } else {
        command = { type, actor, to, spirit: 1 };
      }
      break;
    }
    case "build":
    case "needle":
    case "blink": {
      const to = parts[3];
      const spiritRaw = parts[4] ?? "";
      if (!to || !keyToCoord(to)) {
        throw new Error(`invalid target coordinate: ${to ?? ""}`);
      }
      const spirit = parseIntStrict(spiritRaw, "spirit");
      command = { type, actor, to, spirit };
      break;
    }
    case "scout":
      command = { type, actor };
      break;
    case "endTurn":
      command = { type, actor };
      break;
    case "orb": {
      const spirit = parseIntStrict(parts[3] ?? "", "spirit");
      command = { type, actor, spirit };
      break;
    }
    case "unlockSkill": {
      const skill = codeToSkill(parts[3] ?? "");
      command = { type, actor, skill };
      break;
    }
    default:
      throw new Error("unsupported command");
  }
  return {
    kind: "command",
    seq,
    command
  };
}
function packStats(state, side) {
  const stats = state.players[side].stats;
  return [
    stats.hp,
    stats.spirit,
    stats.maxSpirit,
    stats.atk,
    stats.vision,
    stats.moveRange,
    stats.gold
  ];
}
function unpackStats(base, side, packed) {
  const stats = base.players[side].stats;
  stats.hp = packed[0];
  stats.spirit = packed[1];
  stats.maxSpirit = packed[2];
  stats.atk = packed[3];
  stats.vision = packed[4];
  stats.moveRange = packed[5];
  stats.gold = packed[6];
}
function encodeInitialStats(state) {
  const values = [...packStats(state, "blue"), ...packStats(state, "red")];
  return `I,${values.join(",")}`;
}
function decodeInitialStats(line) {
  const parts = line.split(",");
  if (parts.length !== 15 || parts[0] !== "I") {
    throw new Error("invalid replay initial stats line");
  }
  const values = parts.slice(1).map((value) => parseIntStrict(value, "initial stat"));
  const blue = values.slice(0, 7);
  const red = values.slice(7, 14);
  return { blue, red };
}
function serializeReplay(envelopes, initialState) {
  const lines = [REPLAY_MAGIC, encodeInitialStats(initialState)];
  for (const envelope of envelopes) {
    lines.push(encodeCommand(envelope));
  }
  return lines.join("\n");
}
function deserializeReplay(content) {
  const lines = content.split(/\r?\n/).map((line) => line.trim()).filter((line) => line.length > 0);
  if (lines.length === 0 || lines[0] !== REPLAY_MAGIC) {
    throw new Error("invalid replay header");
  }
  let initialStats = null;
  let index = 1;
  if (lines[index]?.startsWith("I,")) {
    initialStats = decodeInitialStats(lines[index]);
    index += 1;
  }
  const commands = [];
  for (let i = index; i < lines.length; i += 1) {
    commands.push(decodeCommand(lines[i]));
  }
  return { initialStats, commands };
}
function buildReplayFilename(date = /* @__PURE__ */ new Date()) {
  const pad = (value) => String(value).padStart(2, "0");
  return [
    "thchess",
    `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}`,
    `${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`
  ].join("-") + ".rpy";
}
function buildReplayStates(parsed) {
  const first = createInitialState();
  if (parsed.initialStats) {
    unpackStats(first, "blue", parsed.initialStats.blue);
    unpackStats(first, "red", parsed.initialStats.red);
  }
  const states = [first];
  for (const envelope of parsed.commands) {
    const prev = states[states.length - 1];
    const applied = applyCommandEnvelope(prev, envelope);
    if (!applied.ok) {
      throw new Error(`seq=${envelope.seq} replay apply failed: ${applied.reason}`);
    }
    states.push(applied.state);
  }
  return states;
}
function terrainChar(terrain) {
  switch (terrain) {
    case "grass":
      return ",";
    case "spawnBlue":
      return "B";
    case "spawnRed":
      return "R";
    default:
      return ".";
  }
}
function pieceAt(coord, side, state) {
  return coordsEqual(state.players[side].pos, coord);
}
function renderPerspectiveBoard(state, side) {
  const perspective = buildPerspective(state, side);
  const lines = [];
  lines.push(`    ${COL_LABELS.join(" ")}`);
  for (let y = 0; y < BOARD_HEIGHT; y += 1) {
    let row = `${String(y + 1).padStart(2, " ")}  `;
    for (let x = 0; x < BOARD_WIDTH; x += 1) {
      const cell = perspective.cells[y * BOARD_WIDTH + x];
      let ch = terrainChar(cell.terrain);
      if (!cell.visible) {
        ch = "?";
      } else if (pieceAt(cell.coord, "blue", state)) {
        ch = "1";
      } else if (pieceAt(cell.coord, "red", state)) {
        ch = "2";
      } else if (cell.hasWall) {
        ch = "#";
      }
      row += ch;
      if (x < BOARD_WIDTH - 1) {
        row += " ";
      }
    }
    lines.push(row);
  }
  lines.push("\u56FE\u4F8B: 1=P1 2=P2 #=\u5899 ,=\u8349 ?=\u6218\u4E89\u8FF7\u96FE");
  return lines.join("\n");
}
function actionText(command) {
  const toDisplay = (key) => {
    const coord = keyToCoord(key);
    return coord ? `${COL_LABELS[coord.x]}:${coord.y + 1}` : key;
  };
  switch (command.type) {
    case "move":
      return `\u79FB\u52A8 -> ${toDisplay(command.to)}`;
    case "build":
      return `\u5EFA\u9020 -> ${toDisplay(command.to)} (\u7075\u529B${command.spirit})`;
    case "scout":
      return "\u4FA6\u5BDF";
    case "attack":
      return `\u666E\u653B -> ${toDisplay(command.to)}`;
    case "needle":
      return `\u5C01\u9B54\u9488 -> ${toDisplay(command.to)} (\u7075\u529B${command.spirit})`;
    case "amulet":
      return `\u7B26\u672D -> ${toDisplay(command.to)}`;
    case "orb":
      return `\u9634\u9633\u7389 (\u7075\u529B${command.spirit})`;
    case "blink":
      return `\u95EA\u73B0 -> ${toDisplay(command.to)} (\u7075\u529B${command.spirit})`;
    case "unlockSkill":
      return `\u89E3\u9501${command.skill}`;
    case "endTurn":
      return "\u7A7A\u8FC7";
    default:
      return command.type;
  }
}
function bootstrapReplayPage(appRoot, debugRoot) {
  appRoot.innerHTML = "";
  debugRoot.innerHTML = "";
  debugRoot.style.display = "none";
  const shell = document.createElement("section");
  shell.className = "replay-shell";
  const title = document.createElement("h2");
  title.textContent = "THChess Replay";
  title.style.margin = "0";
  shell.appendChild(title);
  const toolbar = document.createElement("div");
  toolbar.className = "replay-toolbar";
  shell.appendChild(toolbar);
  const fileInput = document.createElement("input");
  fileInput.type = "file";
  fileInput.accept = ".rpy,text/plain";
  toolbar.appendChild(fileInput);
  const controls = document.createElement("div");
  controls.className = "replay-controls";
  toolbar.appendChild(controls);
  const prevBtn = document.createElement("button");
  prevBtn.className = "debug-btn";
  prevBtn.textContent = "\u4E0A\u4E00\u6B65";
  controls.appendChild(prevBtn);
  const nextBtn = document.createElement("button");
  nextBtn.className = "debug-btn";
  nextBtn.textContent = "\u4E0B\u4E00\u6B65";
  controls.appendChild(nextBtn);
  const stepRange = document.createElement("input");
  stepRange.type = "range";
  stepRange.min = "0";
  stepRange.max = "0";
  stepRange.value = "0";
  stepRange.style.width = "220px";
  controls.appendChild(stepRange);
  const stepLabel = document.createElement("span");
  stepLabel.className = "replay-info";
  stepLabel.textContent = "\u6B65\u6570 0/0";
  toolbar.appendChild(stepLabel);
  const info = document.createElement("div");
  info.className = "replay-info";
  info.textContent = "\u8BF7\u9009\u62E9 .rpy \u6587\u4EF6";
  shell.appendChild(info);
  const panels = document.createElement("div");
  panels.className = "replay-panels";
  shell.appendChild(panels);
  const bluePanel = document.createElement("section");
  bluePanel.className = "replay-panel";
  panels.appendChild(bluePanel);
  const blueTitle = document.createElement("h3");
  blueTitle.className = "panel-title";
  blueTitle.style.borderBottom = "none";
  blueTitle.style.padding = "0 0 6px 0";
  blueTitle.textContent = "P1 \u84DD\u65B9\u89C6\u89D2";
  bluePanel.appendChild(blueTitle);
  const blueBoard = document.createElement("pre");
  blueBoard.className = "replay-board";
  bluePanel.appendChild(blueBoard);
  const redPanel = document.createElement("section");
  redPanel.className = "replay-panel";
  panels.appendChild(redPanel);
  const redTitle = document.createElement("h3");
  redTitle.className = "panel-title";
  redTitle.style.borderBottom = "none";
  redTitle.style.padding = "0 0 6px 0";
  redTitle.textContent = "P2 \u7EA2\u65B9\u89C6\u89D2";
  redPanel.appendChild(redTitle);
  const redBoard = document.createElement("pre");
  redBoard.className = "replay-board";
  redPanel.appendChild(redBoard);
  const announcePanel = document.createElement("section");
  announcePanel.className = "panel announcement-panel";
  shell.appendChild(announcePanel);
  const announceTitle = document.createElement("h3");
  announceTitle.className = "panel-title";
  announceTitle.textContent = "\u516C\u544A\u8BB0\u5F55";
  announcePanel.appendChild(announceTitle);
  const announceList = document.createElement("div");
  announceList.className = "announcement-list";
  announcePanel.appendChild(announceList);
  appRoot.appendChild(shell);
  let commands = [];
  let states = [createInitialState()];
  let step = 0;
  const render = () => {
    if (states.length === 0) {
      return;
    }
    if (step < 0) {
      step = 0;
    }
    if (step >= states.length) {
      step = states.length - 1;
    }
    const state = states[step];
    stepLabel.textContent = `\u6B65\u6570 ${step}/${Math.max(0, states.length - 1)}`;
    stepRange.max = String(Math.max(0, states.length - 1));
    stepRange.value = String(step);
    prevBtn.disabled = step <= 0;
    nextBtn.disabled = step >= states.length - 1;
    const commandText = step > 0 ? actionText(commands[step - 1].command) : "\u521D\u59CB\u5C40\u9762";
    info.textContent = `seq=${state.seq} | \u56DE\u5408=${state.turn.round} | \u5F53\u524D=${state.turn.side === "blue" ? "P1" : "P2"} | \u64CD\u4F5C=${commandText}` + (state.winner ? ` | \u8D62\u5BB6=${state.winner === "blue" ? "P1 \u84DD\u65B9" : "P2 \u7EA2\u65B9"}` : "");
    blueBoard.textContent = renderPerspectiveBoard(state, "blue");
    redBoard.textContent = renderPerspectiveBoard(state, "red");
    announceList.innerHTML = "";
    const history = [...state.announcements].reverse();
    if (history.length === 0) {
      const empty = document.createElement("div");
      empty.className = "announcement-item";
      empty.textContent = "\u6682\u65E0\u516C\u544A";
      announceList.appendChild(empty);
    } else {
      for (const entry of history) {
        const item = document.createElement("div");
        item.className = "announcement-item";
        const sideMatch = entry.match(/^\[回合\d+P([12]):/);
        if (sideMatch?.[1] === "1") {
          item.classList.add("announcement-blue");
        } else if (sideMatch?.[1] === "2") {
          item.classList.add("announcement-red");
        }
        item.textContent = entry;
        announceList.appendChild(item);
      }
    }
  };
  fileInput.addEventListener("change", async () => {
    const file = fileInput.files?.[0];
    if (!file) {
      return;
    }
    try {
      const content = await file.text();
      const parsed = deserializeReplay(content);
      commands = parsed.commands;
      states = buildReplayStates(parsed);
      step = states.length - 1;
      render();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      info.textContent = `\u56DE\u653E\u6587\u4EF6\u89E3\u6790\u5931\u8D25: ${message}`;
      commands = [];
      states = [createInitialState()];
      step = 0;
      render();
    }
  });
  prevBtn.addEventListener("click", () => {
    step -= 1;
    render();
  });
  nextBtn.addEventListener("click", () => {
    step += 1;
    render();
  });
  stepRange.addEventListener("input", () => {
    step = Number(stepRange.value);
    render();
  });
  render();
}

// src/view.ts
var SKILLS = [
  { id: "move", label: "\u79FB\u52D5", basic: true },
  { id: "build", label: "\u5EFA\u9020", basic: true },
  { id: "scout", label: "\u5075\u5BDF", basic: true },
  { id: "attack", label: "\u666E\u653B", basic: true },
  { id: "role1", label: "", basic: false },
  { id: "role2", label: "", basic: false },
  { id: "role3", label: "", basic: false },
  { id: "role4", label: "", basic: false }
];
var SKILL_TOOLTIPS = {
  move: "\u8FDB\u884C\u4E00\u6B21\u8DDD\u79BB\u4E3A1\u76848\u5411\u79FB\u52A8\u3002\u5F53\u671D\u5411\u6B63\u4E0A\u4E0B\u5DE6\u53F3\u79FB\u52A8\u65F6\uFF0C\u4F7F\u81EA\u8EAB\u7075\u529B+1\uFF0C\u5426\u5219\u4E0D\u53D8\u3002\u65E0\u6CD5\u79FB\u52A8\u81F3\u5899\u4F53\u6216\u5176\u4ED6\u673A\u4F53\u3002",
  build: "\u6D88\u8D39N\u7075\u529B\uFF0C\u5728\u8DDD\u79BB\u4E3AN\u7684\u8303\u56F4\u5185\u5EFA\u9020\u751F\u547D\u503C/\u751F\u547D\u503C\u4E0A\u9650\u4E3AN\u7684\u5899\u4F53\u3002\u5899\u4F53\u65E0\u6CD5\u5EFA\u9020\u5728\u4EFB\u610F\u5355\u4F4D\u4E4B\u4E0A\u3002",
  scout: "\u6D88\u8D391\u7075\u529B\uFF0C\u7ACB\u523B\u83B7\u5F97\u5BF9\u65B9\u5750\u6807\u3002",
  attack: "\u6D88\u8D390\u7075\u529B\uFF0C\u8FDB\u884C\u4E00\u6B21\u8DDD\u79BB\u4E3A1\u7684\u653B\u51FB\u3002",
  role1: "\u8017N\u7075\u529B\uFF0C\u671D\u76EE\u6807\u65B9\u5411\u9010\u53D1N\u679A\u5C01\u9B54\u9488\uFF0C\u547D\u4E2D\u9996\u4E2A\u5355\u4F4D\u90201\u4F24\u5BB3\u3002",
  role2: "\u6D88\u8D391\u7075\u529B\uFF0C\u9020\u6210\u7A7F\u900F\u4F24\u5BB3\uFF0C\u5BF9\u8DEF\u5F84\u4E0A\u6240\u6709\u5355\u4F4D\u9020\u62101\u4F24\u5BB3\uFF0C\u5BF9\u654C\u673A\u9020\u6210\u4F24\u5BB3\u540E\u8FD4\u8FD81\u7075\u529B\u3002",
  role3: "\u8017N\u7075\u529B\uFF0C\u83B7\u5F97\u534A\u5F84N\u89C6\u91CE\uFF0C\u6301\u7EEDN\u56DE\u5408\u3002",
  role4: "\u8017N\u7075\u529B\uFF0C\u95EA\u73B0\u81F3\u534A\u5F84N\u5185\u7A7A\u683C\uFF08\u975E\u79FB\u52A8\uFF09\u3002"
};
var VARIABLE_SPIRIT_SKILLS = /* @__PURE__ */ new Set(["build", "role1", "role3", "role4"]);
function loadImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.src = src;
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`load image failed: ${src}`));
  });
}
async function loadRoleIconSet(prefix) {
  const [normal, selected, selecting] = await Promise.all([
    loadImage(`./assets/skill/reimu/${prefix}.png`),
    loadImage(`./assets/skill/reimu/${prefix}_selected.png`),
    loadImage(`./assets/skill/reimu/${prefix}_selecting.png`)
  ]);
  return { normal, selected, selecting };
}
async function loadAssets() {
  const [ground, grass, spawn, wall, char, needle, amulet, orbEffect, role1, role2, role3, role4] = await Promise.all([
    loadImage("./assets/tiles/ground.png"),
    loadImage("./assets/tiles/grass.png"),
    loadImage("./assets/tiles/spawn.png"),
    loadImage("./assets/tiles/wall.png"),
    loadImage("./assets/char/reimu.png"),
    loadImage("./assets/bullet/reimu/reimuneedle.png"),
    loadImage("./assets/bullet/reimu/reimuamulet.png"),
    loadImage("./assets/bullet/reimu/yinyangorb.png"),
    loadRoleIconSet("reimu_1"),
    loadRoleIconSet("reimu_2"),
    loadRoleIconSet("reimu_3"),
    loadRoleIconSet("reimu_4")
  ]);
  const numbers = /* @__PURE__ */ new Map();
  const numberSrc = /* @__PURE__ */ new Map();
  const tasks = [];
  for (let value = 1; value <= 10; value += 1) {
    const file = value === 10 ? "no10.png" : `no${value}.png`;
    const src = `./assets/number/${file}`;
    numberSrc.set(value, src);
    tasks.push(
      loadImage(src).then((image) => {
        numbers.set(value, image);
      })
    );
  }
  await Promise.all(tasks);
  return {
    ground,
    grass,
    spawn,
    wall,
    char,
    needle,
    amulet,
    orbEffect,
    roleIcons: {
      role1,
      role2,
      role3,
      role4
    },
    numbers,
    numberSrc
  };
}
function getCell(cells, x, y) {
  return cells[y * BOARD_WIDTH + x];
}
function coordsOrNullEqual(a, b) {
  if (!a && !b) {
    return true;
  }
  if (!a || !b) {
    return false;
  }
  return a.x === b.x && a.y === b.y;
}
function buildRayEdgePoint(origin, target) {
  const startX = origin.x + 0.5;
  const startY = origin.y + 0.5;
  const dx = target.x + 0.5 - startX;
  const dy = target.y + 0.5 - startY;
  if (dx === 0 && dy === 0) {
    return null;
  }
  let tMin = Number.POSITIVE_INFINITY;
  if (dx > 0) {
    tMin = Math.min(tMin, (BOARD_WIDTH - startX) / dx);
  } else if (dx < 0) {
    tMin = Math.min(tMin, (0 - startX) / dx);
  }
  if (dy > 0) {
    tMin = Math.min(tMin, (BOARD_HEIGHT - startY) / dy);
  } else if (dy < 0) {
    tMin = Math.min(tMin, (0 - startY) / dy);
  }
  if (!Number.isFinite(tMin) || tMin <= 0) {
    return null;
  }
  return {
    x: startX + dx * tMin,
    y: startY + dy * tMin
  };
}
function easeOutQuad(t) {
  return t * (2 - t);
}
function easeInQuad(t) {
  return t * t;
}
function getDisplayNumberTexture(assets, value) {
  if (value <= 0) {
    return null;
  }
  const clamped = Math.min(10, Math.floor(value));
  return assets.numbers.get(clamped) ?? null;
}
function getDisplayNumberSrc(assets, value) {
  if (value <= 0) {
    return null;
  }
  const clamped = Math.min(10, Math.floor(value));
  return assets.numberSrc.get(clamped) ?? null;
}
function isVariableSkill(skill) {
  return Boolean(skill && VARIABLE_SPIRIT_SKILLS.has(skill));
}
function isRayIndicatorSkill(skill) {
  return skill === "role1" || skill === "role2" || skill === "role4";
}
async function createGameView(root) {
  const assets = await loadAssets();
  let handlers = {
    onCellClick: () => void 0,
    onSkillClick: () => void 0,
    onUnlockSkill: () => void 0,
    onEndTurnClick: () => void 0,
    onSpiritAdjust: () => void 0
  };
  let lastPayload = null;
  let boardMetrics = null;
  let attackAnimation = null;
  let animationFrame = 0;
  let hoverCoord = null;
  let projectileId = 0;
  let projectileBatchId = 0;
  const projectileAnimations = [];
  const projectileBatchStates = /* @__PURE__ */ new Map();
  const shell = document.createElement("div");
  shell.className = "game-shell";
  const frame = document.createElement("div");
  frame.className = "game-frame";
  shell.appendChild(frame);
  const boardPanel = document.createElement("section");
  boardPanel.className = "panel board-panel";
  frame.appendChild(boardPanel);
  const turnBar = document.createElement("div");
  turnBar.className = "turn-bar";
  boardPanel.appendChild(turnBar);
  const turnBlue = document.createElement("span");
  turnBlue.className = "turn-side turn-blue";
  turnBlue.textContent = "\u84DD\u65B9";
  turnBar.appendChild(turnBlue);
  const turnCenter = document.createElement("span");
  turnCenter.className = "turn-center";
  turnCenter.textContent = "\u7B2C1\u56DE\u5408";
  turnBar.appendChild(turnCenter);
  const turnRed = document.createElement("span");
  turnRed.className = "turn-side turn-red";
  turnRed.textContent = "\u7EA2\u65B9";
  turnBar.appendChild(turnRed);
  const boardCanvasWrap = document.createElement("div");
  boardCanvasWrap.className = "board-canvas-wrap";
  boardPanel.appendChild(boardCanvasWrap);
  const boardCanvas = document.createElement("canvas");
  boardCanvas.className = "board-canvas";
  boardCanvasWrap.appendChild(boardCanvas);
  const announcementPanel = document.createElement("section");
  announcementPanel.className = "panel announcement-panel";
  frame.appendChild(announcementPanel);
  const announcementTitle = document.createElement("h3");
  announcementTitle.className = "panel-title";
  announcementTitle.textContent = "\u516C\u544A";
  announcementPanel.appendChild(announcementTitle);
  const announcementList = document.createElement("div");
  announcementList.className = "announcement-list";
  announcementPanel.appendChild(announcementList);
  const skillPanel = document.createElement("section");
  skillPanel.className = "panel skill-panel";
  frame.appendChild(skillPanel);
  const skillLayout = document.createElement("div");
  skillLayout.className = "skill-layout";
  skillPanel.appendChild(skillLayout);
  const skillLeft = document.createElement("div");
  skillLeft.className = "skill-left";
  skillLayout.appendChild(skillLeft);
  const basicSkillGrid = document.createElement("div");
  basicSkillGrid.className = "basic-skill-grid";
  skillLeft.appendChild(basicSkillGrid);
  const roleSkillGrid = document.createElement("div");
  roleSkillGrid.className = "role-skill-grid";
  skillLeft.appendChild(roleSkillGrid);
  const skillButtons = /* @__PURE__ */ new Map();
  const roleDurationBadges = /* @__PURE__ */ new Map();
  const tooltip = document.createElement("div");
  tooltip.className = "skill-tooltip";
  tooltip.style.display = "none";
  skillPanel.appendChild(tooltip);
  const unlockPopup = document.createElement("div");
  unlockPopup.className = "unlock-popup";
  unlockPopup.style.display = "none";
  const unlockText = document.createElement("div");
  unlockText.className = "unlock-text";
  unlockText.textContent = "\u4F7F\u7528100\u91D1\u5E01\u89E3\u9501\u6280\u80FD\uFF1F";
  unlockPopup.appendChild(unlockText);
  const unlockActions = document.createElement("div");
  unlockActions.className = "unlock-actions";
  const unlockYes = document.createElement("button");
  unlockYes.className = "unlock-btn";
  unlockYes.textContent = "\u89E3\u9501";
  const unlockNo = document.createElement("button");
  unlockNo.className = "unlock-btn";
  unlockNo.textContent = "\u53D6\u6D88";
  unlockActions.append(unlockYes, unlockNo);
  unlockPopup.appendChild(unlockActions);
  skillPanel.appendChild(unlockPopup);
  let unlockPendingSkill = null;
  function hideUnlockPopup() {
    unlockPopup.style.display = "none";
    unlockPendingSkill = null;
  }
  function hideTooltip() {
    tooltip.style.display = "none";
  }
  function showTooltip(skill, anchor) {
    const text = SKILL_TOOLTIPS[skill];
    if (!text) {
      return;
    }
    tooltip.textContent = text;
    tooltip.style.display = "block";
    const panelRect = skillPanel.getBoundingClientRect();
    const anchorRect = anchor.getBoundingClientRect();
    const tooltipWidth = 210;
    const left = anchorRect.left - panelRect.left + (anchorRect.width - tooltipWidth) * 0.5;
    const top = anchorRect.top - panelRect.top - 52;
    tooltip.style.left = `${Math.max(0, left)}px`;
    tooltip.style.top = `${Math.max(0, top)}px`;
  }
  function showUnlockPopup(skill, anchor) {
    if (!lastPayload) {
      return;
    }
    const unit = lastPayload.state.players[lastPayload.localSide];
    const canUnlock = !lastPayload.state.winner && lastPayload.connected && lastPayload.state.turn.side === lastPayload.localSide && !unit.skills[skill] && unit.stats.gold >= 100;
    unlockPendingSkill = skill;
    unlockText.textContent = canUnlock ? "\u4F7F\u7528100\u91D1\u5E01\u89E3\u9501\u8BE5\u6280\u80FD\uFF1F" : "\u91D1\u5E01\u4E0D\u8DB3\u6216\u5F53\u524D\u4E0D\u53EF\u89E3\u9501";
    unlockYes.disabled = !canUnlock;
    const panelRect = skillPanel.getBoundingClientRect();
    const anchorRect = anchor.getBoundingClientRect();
    const popupWidth = 182;
    const popupHeight = 82;
    const left = anchorRect.left - panelRect.left + (anchorRect.width - popupWidth) * 0.5;
    const top = anchorRect.top - panelRect.top - popupHeight - 6;
    unlockPopup.style.display = "block";
    unlockPopup.style.left = `${Math.max(0, left)}px`;
    unlockPopup.style.top = `${Math.max(0, top)}px`;
  }
  unlockYes.addEventListener("click", () => {
    if (!unlockPendingSkill) {
      return;
    }
    const skill = unlockPendingSkill;
    hideUnlockPopup();
    handlers.onUnlockSkill(skill);
  });
  unlockNo.addEventListener("click", () => {
    hideUnlockPopup();
  });
  for (const skill of SKILLS) {
    const button = document.createElement("button");
    button.className = `skill-btn hollow-frame ${skill.basic ? "skill-basic" : "skill-role"}`;
    button.textContent = skill.label;
    button.dataset.skill = skill.id;
    if (!skill.basic && isRoleSkillId(skill.id)) {
      const badge = document.createElement("img");
      badge.className = "skill-duration";
      badge.alt = "duration";
      badge.draggable = false;
      badge.style.display = "none";
      button.appendChild(badge);
      roleDurationBadges.set(skill.id, badge);
    }
    button.addEventListener("mouseenter", () => {
      showTooltip(skill.id, button);
    });
    button.addEventListener("mouseleave", () => {
      hideTooltip();
    });
    button.addEventListener("click", () => {
      if (!lastPayload) {
        return;
      }
      hideTooltip();
      if (isRoleSkillId(skill.id)) {
        const unit = lastPayload.state.players[lastPayload.localSide];
        if (!unit.skills[skill.id]) {
          showUnlockPopup(skill.id, button);
          return;
        }
      }
      hideUnlockPopup();
      handlers.onSkillClick(skill.id);
    });
    if (skill.basic) {
      basicSkillGrid.appendChild(button);
    } else {
      roleSkillGrid.appendChild(button);
    }
    skillButtons.set(skill.id, button);
  }
  const spiritPopup = document.createElement("div");
  spiritPopup.className = "spirit-popup";
  const spiritUp = document.createElement("button");
  spiritUp.className = "spirit-btn";
  spiritUp.textContent = "\u25B2";
  spiritUp.addEventListener("click", () => handlers.onSpiritAdjust(1));
  spiritPopup.appendChild(spiritUp);
  const spiritValue = document.createElement("div");
  spiritValue.className = "spirit-value";
  spiritPopup.appendChild(spiritValue);
  const spiritDown = document.createElement("button");
  spiritDown.className = "spirit-btn";
  spiritDown.textContent = "\u25BC";
  spiritDown.addEventListener("click", () => handlers.onSpiritAdjust(-1));
  spiritPopup.appendChild(spiritDown);
  skillPanel.appendChild(spiritPopup);
  const skillActions = document.createElement("div");
  skillActions.className = "skill-actions";
  skillLayout.appendChild(skillActions);
  const endTurnButton = document.createElement("button");
  endTurnButton.className = "end-turn-btn hollow-frame";
  endTurnButton.textContent = "\u7A7A\u8FC7";
  endTurnButton.addEventListener("click", () => {
    handlers.onEndTurnClick();
  });
  skillActions.appendChild(endTurnButton);
  const statusPanel = document.createElement("section");
  statusPanel.className = "panel status-panel";
  frame.appendChild(statusPanel);
  const statusTitle = document.createElement("h3");
  statusTitle.className = "panel-title";
  statusTitle.textContent = "\u6570\u503C";
  statusPanel.appendChild(statusTitle);
  const statusList = document.createElement("div");
  statusList.className = "status-list";
  statusPanel.appendChild(statusList);
  const statusHp = document.createElement("div");
  const statusSpirit = document.createElement("div");
  const statusAtk = document.createElement("div");
  const statusCoord = document.createElement("div");
  const statusGold = document.createElement("div");
  statusList.append(statusHp, statusSpirit, statusAtk, statusCoord, statusGold);
  root.innerHTML = "";
  root.appendChild(shell);
  function updateCanvasSize() {
    const rect = boardCanvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    boardCanvas.width = Math.max(1, Math.floor(rect.width * dpr));
    boardCanvas.height = Math.max(1, Math.floor(rect.height * dpr));
    return {
      dpr,
      width: boardCanvas.width / dpr,
      height: boardCanvas.height / dpr
    };
  }
  function getAnimatedCoord(side) {
    if (!attackAnimation || attackAnimation.actor !== side) {
      return null;
    }
    const elapsed = performance.now() - attackAnimation.startedAt;
    const t = Math.max(0, Math.min(1, elapsed / attackAnimation.durationMs));
    if (t >= 1) {
      attackAnimation = null;
      return null;
    }
    if (t < 0.5) {
      const p2 = easeOutQuad(t * 2);
      return {
        x: attackAnimation.from.x + (attackAnimation.to.x - attackAnimation.from.x) * p2,
        y: attackAnimation.from.y + (attackAnimation.to.y - attackAnimation.from.y) * p2
      };
    }
    const p = easeInQuad((t - 0.5) * 2);
    return {
      x: attackAnimation.to.x + (attackAnimation.from.x - attackAnimation.to.x) * p,
      y: attackAnimation.to.y + (attackAnimation.from.y - attackAnimation.to.y) * p
    };
  }
  function getProjectileRenderState(animation, now) {
    const elapsed = now - animation.startedAt - animation.delayMs;
    if (elapsed < 0) {
      return null;
    }
    const dx = animation.end.x - animation.start.x;
    const dy = animation.end.y - animation.start.y;
    if (Math.abs(dx) < 1e-4 && Math.abs(dy) < 1e-4) {
      return null;
    }
    const t = Math.max(0, Math.min(1, elapsed / animation.durationMs));
    if (t >= 1) {
      return null;
    }
    return {
      pos: {
        x: animation.start.x + dx * t,
        y: animation.start.y + dy * t
      },
      angle: Math.atan2(dy, dx) + Math.PI / 2
    };
  }
  function completeProjectile(animation) {
    if (animation.done) {
      return;
    }
    animation.done = true;
    const batch = projectileBatchStates.get(animation.batchId);
    if (!batch) {
      return;
    }
    batch.pending -= 1;
    if (batch.pending <= 0) {
      projectileBatchStates.delete(animation.batchId);
      batch.resolve();
    }
  }
  function drawBoard(payload) {
    const canvasSize = updateCanvasSize();
    const ctx = boardCanvas.getContext("2d");
    if (!ctx) {
      return;
    }
    const { dpr, width: w, height: h } = canvasSize;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, w, h);
    const labelSpace = Math.max(20, Math.floor(Math.min(w, h) * 0.05));
    const tile = Math.max(
      12,
      Math.floor(Math.min((w - labelSpace * 2) / BOARD_WIDTH, (h - labelSpace * 2) / BOARD_HEIGHT))
    );
    const boardW = tile * BOARD_WIDTH;
    const boardH = tile * BOARD_HEIGHT;
    const left = Math.floor((w - boardW - labelSpace) * 0.5 + labelSpace);
    const top = Math.floor((h - boardH - labelSpace) * 0.5 + labelSpace);
    boardMetrics = { left, top, tile, width: boardW, height: boardH };
    const moveHighlightKeys = new Set(payload.highlights.moveHighlights.map((coord) => coordToKey(coord)));
    const attackHighlightKeys = new Set(payload.highlights.attackHighlights.map((coord) => coordToKey(coord)));
    ctx.fillStyle = "#fff";
    ctx.font = `${Math.max(11, Math.floor(tile * 0.38))}px 'zpix', monospace`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    for (let x = 0; x < BOARD_WIDTH; x += 1) {
      ctx.fillText(COL_LABELS[x], left + x * tile + tile * 0.5, top - Math.floor(labelSpace * 0.45));
    }
    for (let y = 0; y < BOARD_HEIGHT; y += 1) {
      ctx.fillText(String(y + 1), left - Math.floor(labelSpace * 0.45), top + y * tile + tile * 0.5);
    }
    const drawTerrain = (cell, px, py) => {
      let image = assets.ground;
      if (cell.terrain === "grass") {
        image = assets.grass;
      } else if (cell.terrain === "spawnBlue" || cell.terrain === "spawnRed") {
        image = assets.spawn;
      }
      ctx.drawImage(image, px, py, tile, tile);
      if (cell.hasWall) {
        ctx.drawImage(assets.wall, px, py, tile, tile);
      }
      if (!cell.visible) {
        ctx.fillStyle = "rgba(0,0,0,0.65)";
        ctx.fillRect(px, py, tile, tile);
      }
    };
    for (let y = 0; y < BOARD_HEIGHT; y += 1) {
      for (let x = 0; x < BOARD_WIDTH; x += 1) {
        const cell = getCell(payload.perspective.cells, x, y);
        const px = left + x * tile;
        const py = top + y * tile;
        drawTerrain(cell, px, py);
        if (moveHighlightKeys.has(coordToKey(cell.coord))) {
          ctx.fillStyle = "rgba(80, 160, 255, 0.35)";
          ctx.fillRect(px, py, tile, tile);
        }
        if (attackHighlightKeys.has(coordToKey(cell.coord))) {
          ctx.fillStyle = "rgba(255, 80, 80, 0.35)";
          ctx.fillRect(px, py, tile, tile);
        }
        ctx.strokeStyle = "rgba(255,255,255,0.2)";
        ctx.lineWidth = 1;
        ctx.strokeRect(px + 0.5, py + 0.5, tile - 1, tile - 1);
      }
    }
    for (let y = 0; y < BOARD_HEIGHT; y += 1) {
      for (let x = 0; x < BOARD_WIDTH; x += 1) {
        const cell = getCell(payload.perspective.cells, x, y);
        if (cell.wallHp === null || cell.wallHp <= 0) {
          continue;
        }
        const numTexture = getDisplayNumberTexture(assets, cell.wallHp);
        if (!numTexture) {
          continue;
        }
        const px = left + x * tile;
        const py = top + y * tile;
        const size = Math.floor(tile * 0.58);
        ctx.drawImage(
          numTexture,
          px + Math.floor((tile - size) * 0.5),
          py + Math.floor((tile - size) * 0.5),
          size,
          size
        );
      }
    }
    const now = performance.now();
    const drawPiece = (side) => {
      const logicalPos = payload.perspective.pieces[side];
      if (!logicalPos) {
        return;
      }
      const animated = getAnimatedCoord(side);
      const drawPos = animated ?? logicalPos;
      const px = left + drawPos.x * tile;
      const py = top + drawPos.y * tile;
      const pad = Math.floor(tile * 0.08);
      ctx.drawImage(assets.char, px + pad, py + pad, tile - pad * 2, tile - pad * 2);
      ctx.strokeStyle = side === "blue" ? "#58a8ff" : "#ff6565";
      ctx.lineWidth = Math.max(2, Math.floor(tile * 0.08));
      ctx.strokeRect(px + 2, py + 2, tile - 4, tile - 4);
      const unit = payload.state.players[side];
      if (unit.effects.orbTurns > 0) {
        const centerX = px + tile * 0.5;
        const centerY = py + tile * 0.5;
        const orbitRadius = tile * (0.28 + Math.min(0.5, unit.effects.orbVisionRadius * 0.04));
        const angle = now * 4e-3 + (side === "blue" ? 0 : Math.PI);
        const orbSize = Math.floor(tile * 0.42);
        const orbX = centerX + Math.cos(angle) * orbitRadius - orbSize * 0.5;
        const orbY = centerY + Math.sin(angle) * orbitRadius - orbSize * 0.5;
        ctx.drawImage(assets.orbEffect, orbX, orbY, orbSize, orbSize);
        const turnTexture = getDisplayNumberTexture(assets, unit.effects.orbTurns);
        if (turnTexture) {
          const badgeSize = Math.floor(tile * 0.34);
          ctx.drawImage(turnTexture, px + tile - badgeSize - 2, py + 2, badgeSize, badgeSize);
        }
      }
    };
    drawPiece("blue");
    drawPiece("red");
    const activeSkill = payload.input.activeSkill;
    if (isRayIndicatorSkill(activeSkill) && hoverCoord) {
      const self = payload.state.players[payload.localSide].pos;
      const hoverLeft = left + hoverCoord.x * tile;
      const hoverTop = top + hoverCoord.y * tile;
      const indicatorColor = activeSkill === "role4" ? "rgba(90, 170, 255, 0.95)" : "rgba(255, 66, 66, 0.95)";
      ctx.save();
      ctx.fillStyle = activeSkill === "role4" ? "rgba(90, 170, 255, 0.26)" : "rgba(255, 66, 66, 0.24)";
      ctx.fillRect(hoverLeft, hoverTop, tile, tile);
      ctx.strokeStyle = indicatorColor;
      ctx.lineWidth = Math.max(2, Math.floor(tile * 0.08));
      ctx.strokeRect(hoverLeft + 1, hoverTop + 1, tile - 2, tile - 2);
      ctx.restore();
      const lineTarget = activeSkill === "role4" ? { x: hoverCoord.x + 0.5, y: hoverCoord.y + 0.5 } : buildRayEdgePoint(self, hoverCoord);
      if (lineTarget) {
        const fromX = left + (self.x + 0.5) * tile;
        const fromY = top + (self.y + 0.5) * tile;
        const toX = left + lineTarget.x * tile;
        const toY = top + lineTarget.y * tile;
        if (Math.abs(toX - fromX) >= 0.01 || Math.abs(toY - fromY) >= 0.01) {
          ctx.save();
          ctx.strokeStyle = indicatorColor;
          ctx.lineWidth = Math.max(2, Math.floor(tile * 0.08));
          ctx.setLineDash([Math.max(4, Math.floor(tile * 0.22)), Math.max(2, Math.floor(tile * 0.13))]);
          ctx.beginPath();
          ctx.moveTo(fromX, fromY);
          ctx.lineTo(toX, toY);
          ctx.stroke();
          ctx.setLineDash([]);
          ctx.restore();
        }
      }
    }
    for (const animation of projectileAnimations) {
      if (animation.done) {
        continue;
      }
      const maxTime = animation.startedAt + animation.delayMs + animation.durationMs;
      if (now >= maxTime) {
        completeProjectile(animation);
        continue;
      }
      const renderState = getProjectileRenderState(animation, now);
      if (!renderState) {
        continue;
      }
      if (animation.actor !== payload.localSide) {
        const cx = Math.floor(renderState.pos.x);
        const cy = Math.floor(renderState.pos.y);
        if (cx < 0 || cx >= BOARD_WIDTH || cy < 0 || cy >= BOARD_HEIGHT) {
          continue;
        }
        if (!getCell(payload.perspective.cells, cx, cy).visible) {
          continue;
        }
      }
      const image = animation.kind === "needle" ? assets.needle : assets.amulet;
      const px = left + renderState.pos.x * tile;
      const py = top + renderState.pos.y * tile;
      const size = Math.floor(tile * (animation.kind === "needle" ? 0.52 : 0.58));
      ctx.save();
      ctx.translate(px, py);
      ctx.rotate(renderState.angle);
      ctx.drawImage(image, -size * 0.5, -size * 0.5, size, size);
      ctx.restore();
    }
  }
  function refreshSpiritPopup(payload) {
    const activeSkill = payload.input.activeSkill;
    const show = payload.spiritSelector.visible && isVariableSkill(activeSkill);
    if (!show || !activeSkill) {
      spiritPopup.style.display = "none";
      return;
    }
    const anchor = skillButtons.get(activeSkill);
    if (!anchor) {
      spiritPopup.style.display = "none";
      return;
    }
    spiritPopup.style.display = "flex";
    spiritValue.textContent = String(payload.spiritSelector.value);
    spiritUp.disabled = payload.spiritSelector.value >= payload.spiritSelector.max;
    spiritDown.disabled = payload.spiritSelector.value <= payload.spiritSelector.min;
    const panelRect = skillPanel.getBoundingClientRect();
    const anchorRect = anchor.getBoundingClientRect();
    const popupWidth = 70;
    const popupHeight = 64;
    const left = anchorRect.left - panelRect.left + (anchorRect.width - popupWidth) * 0.5;
    const top = anchorRect.top - panelRect.top - popupHeight - 6;
    spiritPopup.style.left = `${Math.max(0, left)}px`;
    spiritPopup.style.top = `${Math.max(0, top)}px`;
  }
  function getBoardCoordFromClient(clientX, clientY) {
    if (!boardMetrics) {
      return null;
    }
    const rect = boardCanvas.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;
    const inside = x >= boardMetrics.left && x < boardMetrics.left + boardMetrics.width && y >= boardMetrics.top && y < boardMetrics.top + boardMetrics.height;
    if (!inside) {
      return null;
    }
    return {
      x: Math.floor((x - boardMetrics.left) / boardMetrics.tile),
      y: Math.floor((y - boardMetrics.top) / boardMetrics.tile)
    };
  }
  boardCanvas.addEventListener("mousemove", (event) => {
    const nextHover = getBoardCoordFromClient(event.clientX, event.clientY);
    if (coordsOrNullEqual(nextHover, hoverCoord)) {
      return;
    }
    hoverCoord = nextHover;
    if (lastPayload && isRayIndicatorSkill(lastPayload.input.activeSkill)) {
      render(lastPayload);
    }
  });
  boardCanvas.addEventListener("mouseleave", () => {
    if (!hoverCoord) {
      return;
    }
    hoverCoord = null;
    if (lastPayload && isRayIndicatorSkill(lastPayload.input.activeSkill)) {
      render(lastPayload);
    }
  });
  boardCanvas.addEventListener("click", (event) => {
    hideUnlockPopup();
    hideTooltip();
    const coord = getBoardCoordFromClient(event.clientX, event.clientY);
    if (!coord) {
      return;
    }
    handlers.onCellClick(coord);
  });
  function renderSkillState(payload) {
    const availability = payload.skillAvailability;
    const self = payload.state.players[payload.localSide];
    for (const skill of SKILLS) {
      const button = skillButtons.get(skill.id);
      if (!button) {
        continue;
      }
      const isRole = isRoleSkillId(skill.id);
      const unlocked = !isRole || self.skills[skill.id];
      const usable = unlocked && availability[skill.id];
      button.classList.toggle("skill-usable", usable);
      button.classList.toggle("skill-disabled", !usable);
      button.classList.toggle("skill-selected", payload.input.activeSkill === skill.id);
      button.classList.toggle("skill-quickcast", payload.input.quickCast && skill.id === "move");
      button.classList.toggle("skill-locked", isRole && !unlocked);
      button.disabled = false;
      if (isRole) {
        const icons = assets.roleIcons[skill.id];
        const icon = payload.input.activeSkill === skill.id ? icons.selected : usable ? icons.selecting : icons.normal;
        button.style.backgroundImage = `url('${icon.src}')`;
      } else {
        button.style.backgroundImage = "none";
      }
    }
    const orbTurns = self.effects.orbTurns;
    for (const [skill, badge] of roleDurationBadges) {
      if (skill !== "role3") {
        badge.style.display = "none";
        continue;
      }
      const src = getDisplayNumberSrc(assets, orbTurns);
      if (!src || !self.skills.role3) {
        badge.style.display = "none";
        continue;
      }
      badge.src = src;
      badge.style.display = "block";
    }
    endTurnButton.disabled = !payload.connected || payload.ballisticPending || payload.state.turn.acted || !canEndTurn(payload.state, payload.localSide);
    refreshSpiritPopup(payload);
  }
  function renderTurn(payload) {
    if (payload.state.winner) {
      turnBlue.classList.remove("turn-active");
      turnRed.classList.remove("turn-active");
      turnCenter.textContent = `${getSideLabel(payload.state.winner)}\u83B7\u80DC`;
      return;
    }
    const current = payload.state.turn.side;
    turnBlue.classList.toggle("turn-active", current === "blue");
    turnRed.classList.toggle("turn-active", current === "red");
    turnCenter.textContent = `\u7B2C${payload.state.turn.round}\u56DE\u5408 | \u5F53\u524D: ${getSideLabel(current)}` + (payload.ballisticPending ? " | \u5F39\u9053\u7ED3\u7B97\u4E2D" : "");
  }
  function renderStatus(payload) {
    const unit = payload.state.players[payload.localSide];
    statusHp.textContent = `\u751F\u547D\u503C: ${unit.stats.hp}`;
    statusSpirit.textContent = `\u5F53\u524D\u7075\u529B/\u7075\u529B\u4E0A\u9650: ${unit.stats.spirit}/${unit.stats.maxSpirit}`;
    statusAtk.textContent = `\u653B\u51FB\u529B: ${unit.stats.atk}`;
    statusCoord.textContent = `\u5750\u6807: ${coordToDisplayKey(unit.pos)}`;
    statusGold.textContent = `\u91D1\u5E01: ${unit.stats.gold}`;
  }
  function renderAnnouncement(payload) {
    const announcements = payload.state.announcements;
    announcementList.innerHTML = "";
    if (announcements.length === 0) {
      const empty = document.createElement("div");
      empty.className = "announcement-item";
      empty.textContent = "\u6682\u65E0\u516C\u544A";
      announcementList.appendChild(empty);
      return;
    }
    const history = [...announcements].reverse();
    for (const entry of history) {
      const item = document.createElement("div");
      item.className = "announcement-item";
      const sideMatch = entry.match(/^\[回合\d+P([12]):/);
      if (sideMatch?.[1] === "1") {
        item.classList.add("announcement-blue");
      } else if (sideMatch?.[1] === "2") {
        item.classList.add("announcement-red");
      }
      item.textContent = entry;
      announcementList.appendChild(item);
    }
  }
  function shouldContinueAnimating(payload) {
    if (!payload) {
      return false;
    }
    if (attackAnimation) {
      return true;
    }
    if (projectileAnimations.some((item) => !item.done)) {
      return true;
    }
    return payload.state.players.blue.effects.orbTurns > 0 || payload.state.players.red.effects.orbTurns > 0;
  }
  function render(payload) {
    lastPayload = payload;
    drawBoard(payload);
    renderSkillState(payload);
    renderTurn(payload);
    renderStatus(payload);
    renderAnnouncement(payload);
    if (shouldContinueAnimating(payload)) {
      ensureAnimationLoop();
    }
  }
  function tickAnimation() {
    animationFrame = 0;
    if (!lastPayload) {
      return;
    }
    const now = performance.now();
    for (const animation of projectileAnimations) {
      if (animation.done) {
        continue;
      }
      const maxTime = animation.startedAt + animation.delayMs + animation.durationMs;
      if (now >= maxTime) {
        completeProjectile(animation);
      }
    }
    for (let i = projectileAnimations.length - 1; i >= 0; i -= 1) {
      if (projectileAnimations[i].done) {
        projectileAnimations.splice(i, 1);
      }
    }
    render(lastPayload);
  }
  function ensureAnimationLoop() {
    if (animationFrame !== 0) {
      return;
    }
    animationFrame = window.requestAnimationFrame(tickAnimation);
  }
  window.addEventListener("resize", () => {
    if (lastPayload) {
      render(lastPayload);
    }
  });
  return {
    setHandlers(nextHandlers) {
      handlers = nextHandlers;
    },
    render,
    playAttackAnimation(actor, from, to) {
      attackAnimation = {
        actor,
        from: { ...from },
        to: { ...to },
        startedAt: performance.now(),
        durationMs: 280
      };
      ensureAnimationLoop();
    },
    playProjectileAnimations(projectiles) {
      if (projectiles.length === 0) {
        return Promise.resolve();
      }
      const batchId = ++projectileBatchId;
      const now = performance.now();
      const valid = [];
      for (const projectile of projectiles) {
        const origin = keyToCoord(projectile.origin);
        if (!origin) {
          continue;
        }
        const path = [];
        for (const key of projectile.path) {
          const coord = keyToCoord(key);
          if (coord) {
            path.push(coord);
          }
        }
        const start = { x: origin.x + 0.5, y: origin.y + 0.5 };
        const fallbackEnd = path.length > 0 ? path[path.length - 1] : origin;
        const rayEnd = projectile.rayEnd;
        const end = rayEnd && Number.isFinite(rayEnd.x) && Number.isFinite(rayEnd.y) ? { x: rayEnd.x, y: rayEnd.y } : { x: fallbackEnd.x + 0.5, y: fallbackEnd.y + 0.5 };
        valid.push({
          id: ++projectileId,
          batchId,
          kind: projectile.kind,
          actor: projectile.actor,
          start,
          end,
          startedAt: now,
          delayMs: Math.max(0, projectile.delayMs),
          durationMs: Math.max(220, Math.max(1, path.length) * 90),
          done: false
        });
      }
      if (valid.length === 0) {
        return Promise.resolve();
      }
      for (const item of valid) {
        projectileAnimations.push(item);
      }
      ensureAnimationLoop();
      return new Promise((resolve) => {
        projectileBatchStates.set(batchId, {
          pending: valid.length,
          resolve
        });
      });
    }
  };
}

// src/main.ts
function isCommandEnvelope(message) {
  return message.kind === "command";
}
function createPeerId() {
  return `thchess-${Math.random().toString(36).slice(2, 10)}`;
}
function buildInviteHash(peerId) {
  return peerId;
}
function parseInviteHash(inviteHash) {
  const code = inviteHash.trim();
  return code.length > 0 ? code : null;
}
var FALLBACK_ICE_SERVERS = [{ urls: "stun:stun.l.google.com:19302" }];
function readPeerRuntimeConfig() {
  const viteEnv = import.meta.env;
  const browserEnv = typeof window !== "undefined" ? window.THCHESS_ICE_SERVERS_JSON : "";
  const raw = String(viteEnv?.VITE_ICE_SERVERS_JSON ?? browserEnv ?? "").trim();
  if (!raw) {
    return { iceServers: FALLBACK_ICE_SERVERS };
  }
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) {
      return { iceServers: parsed };
    }
  } catch (error) {
    console.warn("invalid VITE_ICE_SERVERS_JSON, fallback to default STUN", error);
  }
  return { iceServers: FALLBACK_ICE_SERVERS };
}
async function bootstrap() {
  const appRoot = document.getElementById("app");
  const debugRoot = document.getElementById("debug-root");
  if (!appRoot || !debugRoot) {
    throw new Error("missing #app or #debug-root");
  }
  const searchParams = new URLSearchParams(window.location.search);
  if (searchParams.has("replay")) {
    bootstrapReplayPage(appRoot, debugRoot);
    return;
  }
  const debugEnabled = searchParams.has("debug");
  const testMode = searchParams.has("test");
  const view = await createGameView(appRoot);
  const debugPanel = createDebugPanel(debugRoot, { debugEnabled });
  const replayDownloadLine = document.createElement("div");
  replayDownloadLine.className = "debug-line";
  replayDownloadLine.textContent = "\u5BF9\u5C40\u7ED3\u675F\u540E\u53EF\u4E0B\u8F7D .rpy \u590D\u76D8\u6587\u4EF6";
  replayDownloadLine.style.marginTop = "8px";
  const replayDownloadLink = document.createElement("a");
  replayDownloadLink.textContent = "\u4E0B\u8F7D replay.rpy";
  replayDownloadLink.style.display = "none";
  replayDownloadLink.style.color = "#9ec8ff";
  replayDownloadLink.style.textDecoration = "underline";
  replayDownloadLine.appendChild(document.createTextNode(" "));
  replayDownloadLine.appendChild(replayDownloadLink);
  debugRoot.appendChild(replayDownloadLine);
  let state = createInitialState();
  if (testMode) {
    state.players.blue.stats.gold = 400;
    state.players.blue.stats.spirit = state.players.blue.stats.maxSpirit;
  }
  const replayInitialState = JSON.parse(JSON.stringify(state));
  let localSide = testMode ? "blue" : debugPanel.getSelectedSide();
  let inputState = createInitialInputState();
  let transport = null;
  let isConnected = testMode;
  let ballisticPending = false;
  let pendingRemoteId = null;
  let transportSeq = 0;
  let sessionMode = null;
  let testAiTimer = null;
  let replayDownloadUrl = null;
  const replayCommands = [];
  const peerRuntimeConfig = readPeerRuntimeConfig();
  const render = () => {
    const ctx = { game: state, localSide, connected: isConnected, ballisticPending };
    view.render({
      state,
      perspective: buildPerspective(state, localSide),
      localSide,
      connected: isConnected,
      ballisticPending,
      input: inputState,
      highlights: getHighlights(inputState, ctx),
      skillAvailability: getSkillAvailability(ctx),
      spiritSelector: getSpiritSelectorView(inputState, ctx)
    });
    debugPanel.updateDualView(state);
    scheduleTestAiTurn();
  };
  const applyEnvelope = (envelope, source) => {
    const prevState = state;
    const outcome = applyCommandEnvelope(state, envelope);
    if (!outcome.ok) {
      debugPanel.log(`${source} \u547D\u4EE4\u62D2\u7EDD: ${outcome.reason}`);
      return false;
    }
    state = outcome.state;
    replayCommands.push(envelope);
    inputState = createInitialInputState();
    if (envelope.command.type === "endTurn") {
      ballisticPending = false;
    }
    if (envelope.command.type === "attack") {
      const target = keyToCoord(envelope.command.to);
      if (target) {
        view.playAttackAnimation(envelope.command.actor, prevState.players[envelope.command.actor].pos, target);
      }
    }
    const projectiles = outcome.effects?.projectiles ?? [];
    if (projectiles.length > 0) {
      const lockLocalEndTurn = envelope.command.actor === localSide;
      if (lockLocalEndTurn) {
        ballisticPending = true;
      }
      void view.playProjectileAnimations(projectiles).then(() => {
        if (lockLocalEndTurn) {
          ballisticPending = false;
          render();
        }
      });
    }
    if (!prevState.winner && state.winner) {
      if (replayDownloadUrl) {
        URL.revokeObjectURL(replayDownloadUrl);
      }
      const replayContent = serializeReplay(replayCommands, replayInitialState);
      replayDownloadUrl = URL.createObjectURL(
        new Blob([replayContent], { type: "text/plain;charset=utf-8" })
      );
      replayDownloadLink.href = replayDownloadUrl;
      replayDownloadLink.download = buildReplayFilename(/* @__PURE__ */ new Date());
      replayDownloadLink.style.display = "inline";
      replayDownloadLine.firstChild.textContent = "\u5BF9\u5C40\u7ED3\u675F\uFF0C\u590D\u76D8\u6587\u4EF6\u5DF2\u751F\u6210\uFF1A";
    }
    render();
    return true;
  };
  const sendEnvelope = (envelope) => {
    if (testMode) {
      return;
    }
    if (!transport || !isConnected) {
      debugPanel.log("\u672A\u8FDE\u63A5\uFF0C\u547D\u4EE4\u672A\u53D1\u9001");
      return;
    }
    if (debugEnabled) {
      debugPanel.log(
        `send command seq=${envelope.seq} actor=${envelope.command.actor} type=${envelope.command.type}`
      );
    }
    transport.send(envelope);
  };
  const issueLocalCommand = (command) => {
    if (!isConnected) {
      debugPanel.log("\u8FDE\u63A5\u672A\u5B8C\u6210\uFF0C\u6682\u65F6\u65E0\u6CD5\u64CD\u4F5C");
      return;
    }
    if (testMode && command.actor !== localSide) {
      debugPanel.log("test\u6A21\u5F0F\u4E0B\u4EC5\u652F\u6301\u64CD\u4F5CP1/\u84DD\u65B9");
      return;
    }
    const envelope = {
      kind: "command",
      seq: state.seq + 1,
      command
    };
    if (applyEnvelope(envelope, "local")) {
      sendEnvelope(envelope);
    }
  };
  const runTestAiTurn = () => {
    if (!testMode || state.winner || state.turn.side !== "red" || ballisticPending) {
      return;
    }
    const legalMoves = getLegalMoveTargets(state, "red");
    if (legalMoves.length > 0) {
      const target = legalMoves[Math.floor(Math.random() * legalMoves.length)];
      const moveEnvelope = {
        kind: "command",
        seq: state.seq + 1,
        command: createMoveCommand("red", target)
      };
      applyEnvelope(moveEnvelope, "local");
      return;
    }
    if (!state.winner && state.turn.side === "red" && !state.turn.acted) {
      const endTurnEnvelope = {
        kind: "command",
        seq: state.seq + 1,
        command: createEndTurnCommand("red")
      };
      applyEnvelope(endTurnEnvelope, "local");
    }
  };
  const scheduleTestAiTurn = () => {
    if (!testMode) {
      return;
    }
    if (testAiTimer !== null) {
      window.clearTimeout(testAiTimer);
      testAiTimer = null;
    }
    if (state.winner || ballisticPending || state.turn.side !== "red" || state.turn.acted) {
      return;
    }
    testAiTimer = window.setTimeout(() => {
      testAiTimer = null;
      runTestAiTurn();
    }, 220);
  };
  const applyTransportStatus = (status, mySeq) => {
    if (mySeq !== transportSeq) {
      return;
    }
    debugPanel.setTransportStatus(status);
    if (status.type === "connected") {
      isConnected = true;
      render();
      return;
    }
    if (status.type === "ready") {
      isConnected = false;
      inputState = createInitialInputState();
      ballisticPending = false;
      if (sessionMode === "receiver" && transport) {
        const invite = buildInviteHash(transport.getLocalId());
        debugPanel.setInviteHash(invite);
      }
      if (sessionMode === "connector" && pendingRemoteId && transport) {
        const remoteId = pendingRemoteId;
        pendingRemoteId = null;
        transport.connect(remoteId);
      }
      render();
      return;
    }
    if (status.type === "connecting") {
      isConnected = false;
      inputState = createInitialInputState();
      ballisticPending = false;
      render();
      return;
    }
    isConnected = false;
    inputState = createInitialInputState();
    ballisticPending = false;
    render();
  };
  const bindTransport = (next) => {
    if (transport) {
      transport.dispose();
    }
    transport = next;
    transportSeq += 1;
    const mySeq = transportSeq;
    transport.onStatus((status) => {
      applyTransportStatus(status, mySeq);
    });
    transport.onMessage((message) => {
      if (mySeq !== transportSeq) {
        return;
      }
      if (isCommandEnvelope(message)) {
        if (debugEnabled) {
          debugPanel.log(
            `recv command seq=${message.seq} actor=${message.command.actor} type=${message.command.type}`
          );
        }
        if (transport?.name === "loopback" && message.command.actor === localSide) {
          return;
        }
        applyEnvelope(message, "remote");
        return;
      }
    });
    transport.start();
  };
  view.setHandlers({
    onSkillClick(skill) {
      const next = onSkillClick(inputState, skill, {
        game: state,
        localSide,
        connected: isConnected,
        ballisticPending
      });
      inputState = next.next;
      if (next.command) {
        issueLocalCommand(next.command);
      } else {
        render();
      }
    },
    onCellClick(coord) {
      const next = onBoardClick(inputState, coord, {
        game: state,
        localSide,
        connected: isConnected,
        ballisticPending
      });
      inputState = next.next;
      if (next.command) {
        issueLocalCommand(next.command);
      } else {
        render();
      }
    },
    onEndTurnClick() {
      const next = onEndTurnClick(inputState, {
        game: state,
        localSide,
        connected: isConnected,
        ballisticPending
      });
      inputState = next.next;
      if (next.command) {
        issueLocalCommand(next.command);
      } else {
        render();
      }
    },
    onSpiritAdjust(delta) {
      const next = onAdjustSpiritSpend(inputState, delta, {
        game: state,
        localSide,
        connected: isConnected,
        ballisticPending
      });
      inputState = next.next;
      render();
    },
    onUnlockSkill(skill) {
      issueLocalCommand(createUnlockSkillCommand(localSide, skill));
    }
  });
  debugPanel.onSideChange((side) => {
    if (testMode) {
      localSide = "blue";
      inputState = createInitialInputState();
      ballisticPending = false;
      debugPanel.log("test\u6A21\u5F0F\u4E0B\u672C\u673A\u63A7\u5236\u65B9\u56FA\u5B9A\u4E3A P1/\u84DD\u65B9");
      render();
      return;
    }
    localSide = side;
    inputState = createInitialInputState();
    ballisticPending = false;
    debugPanel.log(
      `\u672C\u673A\u63A7\u5236\u65B9: ${side === "blue" ? "P1/\u84DD\u65B9" : "P2/\u7EA2\u65B9"}`
    );
    render();
  });
  debugPanel.onConnectAction((request) => {
    if (testMode) {
      debugPanel.log("test\u6A21\u5F0F\u65E0\u9700\u8054\u673A");
      return;
    }
    debugPanel.setInviteHash("");
    inputState = createInitialInputState();
    ballisticPending = false;
    if (request.mode === "receiver") {
      sessionMode = "receiver";
      pendingRemoteId = null;
      bindTransport(createPeerJsTransport(createPeerId(), peerRuntimeConfig));
      debugPanel.log("\u5DF2\u542F\u52A8\u63A5\u6536\u6A21\u5F0F\uFF0C\u7B49\u5F85\u751F\u6210\u8054\u673A\u7801");
      return;
    }
    const remoteId = parseInviteHash(request.codeInput);
    if (!remoteId) {
      debugPanel.log("\u8054\u673A\u7801\u65E0\u6548");
      return;
    }
    sessionMode = "connector";
    pendingRemoteId = remoteId;
    bindTransport(createPeerJsTransport(createPeerId(), peerRuntimeConfig));
    debugPanel.log("\u5DF2\u542F\u52A8\u8FDE\u63A5\u6A21\u5F0F\uFF0C\u6B63\u5728\u8FDE\u63A5\u8FDC\u7AEF");
  });
  debugPanel.onStartLoopback(() => {
    if (testMode) {
      debugPanel.log("test\u6A21\u5F0F\u65E0\u9700\u8054\u673A");
      return;
    }
    sessionMode = null;
    pendingRemoteId = null;
    ballisticPending = false;
    const loopback = createLoopbackTransport();
    bindTransport(loopback);
    loopback.connect("self");
  });
  if (testMode) {
    debugPanel.setTransportStatus({ type: "connected", detail: "test mode local" });
    debugPanel.log("test\u6A21\u5F0F\u5DF2\u542F\u7528\uFF1AP1\u4E3A\u73A9\u5BB6\uFF0CP2\u4E3A\u968F\u673A\u79FB\u52A8AI");
  }
  render();
}
bootstrap().catch((error) => {
  console.error(error);
});
