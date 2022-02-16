module.exports = mongoose => {
  const PulseTracker = mongoose.model(
    "pulse",
    mongoose.Schema(
      {
        channel: String,
        window: Number,
        channelId: String,
        pulse_requests: [{date: {type: Date, default: Date.now}, members_polled: Number, pulseId: String}],
        users: [
          {
            id: String,
            pulses: [
              {
                pulseId: String,
                date: {type: Date, default: Date.now},
                score_one: Number,
                score_two: Number,
                score_three: Number
              }
            ]
          }
        ]
      }
    )
  );

  return PulseTracker;
};
