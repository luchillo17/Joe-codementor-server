const express = require("express");
const app = express();
const port = 3000;

const cors = require("cors");
const morgan = require("morgan");
const bodyParser = require("body-parser");

app.use(cors());
app.use(bodyParser.json());
app.use(morgan("combined"));

// #region Header and Param validation
const validateHeaders = (requestHeaders) => {
  return (req, res, next) => {
    for (let headerObj of requestHeaders) {
      if (checkParamPresent(Object.keys(req.headers), headerObj)) {
        let reqHeader = req.headers[headerObj.param_key];
        if (!checkParamType(reqHeader, headerObj)) {
          return res.send({
            success: false,
            reason:
              `${headerObj.param_key} is of type ` +
              `${typeof reqHeader} but should be ${headerObj.type}`,
          });
        } else {
          if (!runValidators(reqHeader, headerObj)) {
            return res.send({
              success: false,
              reason: `Validation failed for ${headerObj.param_key}`,
            });
          }
        }
      } else if (headerObj.required) {
        return res.send({
          success: false,
          reason: `${headerObj.param_key} field missing`,
        });
      }
    }
    next();
  };
};

const validateQueryParams = (requestQueryParams) => {
  return (req, res, next) => {
    for (let param of requestQueryParams) {
      if (checkParamPresent(Object.keys(req.query), param)) {
        let reqQueryParam = req.query[param.param_key];
        if (!checkParamType(reqQueryParam, param)) {
          return res.send({
            success: false,
            reason:
              `${param.param_key} is of type ` +
              `${typeof reqQueryParam} but should be ${param.type}`,
          });
        } else {
          if (!runValidators(reqQueryParam, param)) {
            return res.send({
              success: false,
              reason: `Validation failed for ${param.param_key}`,
            });
          }
        }
      } else if (param.required) {
        return res.send({
          success: false,
          reason: `${param.param_key} field missing`,
        });
      }
    }
    next();
  };
};

const validateParams = (requestParams) => {
  return (req, res, next) => {
    for (let param of requestParams) {
      if (checkParamPresent(Object.keys(req.body), param)) {
        let reqParam = req.body[param.param_key];
        if (!checkParamType(reqParam, param)) {
          return res.send({
            success: false,
            reason:
              `${param.param_key} is of type ` +
              `${typeof reqParam} but should be ${param.type}`,
          });
        } else {
          if (!runValidators(reqParam, param)) {
            return res.send({
              success: false,
              reason: `Validation failed for ${param.param_key}`,
            });
          }
        }
      } else if (param.required) {
        return res.send({
          success: false,
          reason: `${param.param_key} field missing`,
        });
      }
    }
    next();
  };
};

const checkParamPresent = function (reqParams, paramObj) {
  return reqParams.includes(paramObj.param_key);
};

const checkParamType = function (reqParam, paramObj) {
  const reqParamType = typeof reqParam;
  return reqParamType === paramObj.type;
};

const runValidators = function (reqParam, paramObj) {
  for (let validator of paramObj.validator_functions) {
    if (!validator(reqParam)) {
      return false;
    }
  }
  return true;
};
// #endregion

//#region Utils
const getRandomToken = () => Math.random().toString(36).substr(2);
//#endregion

// Global Variables
const users = [];
let channels = [];
let usersJoinedChannels = []; // Many to Many relation
const messages = []; // Many to One relation

app.post(
  "/signup",
  validateParams([
    {
      param_key: "username",
      required: true,
      type: "string",
      validator_functions: [],
    },
    {
      param_key: "password",
      required: true,
      type: "string",
      validator_functions: [],
    },
  ]),
  (req, res) => {
    const userExists = users.some(
      (user) => user.username === req.body.username
    );

    if (userExists) {
      return res.send({
        success: false,
        reason: "Username exists",
      });
    }

    users.push({
      username: req.body.username,
      password: req.body.password,
      token: null,
    });

    res.send({ success: true });
  }
);

