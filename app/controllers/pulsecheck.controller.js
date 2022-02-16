const db = require("../models");
const PulseTracker = db.pulsetracker;


exports.getChannels = (req, res) => {
  PulseTracker.find()
    .then(data => {
      res.send(data);
    })
    .catch(err => {
      res.status(500).send({
        message:
          err.message || "Some error occurred while retrieving data."
      });
    });
}

exports.editChannel = (req, res) => {
  const foundChannel = PulseTracker.find({channelId: req.query.conversationId}, function(err, ch){
    if(ch.length == 0) {
      console.log("couldn't find anything! will create it")
      const newChannel = new PulseTracker({
        channel: req.query.channel,
        channelId: req.query.conversationId,
        window: req.query.window
      })
      newChannel
        .save(newChannel)
        .then(data => {
        res.send(data);
      })
      .catch(err => {
        res.status(500).send({
          message:
            err.message || "An error occurred while creating this channel."
        })
      })
    }
    if (ch.length == 1) {
      console.log("found something! will update it" + console.log(ch[0]))
      console.log(req.query)
      if(req.query.window != ch[0].window) {
        ch[0].window = req.query.window
        console.log('updated window')
        ch[0].save(ch[0])
          .then(data => {
          res.send(data);
        })
        .catch(err => {
          res.status(500).send({
            message:
              err.message || "An error occurred while updating this channel."
          })
        })
      }
    }
  })
}

exports.deleteChannel = (req, res) => {

}

exports.pulseRequest = (req, res) => {
  const foundChannel = PulseTracker.find({channelId: req.query.conversationId}, function(err, ch){
    if(ch.length == 0) {
        res.status(500).send({
          message: "Couldn't find the channel."
        })
      }
    if (ch.length == 1) {
      console.log("found something! will update it")
      if(ch[0]) {
        const pulserequests = ch[0].pulse_requests

        pulserequests.push({
          date: new Date(),
          members_polled: req.query.total_prompts_sent,
          pulseId: req.query.pulseId
        })
        ch[0].save(ch[0])
          .then(data => {
          res.send(data);
        })
        .catch(err => {
          res.status(500).send({
            message:
              err.message || "An error occurred while adding a pulse request to this channel."
          })
        })
      }
    }
  })
}

exports.pulseResponse = (req, res) => {
  const channel = PulseTracker.find({channelId: req.query.conversationId}, function(err, ch){
    if(ch.length == 0) {
      res.status(500).send({
        message: "Couldn't find the channel."
      })
    }
    if(ch.length == 1) {
      console.log('pulseresponse found the channel: ' + req.query.conversationId)
      const conversation = ch[0]
      const members = conversation.users // array
      if(members.length) {
        // if there are members, let's see if any of them are the one that sent the response
        const user = members.findIndex(member => member.id == req.query.user)

        if (user == -1) {
          // user doesn't exist, let's make them
          members.push({
            id: req.query.user,
            pulses: {
              pulseId: req.query.pulseId,
              date: new Date(),
              score_one: req.query.score_one,
              score_two: req.query.score_two,
              score_three: req.query.score_three
            }
          }) // and then save the channel
          conversation.save(conversation)
          .then(data => {
            res.send(data);
          })
          .catch(err => {
            res.status(500).send({
              message:
                err.message || "An error occurred while creating this user and saving their pulse response."
            })
          })
        } else {
          // user exists, let's give them a pulse
          members[user].pulses.push({
            pulseId: req.query.pulseId,
            date: new Date(),
            score_one: req.query.score_one,
            score_two: req.query.score_two,
            score_three: req.query.score_three
          }) // and then save the channel
          conversation.save(conversation)
          .then(data => {
            res.send(data);
          })
          .catch(err => {
            res.status(500).send({
              message:
                err.message || "An error occurred while saving this pulse response."
            })
          })
        }
      } else {
        // if there aren't any members at all yet, we definitely need to make a new one
        members.push({
          id: req.query.user,
          pulses: {
            pulseId: req.query.pulseId,
            date: new Date(),
            score_one: req.query.score_one,
            score_two: req.query.score_two,
            score_three: req.query.score_three
          }
        }) // and then save the channel
        conversation.save(conversation)
        .then(data => {
          console.log(members)
          res.send(data);
        })
        .catch(err => {
          res.status(500).send({
            message:
              err.message || "An error occurred while creating this user and saving their pulse response."
          })
        })
      }
    }
  })
}

