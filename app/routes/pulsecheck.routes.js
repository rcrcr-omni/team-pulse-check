module.exports = app => {
  const pulsetracker = require("../controllers/pulsecheck.controller.js");

  var router = require("express").Router();

  // Find all channels
  router.get("/channel/all", pulsetracker.getChannels)

  // Create or update a channel
  router.post("/channel/edit", pulsetracker.editChannel)

  // Delete a channel
  router.delete("/channel/delete", pulsetracker.deleteChannel)

  router.post("/channel/pulserequest", pulsetracker.pulseRequest)

  router.post("/user/pulseresponse", pulsetracker.pulseResponse)

  router.get("/user/history", pulsetracker.userHistory)

  router.get("/channel/pulse", pulsetracker.lastPulse)
/*
  // Create a new User
  router.post("/user/new/", pulsetracker.createUser);

  // Create a new status
  router.post("/user/status/new/", pulsetracker.createStatus);

  // Retrieve all Tutorials
  router.get("/pulsecheck/", pulsetracker.allStatuses);

  // Retrieve a single Tutorial with id
  //router.get("/:id", tutorials.findOne);

  // Update a Tutorial with id
  router.post("/user/update/", pulsetracker.updateUser);

  // Delete a Tutorial with id
  //router.delete("/:id", tutorials.delete);
*/
  // Delete everything
  router.delete("/wipetheslate/", pulsetracker.deleteAll);

  app.use('/api', router);
};