app.post(
  "/login",
  validateParams([
    {
      param_key: "username",
      required: true,
      type: "string",
      validator_functions: [],
    },
    {
      param_key: "password",
      required: true,
      type: "string",
      validator_functions: [],
    },
  ]),
  (req, res) => {
    const user = users.find((user) => user.username === req.body.username);

    if (!user) {
      return res.send({
        success: false,
        reason: "User does not exist",
      });
    }

    if (user.password !== req.body.password) {
      return res.send({ success: false, reason: "Invalid password" });
    }

    const token = getRandomToken();

    user.token = token;

    res.send({ success: true, token });
  }
);

app.get(
  "/joined",
  validateHeaders([
    {
      param_key: "token",
      required: true,
      type: "string",
      validator_functions: [(token) => token.length > 0],
    },
  ]),
  validateQueryParams([
    {
      param_key: "channelName",
      required: true,
      type: "string",
      validator_functions: [],
    },
  ]),
  (req, res) => {
    const user = users.find((user) => user.token === req.header("token"));

    if (!user) {
      return res.send({
        success: false,
        reason: "Invalid token",
      });
    }

    const channel = channels.find(
      (channel) => channel.channelName === req.query.channelName
    );

    if (!channel) {
      return res.send({
        success: false,
        reason: "Channel does not exist",
      });
    }

    const userJoined = usersJoinedChannels.find(
      (userChannel) =>
        userChannel.channelName === channel.channelName &&
        userChannel.username === user.username
    );

    if (!userJoined) {
      return res.send({
        success: false,
        reason: "User is not part of this channel",
      });
    }

    if (userJoined.banned) {
      return res.send({
        success: false,
        reason: "User is banned",
      });
    }

    const joined = usersJoinedChannels
      .filter((userChannel) => userChannel.channelName === channel.channelName)
      .map((userChannel) => userChannel.username);

    res.send({ success: true, joined });
  }
);

app.post(
  "/create-channel",
  validateHeaders([
    {
      param_key: "token",
      required: true,
      type: "string",
      validator_functions: [(token) => token.length > 0],
    },
  ]),
  validateParams([
    {
      param_key: "channelName",
      required: true,
      type: "string",
      validator_functions: [],
    },
  ]),
  (req, res) => {
    const user = users.find((user) => user.token === req.header("token"));

    if (!user) {
      return res.send({
        success: false,
        reason: "Invalid token",
      });
    }

    const channelExists = channels.some(
      (channel) => channel.channelName === req.body.channelName
    );

    if (channelExists) {
      return res.send({
        success: false,
        reason: "Channel already exists",
      });
    }

    channels.push({
      channelName: req.body.channelName,
      owner: user.username,
    });

    res.send({ success: true });
  }
);

app.post(
  "/delete-channel",
  validateHeaders([
    {
      param_key: "token",
      required: true,
      type: "string",
      validator_functions: [(token) => token.length > 0],
    },
  ]),
  validateParams([
    {
      param_key: "channelName",
      required: true,
      type: "string",
      validator_functions: [],
    },
  ]),
  (req, res) => {
    const user = users.find((user) => user.token === req.header("token"));

    if (!user) {
      return res.send({
        success: false,
        reason: "Invalid token",
      });
    }

    const channel = channels.find(
      (channel) => channel.channelName === req.body.channelName
    );

    if (!channel) {
      return res.send({
        success: false,
        reason: "Channel does not exist",
      });
    }

    const isChannelOwner = channel.owner === user.username;

    if (!isChannelOwner) {
      return res.send({
        success: false,
        reason: "Channel not owned by user",
      });
    }

    channels = channels.filter(
      (channelItem) => channelItem.channelName !== channel.channelName
    );

    res.send({ success: true });
  }
);