exports.userHistory = (req, res) => {
  // we need the channel and the user
  const channelId = req.query.conversationId
  const userId = req.query.user

  const channel = PulseTracker.find({channelId: channelId}, function(err, ch){
    if(ch.length == 0) {
      res.status(500).send({
        message: "Couldn't find the channel."
      })
    }
    if(ch.length == 1) {
      console.log('pulseresponse found the channel: ' + channelId)
      const conversation = ch[0]
      const members = conversation.users // array
      if(members.length) {
        const user = members.findIndex(member => member.id == userId)

        if (user == -1) {
          // user doesn't exist
          res.status(500).send({
            message: "User doesn't exist."
          })
        } else {
          const pulsehistory = members[user].pulses.slice(-4) // get the last four pulse responses
          res.send(pulsehistory)
        }
      }
    }
  }).clone()
}

exports.lastPulse = (req, res) => {
  const channelId = req.query.conversationId

  const channel = PulseTracker.find({channelId: channelId}, function(err, ch){
    if(ch.length == 0) {
      res.status(500).send({
        message: "Couldn't find the channel."
      })
    }
    if(ch.length == 1) {
      const lastpulse = ch[0].pulse_requests.slice(-1)[0]
      console.log(lastpulse.pulseId)

      let scores = {
        q1: [],
        q2: [],
        q3: []
      }

      const members = ch[0].users

      for (const member of members) {
        // need to add a graceful error in here if the user doesn't have a score submitted.
        // and another if no users have scores submitted!
        const user_scores = member.pulses.find(e => e.pulseId == lastpulse.pulseId)

        scores.q1.push(user_scores.score_one)
        scores.q2.push(user_scores.score_two)
        scores.q3.push(user_scores.score_three)
      }

      console.log(scores)

      res.send(scores)

    }
  }).clone()
}

/*
// Create and Save a new User
exports.createUser = (req, res) => {
  console.log(req.query.name)
  const newUser = new Ranking({
    name: req.query.name,
    nickname: req.query.nickname
  })

  console.log(newUser)

  newUser
    .save(newUser)
    .then(data => {
      res.send(data);
    })
    .catch(err => {
      res.status(500).send({
        message:
          err.message || "An error occurred while creating this user."
      })
    })
};

// Create and Save a new status
exports.createStatus = (req, res) => {
  console.log(req.query.name)
  const foundUser = Ranking.findOne({name: req.query.name}, function(err, user){
    console.log(user)
    console.log("User is " + user.name)
    const statuses = user.statuses
    console.log("Status is" + statuses)

    statuses.push({
      badges: req.query.badges,
      points: req.query.points
    })

    console.log(statuses)
    user
      .save(user)
      .then(data => {
        res.send(data);
      })
      .catch(err => {
        res.status(500).send({
          message:
            err.message || "An error occurred while creating this user."
        })
      })
  })
}

// Retrieve all trailheadranks from the database.
exports.allStatuses = (req, res) => {

  PulseTracker.find()
    .then(data => {
      res.send(data);
    })
    .catch(err => {
      res.status(500).send({
        message:
          err.message || "Some error occurred while retrieving tutorials."
      });
    });
};

// Find a single Tutorial with an id
exports.findOne = (req, res) => {
  const user = Ranking.findOne({name: req.query.name})

};

// Update a Tutorial by the id in the request
exports.updateUser = (req, res) => {
  const foundUser = Ranking.findOne({name: req.query.name}, function(err, user) {
    if(req.query.nickname) {
      user.nickname = req.query.nickname
    }

    if(req.query.imgUrl) {
      user.imgUrl = req.query.imgUrl
    }
    console.log(user.name + " | " + user.nickname + " | " + user.imgUrl)

    user
      .save(user)
      .then(data => {
        res.send(data);
      })
      .catch(err => {
        res.status(500).send({
          message:
            err.message || "An error occurred while updating this user."
        })
      })

  })
};

// Delete a Tutorial with the specified id in the request
exports.delete = (req, res) => {

};
*/
// Delete all recordsfrom the database.
exports.deleteAll = (req, res) => {
  PulseTracker.deleteMany({})
    .then(data => {
      res.send({
        message: `${data.deletedCount} channels were deleted successfully!`
      });
    })
    .catch(err => {
      res.status(500).send({
        message:
          err.message || "Some error occurred while deleting everything."
      });
    });
};

// Find all published Tutorials
exports.findAllPublished = (req, res) => {

};