app.post(
  "/join-channel",
  validateHeaders([
    {
      param_key: "token",
      required: true,
      type: "string",
      validator_functions: [(token) => token.length > 0],
    },
  ]),
  validateParams([
    {
      param_key: "channelName",
      required: true,
      type: "string",
      validator_functions: [],
    },
  ]),
  (req, res) => {
    const user = users.find((user) => user.token === req.header("token"));

    if (!user) {
      return res.send({
        success: false,
        reason: "Invalid token",
      });
    }

    const channel = channels.find(
      (channel) => channel.channelName === req.body.channelName
    );

    if (!channel) {
      return res.send({
        success: false,
        reason: "Channel does not exist",
      });
    }

    const userJoined = usersJoinedChannels.find(
      (userChannel) =>
        userChannel.channelName === channel.channelName &&
        userChannel.username === user.username
    );

    if (userJoined && userJoined.banned) {
      return res.send({
        success: false,
        reason: "User is banned",
      });
    }

    if (userJoined) {
      return res.send({
        success: false,
        reason: "User has already joined",
      });
    }

    usersJoinedChannels.push({
      channelName: channel.channelName,
      username: user.username,
      banned: false,
    });

    res.send({ success: true });
  }
);

app.post(
  "/leave-channel",
  validateHeaders([
    {
      param_key: "token",
      required: true,
      type: "string",
      validator_functions: [(token) => token.length > 0],
    },
  ]),
  validateParams([
    {
      param_key: "channelName",
      required: true,
      type: "string",
      validator_functions: [],
    },
  ]),
  (req, res) => {
    const user = users.find((user) => user.token === req.header("token"));

    if (!user) {
      return res.send({
        success: false,
        reason: "Invalid token",
      });
    }

    const channel = channels.find(
      (channel) => channel.channelName === req.body.channelName
    );

    if (!channel) {
      return res.send({
        success: false,
        reason: "Channel does not exist",
      });
    }

    const userJoined = usersJoinedChannels.findIndex(
      (userChannel) =>
        userChannel.channelName === channel.channelName &&
        userChannel.username === user.username
    );

    if (userJoined < 0) {
      return res.send({
        success: false,
        reason: "User is not part of this channel",
      });
    }

    usersJoinedChannels = usersJoinedChannels.filter(
      (userChannel) =>
        !(
          userChannel.channelName === channel.channelName &&
          userChannel.username === user.username
        )
    );

    res.send({ success: true });
  }
);

app.post(
  "/kick",
  validateHeaders([
    {
      param_key: "token",
      required: true,
      type: "string",
      validator_functions: [(token) => token.length > 0],
    },
  ]),
  validateParams([
    {
      param_key: "channelName",
      required: true,
      type: "string",
      validator_functions: [],
    },
    {
      param_key: "target",
      required: true,
      type: "string",
      validator_functions: [],
    },
  ]),
  (req, res) => {
    const user = users.find((user) => user.token === req.header("token"));

    if (!user) {
      return res.send({
        success: false,
        reason: "Invalid token",
      });
    }

    const channel = channels.find(
      (channel) => channel.channelName === req.body.channelName
    );

    if (!channel) {
      return res.send({
        success: false,
        reason: "Channel does not exist",
      });
    }

    const isChannelOwner = channel.owner === user.username;

    if (!isChannelOwner) {
      return res.send({
        success: false,
        reason: "Channel not owned by user",
      });
    }

    usersJoinedChannels = usersJoinedChannels.filter(
      (userChannel) =>
        !(
          userChannel.channelName === channel.channelName &&
          userChannel.username === req.body.target
        )
    );

    res.send({ success: true });
  }
);

app.post(
  "/ban",
  validateHeaders([
    {
      param_key: "token",
      required: true,
      type: "string",
      validator_functions: [(token) => token.length > 0],
    },
  ]),
  validateParams([
    {
      param_key: "channelName",
      required: true,
      type: "string",
      validator_functions: [],
    },
    {
      param_key: "target",
      required: true,
      type: "string",
      validator_functions: [],
    },
  ]),
  (req, res) => {
    const user = users.find((user) => user.token === req.header("token"));

    if (!user) {
      return res.send({
        success: false,
        reason: "Invalid token",
      });
    }

    const channel = channels.find(
      (channel) => channel.channelName === req.body.channelName
    );

    if (!channel) {
      return res.send({
        success: false,
        reason: "Channel does not exist",
      });
    }

    const isChannelOwner = channel.owner === user.username;

    if (!isChannelOwner) {
      return res.send({
        success: false,
        reason: "Channel not owned by user",
      });
    }

    const userChannelIndex = usersJoinedChannels.findIndex(
      (userChannel) =>
        userChannel.channelName === channel.channelName &&
        userChannel.username === req.body.target
    );

    if (userChannelIndex < 0) {
      return res.send({
        success: false,
        reason: "Target is not part of this channel",
      });
    }

    const bannedUserChannel = {
      ...usersJoinedChannels[userChannelIndex],
      banned: true,
    };

    usersJoinedChannels[userChannelIndex] = bannedUserChannel;

    res.send({ success: true });
  }
);

app.get(
  "/messages",
  validateHeaders([
    {
      param_key: "token",
      required: true,
      type: "string",
      validator_functions: [(token) => token.length > 0],
    },
  ]),
  validateQueryParams([
    {
      param_key: "channelName",
      required: true,
      type: "string",
      validator_functions: [],
    },
  ]),
  (req, res) => {
    const user = users.find((user) => user.token === req.header("token"));

    if (!user) {
      return res.send({
        success: false,
        reason: "Invalid token",
      });
    }

    const channel = channels.find(
      (channel) => channel.channelName === req.query.channelName
    );

    if (!channel) {
      return res.send({
        success: false,
        reason: "Channel does not exist",
      });
    }

    const userJoined = usersJoinedChannels.find(
      (userChannel) =>
        userChannel.channelName === channel.channelName &&
        userChannel.username === user.username
    );

    if (!userJoined) {
      return res.send({
        success: false,
        reason: "User is not part of this channel",
      });
    }

    if (userJoined.banned) {
      return res.send({
        success: false,
        reason: "User is banned",
      });
    }

    const channelMessages = messages
      .filter((message) => message.channelName === channel.channelName)
      .map((message) => ({ from: message.from, contents: message.contents }));

    res.send({ success: true, messages: channelMessages });
  }
);

app.post(
  "/message",
  validateHeaders([
    {
      param_key: "token",
      required: true,
      type: "string",
      validator_functions: [(token) => token.length > 0],
    },
  ]),
  validateParams([
    {
      param_key: "channelName",
      required: true,
      type: "string",
      validator_functions: [],
    },
    {
      param_key: "contents",
      required: true,
      type: "string",
      validator_functions: [],
    },
  ]),
  (req, res) => {
    const user = users.find((user) => user.token === req.header("token"));

    if (!user) {
      return res.send({
        success: false,
        reason: "Invalid token",
      });
    }

    const channel = channels.find(
      (channel) => channel.channelName === req.body.channelName
    );

    if (!channel) {
      return res.send({
        success: false,
        reason: "Channel does not exist",
      });
    }

    const userJoined = usersJoinedChannels.find(
      (userChannel) =>
        userChannel.channelName === channel.channelName &&
        userChannel.username === user.username
    );

    if (!userJoined) {
      return res.send({
        success: false,
        reason: "User is not part of this channel",
      });
    }

    if (userJoined.banned) {
      return res.send({
        success: false,
        reason: "User is banned",
      });
    }

    messages.push({
      from: user.username,
      channelName: channel.channelName,
      contents: req.body.contents,
    });

    res.send({ success: true });
  }
);

app.listen(port, () => {
  console.log(`Example app listening at http://localhost:${port}`);
});
